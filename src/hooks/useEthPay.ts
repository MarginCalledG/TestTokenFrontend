import { useCallback, useState } from 'react'
import type { Abi, Address } from 'viem'
import { formatEther, formatUnits } from 'viem'
import { useAccount, useConfig, useReadContract } from 'wagmi'
import { readContract } from 'wagmi/actions'
import { erc20Abi, v2RouterAbi } from '../abi'
import { addresses, configured } from '../config/addresses'
import { DEMO } from '../config/demo'
import type { Approval } from './useTx'

/** Slippage buffer sent on top of the quote. Everything not needed is refunded in the same tx. */
export const ETH_BUFFER_BPS = 300n
const DEADLINE_SEC = 600n

export type PayWith = 'eth' | 'usdg'

/** A contract call as useTx.run takes it. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Call = { address: Address; abi: any; functionName: string; args?: readonly unknown[]; value?: bigint }

/**
 * How to pay a USDG-priced fee:
 *   value     — ETH to attach to the call (native ETH payment)
 *   approvals — USDG approval for the spender
 *   pre       — a transaction to run first: buy the missing USDG with ETH on Uniswap
 */
export type Payment = { value?: bigint; approvals: Approval[]; pre?: { label: string; call: Call } }

const fmtUsdg = (v: bigint) => Number(formatUnits(v, 6)).toFixed(2)

/**
 * ETH or USDG for every USDG-priced fee.
 *
 * - Contracts with `ethRouter()` (deployed with EthPay) take ETH directly: one transaction, the
 *   contract buys the exact USDG for the reserve and refunds the rest.
 * - Older contracts take USDG only. Paying "with ETH" there means: first buy exactly the missing
 *   USDG into the user's wallet on Uniswap (`swapETHForExactTokens`, unused ETH refunded by the
 *   router), then pay in USDG as usual. Two transactions, same price.
 */
export function useEthPay(spender: Address | null, abi: Abi) {
  const config = useConfig()
  const { address: account } = useAccount()
  const [payWith, setPayWith] = useState<PayWith>('eth')
  const { data: router, isError } = useReadContract({
    address: spender as Address,
    abi,
    functionName: 'ethRouter',
    query: { enabled: !!spender && configured() && !DEMO, staleTime: 300_000, retry: false },
  })
  /** The contract itself accepts ETH (one transaction). */
  const native =
    !isError && typeof router === 'string' && router !== '0x0000000000000000000000000000000000000000'
  /** ETH is always offered: natively, or via a USDG pre-purchase. */
  const supported = configured('router', 'usdg', 'weth')
  const useEth = supported && payWith === 'eth'

  /** ETH needed for `usdgAmount` USDG right now, plus the refundable buffer. */
  const ethFor = useCallback(
    async (usdgAmount: bigint) => {
      const q = (
        (await readContract(config, {
          address: addresses.router as Address,
          abi: v2RouterAbi,
          functionName: 'getAmountsIn',
          args: [usdgAmount, [addresses.weth, addresses.usdg] as Address[]],
        })) as readonly bigint[]
      )[0]
      return q + (q * ETH_BUFFER_BPS) / 10_000n
    },
    [config],
  )

  const usdgBalance = useCallback(async () => {
    if (!account || !addresses.usdg) return 0n
    return (await readContract(config, {
      address: addresses.usdg as Address,
      abi: erc20Abi,
      functionName: 'balanceOf',
      args: [account],
    })) as bigint
  }, [config, account])

  /** Work out how this fee gets paid. Throws a readable error instead of letting USDG revert bare. */
  const prepare = useCallback(
    async (usdgAmount: bigint): Promise<Payment> => {
      if (useEth && native) return { value: await ethFor(usdgAmount), approvals: [] }
      const approvals: Approval[] = [
        { token: addresses.usdg as Address, spender: spender as Address, amount: usdgAmount, symbol: 'USDG' },
      ]
      const have = await usdgBalance()
      if (have >= usdgAmount) return { approvals }
      if (!useEth)
        throw new Error(
          `This costs ${fmtUsdg(usdgAmount)} USDG and your wallet holds ${fmtUsdg(have)} USDG. ` +
            'Switch to "Pay with ETH" or get USDG first.',
        )
      const missing = usdgAmount - have
      return {
        approvals,
        pre: {
          label: `Buy ${fmtUsdg(missing)} USDG with ETH`,
          call: {
            address: addresses.router as Address,
            abi: v2RouterAbi,
            functionName: 'swapETHForExactTokens',
            args: [
              missing,
              [addresses.weth, addresses.usdg] as Address[],
              account,
              BigInt(Math.floor(Date.now() / 1000)) + DEADLINE_SEC,
            ],
            value: await ethFor(missing),
          },
        },
      }
    },
    [useEth, native, ethFor, usdgBalance, spender, account],
  )

  return { supported, native, useEth, payWith, setPayWith, prepare }
}

/** Live "≈ 0.0396 ETH" label for a USDG amount (router quote, same math as the contracts). */
export function useEthQuote(usdgAmount: bigint | undefined, enabled: boolean) {
  const { data } = useReadContract({
    address: addresses.router as Address,
    abi: v2RouterAbi,
    functionName: 'getAmountsIn',
    args: usdgAmount !== undefined ? [usdgAmount, [addresses.weth, addresses.usdg] as Address[]] : undefined,
    query: {
      enabled: enabled && usdgAmount !== undefined && configured('router', 'weth', 'usdg') && !DEMO,
      refetchInterval: 20_000,
    },
  })
  const q = (data as readonly bigint[] | undefined)?.[0]
  if (q === undefined || q === 0n) return undefined
  const n = Number(formatEther(q))
  return `≈ ${n.toLocaleString('en-US', { maximumFractionDigits: n < 0.01 ? 6 : 4 })} ETH`
}
