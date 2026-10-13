import { useCallback, useState } from 'react'
import type { Abi, Address } from 'viem'
import { formatEther, formatUnits } from 'viem'
import { useAccount, useConfig, useReadContract } from 'wagmi'
import { readContract } from 'wagmi/actions'
import { erc20Abi } from '../abi'
import { addresses, configured } from '../config/addresses'
import { DEMO } from '../config/demo'

/** Slippage buffer sent on top of the quote. Everything not needed is refunded in the same tx. */
export const ETH_BUFFER_BPS = 300n

export type PayWith = 'eth' | 'usdg'

/**
 * ETH payment for a USDG-priced fee. Contracts deployed before ETH payment existed have no
 * `ethRouter()`; the read then fails and the screen simply offers USDG only.
 */
export function useEthPay(address: Address | null, abi: Abi) {
  const config = useConfig()
  const [payWith, setPayWith] = useState<PayWith>('eth')
  const { data: router, isError } = useReadContract({
    address: address as Address,
    abi,
    functionName: 'ethRouter',
    query: { enabled: !!address && configured() && !DEMO, staleTime: 300_000 },
  })
  const supported =
    !isError && typeof router === 'string' && router !== '0x0000000000000000000000000000000000000000'
  const useEth = supported && payWith === 'eth'

  /** Fresh quote at click time, plus the refundable buffer. */
  const ethValue = useCallback(
    async (usdgAmount: bigint) => {
      const q = (await readContract(config, {
        address: address as Address,
        abi,
        functionName: 'quoteEth',
        args: [usdgAmount],
      })) as bigint
      return q + (q * ETH_BUFFER_BPS) / 10_000n
    },
    [config, address, abi],
  )
  const { address: account } = useAccount()
  /**
   * USDG has no revert reason the wallet can show — an underfunded fee surfaces as a bare
   * "execution reverted". Check the balance first and say what is missing.
   */
  const checkUsdg = useCallback(
    async (usdgAmount: bigint) => {
      if (!account || !addresses.usdg) return
      const have = (await readContract(config, {
        address: addresses.usdg as Address,
        abi: erc20Abi,
        functionName: 'balanceOf',
        args: [account],
      })) as bigint
      if (have >= usdgAmount) return
      const f = (v: bigint) => Number(formatUnits(v, 6)).toFixed(2)
      throw new Error(
        `This costs ${f(usdgAmount)} USDG and your wallet holds ${f(have)} USDG.` +
          (supported ? ' Switch to "Pay with ETH" or get USDG first.' : ' Get USDG first (e.g. swap ETH -> USDG on Uniswap).'),
      )
    },
    [config, account, supported],
  )
  return { supported, useEth, payWith, setPayWith, ethValue, checkUsdg }
}

/** Live "≈ 0.0396 ETH" label for a USDG amount. */
export function useEthQuote(address: Address | null, abi: Abi, usdgAmount: bigint | undefined, enabled: boolean) {
  const { data } = useReadContract({
    address: address as Address,
    abi,
    functionName: 'quoteEth',
    args: usdgAmount !== undefined ? [usdgAmount] : undefined,
    query: { enabled: enabled && !!address && usdgAmount !== undefined && !DEMO, refetchInterval: 20_000 },
  })
  if (typeof data !== 'bigint' || data === 0n) return undefined
  const n = Number(formatEther(data))
  return `≈ ${n.toLocaleString('en-US', { maximumFractionDigits: n < 0.01 ? 6 : 4 })} ETH`
}
