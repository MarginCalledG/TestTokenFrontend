import type { Address } from 'viem'
import { useReadContract, useReadContracts } from 'wagmi'
import { irsAgentAbi } from '../abi'
import { addresses, configured } from '../config/addresses'
import { DEMO, demo } from '../config/demo'

/**
 * Epochs that still hold claimable state.
 *
 * Until now the roster only checked `pending(id, currentEpoch - 1)`, so a win
 * from two epochs ago was invisible — and since winnings expire after
 * CLAIM_WINDOW, invisible meant lost. `activeEpochs` enumerates exactly the
 * epochs with something left in them, which closes that gap without needing an
 * event indexer.
 *
 * Capped at MAX_TRACKED because each epoch multiplies the per-agent `pending`
 * reads. The cap takes the most recent entries, which are the ones furthest
 * from expiring and therefore the ones still worth claiming.
 */
const MAX_TRACKED = 6

export function useActiveEpochs() {
  const enabled = configured('irsAgent') && !DEMO
  const base = { address: addresses.irsAgent as Address, abi: irsAgentAbi } as const

  const { data: cursor } = useReadContract({
    ...base,
    functionName: 'activeCursor',
    query: { enabled, refetchInterval: 30_000 },
  })

  const count = cursor === undefined ? 0 : Number(cursor)
  const start = Math.max(0, count - MAX_TRACKED)
  const indexes = Array.from({ length: Math.max(0, count - start) }, (_, i) => start + i)

  const { data } = useReadContracts({
    contracts: indexes.map(
      (i) => ({ ...base, functionName: 'activeEpochs', args: [BigInt(i)] }) as const,
    ),
    query: { enabled: enabled && indexes.length > 0, refetchInterval: 30_000 },
  })

  if (DEMO) return { epochs: [demo.epoch - 1], truncated: false }

  const epochs = (data ?? [])
    .filter((r) => r.status === 'success')
    .map((r) => Number(r.result))
    .sort((a, b) => b - a)

  return { epochs, truncated: count > MAX_TRACKED }
}
