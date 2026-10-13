import type { Address } from 'viem'
import { useReadContract, useReadContracts } from 'wagmi'
import { irsAgentAbi } from '../abi'
import { addresses, configured } from '../config/addresses'
import { EPOCH_SEC } from '../config/protocol'
import { useChainClock } from './useChainClock'
import { DEMO, demo } from '../config/demo'

/**
 * Epoch timing now comes from the contract. `epochEnd(e)` returns the exact
 * timestamp an epoch closes, which replaces the arithmetic this hook used to
 * do from startTime and EPOCH — and with it the guess about whether epoch
 * numbering starts at 0 or 1. That guess drove when the Audit button
 * unlocked, so getting it wrong was not cosmetic.
 *
 * Settlement needs the keeper: after an epoch closes it captures the post-close
 * block hash, tallies and settles (usually within a few minutes). Only then is
 * anything claimable.
 */
export function useEpoch() {
  const enabled = configured('irsAgent') && !DEMO
  const base = { address: addresses.irsAgent as Address, abi: irsAgentAbi } as const
  const { nowSec } = useChainClock(1000)

  const { data } = useReadContracts({
    contracts: [
      { ...base, functionName: 'currentEpoch' },
      { ...base, functionName: 'EPOCH' },
      { ...base, functionName: 'startTime' },
      { ...base, functionName: 'CLAIM_WINDOW' },
      { ...base, functionName: 'settledThrough' },
    ],
    query: { enabled, refetchInterval: 15_000 },
  })

  const epoch = data?.[0].status === 'success' ? Number(data[0].result) : undefined
  const epochSec = data?.[1].status === 'success' ? Number(data[1].result) : EPOCH_SEC
  const startTime = data?.[2].status === 'success' ? Number(data[2].result) : undefined
  /**
   * How many epochs you have to claim a win before anyone can call
   * sweepStale() and it's gone. Winnings expiring is not something a user
   * would assume, so it has to be stated rather than left to be discovered.
   */
  const claimWindow = data?.[3]?.status === 'success' ? Number(data[3].result) : undefined
  /** Every epoch below this number is settled and claimable. */
  const settledThrough = data?.[4]?.status === 'success' ? Number(data[4].result) : undefined

  // Exact close time, straight from the contract.
  const { data: endData } = useReadContract({
    ...base,
    functionName: 'epochEnd',
    args: epoch !== undefined ? [epoch] : undefined,
    query: { enabled: enabled && epoch !== undefined, refetchInterval: 30_000 },
  })

  const endsAt = endData !== undefined ? Number(endData) : undefined

  if (DEMO) {
    const end = demo.epochStart + (demo.epoch + 1) * demo.epochSec
    return {
      claimWindow: 90,
      settledThrough: demo.epoch,
      epoch: demo.epoch,
      epochSec: demo.epochSec,
      startTime: demo.epochStart,
      endsAt: end,
      secondsRemaining: end - nowSec,
      configured: true,
    }
  }

  return {
    claimWindow,
    settledThrough,
    epoch,
    epochSec,
    startTime,
    endsAt,
    secondsRemaining: endsAt === undefined ? undefined : endsAt - nowSec,
    configured: enabled,
  }
}
