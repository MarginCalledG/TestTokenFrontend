import type { Address } from 'viem'
import { useAccount, useReadContracts } from 'wagmi'
import { caymanAbi } from '../abi'
import { addresses, configured } from '../config/addresses'
import { LOCK_TIERS, type TierId } from '../config/protocol'
import { useChainClock } from './useChainClock'
import { DEMO, demo } from '../config/demo'

export type LockPosition = {
  tier: TierId
  /** What you could withdraw now — bleed already applied. */
  amount: bigint
  /** What you originally locked. Differs from `amount` by the bleed. */
  principal: bigint
  lockedAt: number
  /** Unlock timestamp in seconds, 0 when there is no position. */
  unlockAt: number
  /** Fee to open/renew, in USDG base units, straight from the contract. */
  fee: bigint | undefined
  durationSec: number | undefined
  hasPosition: boolean
  isExpired: boolean
  secondsRemaining: number
}

export function useLockPositions(account?: Address) {
  const { address: connected } = useAccount()
  const owner = account ?? connected
  const enabled = configured('cayman') && !!owner && !DEMO
  const { nowSec } = useChainClock(1000)
  const base = { address: addresses.cayman as Address, abi: caymanAbi } as const

  const { data, isLoading, refetch } = useReadContracts({
    contracts: [
      ...LOCK_TIERS.flatMap((t) => [
        { ...base, functionName: 'claimOf', args: [owner as Address, t.id] } as const,
        // position() returns principal, lockedAt and unlockAt together. Kept
        // alongside claimOf because they answer different questions: claimOf is
        // what you'd get out now (bleed already applied), principal is what you
        // put in. Showing only one of them would hide the loss.
        { ...base, functionName: 'position', args: [owner as Address, t.id] } as const,
        { ...base, functionName: 'FEE', args: [t.id] } as const,
        { ...base, functionName: 'DURATION', args: [t.id] } as const,
      ]),
      { ...base, functionName: 'potBalance' } as const,
      // potBalance() is what has actually been collected. Bleed from open
      // positions only lands in the pot when someone calls harvest, so
      // potLive() — collected plus accrued-but-unharvested — is the figure
      // that describes what agents are really competing for. Showing the
      // smaller number would understate the pot.
      { ...base, functionName: 'potLive' } as const,
      { ...base, functionName: 'MIN_LOCK' } as const,
      // Principal sitting in positions whose lock has run out. This is the
      // slice of user money currently paying the 2%/day expiry penalty into
      // the pot — money being lost to inattention rather than to a choice.
      { ...base, functionName: 'expiredPrincipal' } as const,
    ],
    query: { enabled, refetchInterval: 10_000 },
  })

  if (DEMO) {
    const demoPositions: LockPosition[] = LOCK_TIERS.map((t, i) => {
      const d = demo.locks[i]
      const hasPosition = d.amount > 0n
      const secondsRemaining = d.unlockAt - nowSec
      return {
        tier: t.id as TierId,
        amount: d.amount,
        principal: d.amount,
        lockedAt: d.unlockAt - 86_400,
        unlockAt: d.unlockAt,
        fee: demo.fees[i],
        durationSec: demo.durations[i],
        hasPosition,
        isExpired: hasPosition && secondsRemaining <= 0,
        secondsRemaining,
      }
    })
    return {
      positions: demoPositions,
      potBalance: demo.potBalance,
      potSettled: demo.potBalance,
      minLock: 1000000000000000000n,
      expiredPrincipal: 41200000000000000000000n,
      isLoading: false,
      refetch,
      configured: true,
    }
  }

  const positions: LockPosition[] = LOCK_TIERS.map((t, i) => {
    const at = (n: number) => data?.[i * 4 + n]
    const amount = at(0)?.status === 'success' ? (at(0)!.result as bigint) : 0n
    const pos =
      at(1)?.status === 'success'
        ? (at(1)!.result as readonly [bigint, bigint, bigint])
        : undefined
    const principal = pos ? pos[0] : 0n
    const lockedAt = pos ? Number(pos[1]) : 0
    const unlockAt = pos ? Number(pos[2]) : 0
    const fee = at(2)?.status === 'success' ? (at(2)!.result as bigint) : undefined
    const durationSec =
      at(3)?.status === 'success' ? Number(at(3)!.result as bigint) : undefined

    const hasPosition = amount > 0n
    const secondsRemaining = unlockAt - nowSec
    return {
      tier: t.id as TierId,
      amount,
      principal,
      lockedAt,
      unlockAt,
      fee,
      durationSec,
      hasPosition,
      isExpired: hasPosition && unlockAt > 0 && secondsRemaining <= 0,
      secondsRemaining,
    }
  })

  const potIndex = LOCK_TIERS.length * 4
  const potSettled =
    data?.[potIndex]?.status === 'success' ? (data[potIndex].result as bigint) : undefined
  const potLive =
    data?.[potIndex + 1]?.status === 'success'
      ? (data[potIndex + 1].result as bigint)
      : undefined

  const minLock =
    data?.[potIndex + 2]?.status === 'success'
      ? (data[potIndex + 2].result as bigint)
      : undefined

  const expiredPrincipal =
    data?.[potIndex + 3]?.status === 'success'
      ? (data[potIndex + 3].result as bigint)
      : undefined

  return {
    positions,
    /** Smallest amount the contract will accept. Below it, lock() reverts. */
    minLock,
    expiredPrincipal,
    /** Live figure — use this for display. */
    potBalance: potLive ?? potSettled,
    /** Collected only, excludes unharvested bleed. */
    potSettled,
    isLoading,
    refetch,
    configured: enabled,
  }
}
