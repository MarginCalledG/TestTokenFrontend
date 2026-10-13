import { useCallback, useState } from 'react'
import type { Address } from 'viem'
import { BaseError } from 'viem'
import { useAccount, useConfig } from 'wagmi'
import { readContract, waitForTransactionReceipt, writeContract } from 'wagmi/actions'
import { erc20Abi } from '../abi'
import { activeChain } from '../config/chains'
import { ensureChain } from '../lib/ensureChain'

export type TxStatus = 'idle' | 'approving' | 'sending' | 'success' | 'error'
export type TxState = { status: TxStatus; label?: string; hash?: string; error?: string }

/** An ERC20 approval that has to be in place before the call. Skipped when the allowance already covers it. */
export type Approval = { token: Address; spender: Address; amount: bigint; symbol: string }

/**
 * Generic write path for every action that is not a swap: optional approvals,
 * then one contract call, each waited on until mined. One state object per
 * screen, so the user sees exactly one "in progress / done / failed" line.
 *
 * The call is typed loosely on purpose — wagmi's per-ABI generics do not
 * survive being passed through a shared helper, and the screens that build the
 * call already use the typed ABIs.
 */
export function useTx(onDone?: () => void) {
  const config = useConfig()
  const { address } = useAccount()
  const [state, setState] = useState<TxState>({ status: 'idle' })

  const run = useCallback(
    async (
      label: string,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      call: { address: Address; abi: any; functionName: string; args?: readonly unknown[]; value?: bigint },
      approvals: Approval[] = [],
    ) => {
      if (!address) {
        setState({ status: 'error', label, error: 'Connect a wallet first.' })
        return false
      }
      try {
        await ensureChain(config)
        for (const a of approvals) {
          const have = (await readContract(config, {
            address: a.token,
            abi: erc20Abi,
            functionName: 'allowance',
            args: [address, a.spender],
          })) as bigint
          if (have >= a.amount) continue
          setState({ status: 'approving', label: `Approve ${a.symbol}` })
          const h = await writeContract(config, {
            chainId: activeChain.id,
            address: a.token,
            abi: erc20Abi,
            functionName: 'approve',
            args: [a.spender, a.amount],
          })
          const r = await waitForTransactionReceipt(config, { hash: h })
          if (r.status !== 'success') throw new Error(`${a.symbol} approval reverted`)
        }
        setState({ status: 'sending', label })
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const hash = await writeContract(config, { ...call, chainId: activeChain.id } as any)
        setState({ status: 'sending', label, hash })
        const rc = await waitForTransactionReceipt(config, { hash })
        if (rc.status !== 'success') throw new Error('Transaction reverted')
        setState({ status: 'success', label, hash })
        onDone?.()
        return true
      } catch (e) {
        setState({ status: 'error', label, error: errorText(e) })
        onDone?.()
        return false
      }
    },
    [address, config, onDone],
  )

  const reset = useCallback(() => setState({ status: 'idle' }), [])
  const busy = state.status === 'approving' || state.status === 'sending'
  return { state, run, reset, busy }
}

/** The revert reason if there is one ("max wallet", "dead", "cooldown" …), else the short message. */
export function errorText(e: unknown): string {
  if (e instanceof BaseError) {
    if (/chain|ChainMismatch/i.test(e.name) || /does not match the target chain/i.test(e.message)) return e.shortMessage
    const reason = (e.walk((x) => 'reason' in (x as object)) as { reason?: string } | null)?.reason
    if (reason) return reason
    return e.shortMessage
  }
  return e instanceof Error ? e.message.split('\n')[0] : String(e)
}
