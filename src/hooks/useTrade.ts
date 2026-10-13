import { useCallback, useEffect, useMemo, useState } from 'react'
import type { Address } from 'viem'
import {
  useAccount,
  useConfig,
  useReadContract,
  useReadContracts,
  useWaitForTransactionReceipt,
  useWriteContract,
} from 'wagmi'
import { erc20Abi, higherAbi, v2RouterAbi } from '../abi'
import { addresses, configured } from '../config/addresses'
import { DEMO } from '../config/demo'
import { TAX_CAP_BPS, useTradeTax } from './useTax'
import { activeChain } from '../config/chains'
import { ensureChain } from '../lib/ensureChain'

export type Side = 'buy' | 'sell'
export type TradeStatus = 'idle' | 'approving' | 'swapping' | 'success' | 'error'

const BPS = 10_000n
const DEADLINE_SEC = 600n

/**
 * Safety margin on "max sell".
 *
 * HIGHER melts in discrete 30-minute steps, and `Higher._move` reverts rather
 * than clamping when `amount > balanceOf(from)`. Signing with the displayed
 * balance and landing after an epoch boundary therefore costs gas for a
 * revert. A full step is at most ~0.14% at the top rate; 0.5% covers it with
 * room, which is worth more than the fraction of a percent it leaves behind.
 */
export const MAX_SELL_MARGIN_BPS = 50n

export function applyMaxSellMargin(balance: bigint): bigint {
  return (balance * (BPS - MAX_SELL_MARGIN_BPS)) / BPS
}

export type Quote = {
  /** Pool output before tax, straight from the router. */
  gross: bigint
  taxBps: number
  /** What the user actually ends up with. */
  expected: bigint
  /** expected minus slippage tolerance — what goes on the wire. */
  minOut: bigint
  /** Tax in input-token units on a sell, output-token units on a buy. */
  taxAmount: bigint
}

/** What the user pays with on a buy / receives on a sell. */
export type Asset = 'ETH' | 'SPY'

export function useTrade(
  side: Side,
  amountIn: bigint | undefined,
  slippageBps: number,
  asset: Asset = 'SPY',
) {
  const { address: account } = useAccount()
  const ready =
    configured('higher', 'spy', 'router', 'pair') &&
    (asset === 'SPY' || configured('weth', 'usdg')) &&
    !DEMO
  const live = ready && amountIn !== undefined && amountIn > 0n

  const higher = addresses.higher as Address
  const spy = addresses.spy as Address
  const router = addresses.router as Address
  const weth = addresses.weth as Address
  const usdgAddr = addresses.usdg as Address

  /** ETH has no allowance; on an ETH buy nothing needs approving. */
  const tokenIn: Address | undefined = side === 'sell' ? higher : asset === 'SPY' ? spy : undefined
  /** ETH goes WETH -> USDG -> SPY -> HIGHER (no WETH/SPY pool exists); the sell is the reverse. */
  const path = useMemo<readonly Address[]>(() => {
    const buy = asset === 'ETH' ? [weth, usdgAddr, spy, higher] : [spy, higher]
    return side === 'buy' ? buy : [...buy].reverse()
  }, [side, asset, spy, higher, weth, usdgAddr])

  /**
   * Buy side: the router quote is the pool output; the token then taxes that HIGHER amount on the
   * way to the buyer. The token sizes the dynamic tax by the HIGHER amount moved, so the oracle is
   * asked with the gross HIGHER output — not with the SPY/ETH input.
   */
  const { data: buyAmounts, isFetching: quotingBuy } = useReadContract({
    address: router,
    abi: v2RouterAbi,
    functionName: 'getAmountsOut',
    args: amountIn !== undefined ? [amountIn, path] : undefined,
    query: { enabled: live && side === 'buy', refetchInterval: 5_000 },
  })
  const buyGross =
    side === 'buy' && buyAmounts ? (buyAmounts as readonly bigint[]).at(-1) : undefined

  const tax = useTradeTax(side === 'buy' ? buyGross : amountIn)

  /**
   * Sell side: the tax is taken on the way INTO the pool, so the pair receives
   * less than the user sends and getAmountsOut(amountIn) OVERSTATES the
   * result. Quote the net amount instead. Getting this backwards is a ~4%
   * error in the flattering direction, which is why it's computed here once
   * rather than at each call site.
   */
  const sellTaxBps = tax.sellBps
  const netIn =
    side === 'sell' && amountIn !== undefined && sellTaxBps !== undefined
      ? (amountIn * (BPS - BigInt(sellTaxBps))) / BPS
      : undefined

  const { data: sellAmounts, isFetching: quotingSell } = useReadContract({
    address: router,
    abi: v2RouterAbi,
    functionName: 'getAmountsOut',
    args: netIn !== undefined ? [netIn, path] : undefined,
    query: { enabled: live && side === 'sell' && netIn !== undefined && netIn > 0n, refetchInterval: 5_000 },
  })

  const routerOut =
    side === 'buy'
      ? buyGross
      : sellAmounts
        ? (sellAmounts as readonly bigint[]).at(-1)
        : undefined
  const quoting = side === 'buy' ? quotingBuy : quotingSell

  const buyTaxBps = tax.buyBps

  const quote: Quote | undefined = useMemo(() => {
    if (routerOut === undefined || amountIn === undefined) return undefined

    if (side === 'buy') {
      if (buyTaxBps === undefined) return undefined
      const t = BigInt(buyTaxBps)
      const expected = (routerOut * (BPS - t)) / BPS
      return {
        gross: routerOut,
        taxBps: buyTaxBps,
        expected,
        taxAmount: routerOut - expected,
        minOut: (expected * (BPS - BigInt(slippageBps))) / BPS,
      }
    }

    if (sellTaxBps === undefined || netIn === undefined) return undefined
    return {
      gross: routerOut,
      taxBps: sellTaxBps,
      expected: routerOut,
      taxAmount: amountIn - netIn,
      minOut: (routerOut * (BPS - BigInt(slippageBps))) / BPS,
    }
  }, [routerOut, amountIn, side, buyTaxBps, sellTaxBps, netIn, slippageBps])

  /* --- launch-hour wallet cap ------------------------------------------- */

  const { data: capData } = useReadContracts({
    contracts: [
      { address: higher, abi: higherAbi, functionName: 'maxWallet' },
      {
        address: higher,
        abi: higherAbi,
        functionName: 'launchReceived',
        args: account ? [account] : undefined,
      },
    ],
    query: { enabled: ready && !!account && tax.inLaunchWindow === true },
  })

  const maxWallet =
    capData?.[0]?.status === 'success' ? (capData[0].result as bigint) : undefined
  const received =
    capData?.[1]?.status === 'success' ? (capData[1].result as bigint) : undefined

  /** Headroom left under the cumulative launch-hour cap. */
  const capRemaining =
    tax.inLaunchWindow === true && maxWallet !== undefined && received !== undefined
      ? maxWallet > received
        ? maxWallet - received
        : 0n
      : undefined

  const exceedsCap =
    side === 'buy' &&
    capRemaining !== undefined &&
    quote !== undefined &&
    quote.expected > capRemaining

  /* --- allowance -------------------------------------------------------- */

  const { data: allowance, refetch: refetchAllowance } = useReadContract({
    address: tokenIn,
    abi: erc20Abi,
    functionName: 'allowance',
    args: account ? [account, router] : undefined,
    query: { enabled: ready && !!account && !!tokenIn, refetchInterval: 10_000 },
  })

  const needsApproval =
    tokenIn !== undefined &&
    amountIn !== undefined &&
    amountIn > 0n &&
    allowance !== undefined &&
    (allowance as bigint) < amountIn

  const config = useConfig()
  const [chainError, setChainError] = useState<string | undefined>()
  const { writeContract, data: hash, isPending, error: writeError, reset: resetWrite } =
    useWriteContract()
  const reset = useCallback(() => {
    setChainError(undefined)
    resetWrite()
  }, [resetWrite])
  /** Refuse to sign anywhere but Robinhood Chain (some wallets default to Ethereum). */
  const onChain = useCallback(async () => {
    try {
      await ensureChain(config)
      setChainError(undefined)
      return true
    } catch (e) {
      setChainError((e as Error).message)
      return false
    }
  }, [config])
  const { isLoading: mining, isSuccess } = useWaitForTransactionReceipt({ hash })

  const approve = useCallback(async () => {
    if (amountIn === undefined || tokenIn === undefined) return
    if (!(await onChain())) return
    /**
     * Approve slightly above the trade size. `transferFrom` reduces allowance
     * by `amount` while moving `removed <= amount` (rounding in the scaled
     * balance model), so an exact approval can leave the next swap a few wei
     * short. 1% over costs nothing and avoids an unlimited approval.
     */
    const padded = (amountIn * 101n) / 100n
    writeContract({
      chainId: activeChain.id,
      address: tokenIn,
      abi: erc20Abi,
      functionName: 'approve',
      args: [router, padded],
    })
  }, [amountIn, tokenIn, router, writeContract, onChain])

  const swap = useCallback(async () => {
    if (amountIn === undefined || quote === undefined || account === undefined) return
    if (!(await onChain())) return
    const deadline = BigInt(Math.floor(Date.now() / 1000)) + DEADLINE_SEC
    const p = path as Address[]
    if (asset === 'ETH' && side === 'buy') {
      writeContract({
        chainId: activeChain.id,
        address: router,
        abi: v2RouterAbi,
        functionName: 'swapExactETHForTokensSupportingFeeOnTransferTokens',
        args: [quote.minOut, p, account, deadline],
        value: amountIn,
      })
    } else if (asset === 'ETH') {
      writeContract({
        chainId: activeChain.id,
        address: router,
        abi: v2RouterAbi,
        functionName: 'swapExactTokensForETHSupportingFeeOnTransferTokens',
        args: [amountIn, quote.minOut, p, account, deadline],
      })
    } else {
      writeContract({
        chainId: activeChain.id,
        address: router,
        abi: v2RouterAbi,
        functionName: 'swapExactTokensForTokensSupportingFeeOnTransferTokens',
        args: [amountIn, quote.minOut, p, account, deadline],
      })
    }
  }, [amountIn, quote, account, router, path, asset, side, writeContract, onChain])

  // An approval that just landed must unlock the swap button without waiting for the next poll.
  useEffect(() => {
    if (isSuccess) void refetchAllowance()
  }, [isSuccess, refetchAllowance])

  const status: TradeStatus = writeError || chainError
    ? 'error'
    : isSuccess
      ? 'success'
      : isPending || mining
        ? needsApproval
          ? 'approving'
          : 'swapping'
        : 'idle'

  return {
    quote,
    quoting,
    /** True while a refetch is in flight — mark the number stale, don't block. */
    stale: quoting && quote !== undefined,
    /** Number of pools the trade crosses (each takes 0.3%). */
    hops: path.length - 1,
    needsApproval,
    approve,
    swap,
    status,
    error: chainError ?? writeError?.message,
    reset,
    refetchAllowance,
    capRemaining,
    exceedsCap,
    inLaunchWindow: tax.inLaunchWindow,
    taxCapBps: TAX_CAP_BPS,
    ready,
  }
}
