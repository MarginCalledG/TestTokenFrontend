import { useCallback, useState } from 'react'
import type { Address } from 'viem'
import { useAccount, useReadContract, useReadContracts, useWatchContractEvent } from 'wagmi'
import { irsAgentAbi } from '../abi'
import { addresses, configured } from '../config/addresses'
import { FEED_INTERVAL_SEC, type RankId } from '../config/protocol'
import { useChainClock } from './useChainClock'
import { useEpoch } from './useEpoch'
import { useActiveEpochs } from './useActiveEpochs'
import { DEMO, demo } from '../config/demo'

export type Agent = {
  id: bigint
  rank: RankId | null
  revealed: boolean
  dead: boolean
  alive: boolean
  lastFed: number
  starvesAt: number
  secondsUntilStarving: number
  lastAttackEpoch: number | null
  canAttackThisEpoch: boolean
  /** Total claimable across all still-open epochs. */
  pendingLastEpoch: bigint | undefined
  /** Which epochs that total came from, so each can be claimed individually. */
  claims: { epoch: number; amount: bigint }[]
}

/**
 * Roster comes from contract state via `agentsOf`, not wallet NFT enumeration.
 * `agentsOf` is an O(n) view — fine at prototype scale, and the swap to a
 * Transfer/Minted indexer is contained to this hook.
 */
export function useAgentRoster(account?: Address) {
  const { address: connected } = useAccount()
  const owner = account ?? connected
  const enabled = configured('irsAgent') && !!owner && !DEMO
  const { nowSec } = useChainClock(1000)
  const { epoch } = useEpoch()
  const { epochs: activeEpochs } = useActiveEpochs()
  const base = { address: addresses.irsAgent as Address, abi: irsAgentAbi } as const

  const { data: ids, refetch: refetchIds } = useReadContract({
    ...base,
    functionName: 'agentsOf',
    args: owner ? [owner] : undefined,
    query: { enabled, refetchInterval: 20_000 },
  })

  const idList = (ids ?? []) as readonly bigint[]
  /**
   * Check every epoch that still has claimable state, not just the last one.
   * A win two epochs old was previously invisible, and invisible plus an
   * expiry window means lost.
   */
  const claimEpochs =
    activeEpochs.length > 0
      ? activeEpochs
      : epoch !== undefined && epoch > 0
        ? [epoch - 1]
        : []

  const { data: details, refetch: refetchDetails } = useReadContracts({
    contracts: idList.flatMap((id) => [
      { ...base, functionName: 'agents', args: [id] } as const,
      { ...base, functionName: 'alive', args: [id] } as const,
      { ...base, functionName: 'revealed', args: [id] } as const,
      // tier() reverts with "unrevealed" until the mint epoch's seed exists — a
      // failed read here is the normal state of a fresh agent, not an error.
      { ...base, functionName: 'tier', args: [id] } as const,
      ...claimEpochs.map(
        (e) => ({ ...base, functionName: 'pending', args: [id, e] }) as const,
      ),
    ]),
    query: { enabled: enabled && idList.length > 0, refetchInterval: 15_000 },
  })

  const stride = 4 + claimEpochs.length
  const agents: Agent[] = idList.map((id, i) => {
    const info = details?.[i * stride]
    const aliveRes = details?.[i * stride + 1]
    /** Sum across every still-claimable epoch, plus which ones have value. */
    const claims = claimEpochs
      .map((e, k) => {
        const r = details?.[i * stride + 4 + k]
        const v = r?.status === 'success' ? (r.result as bigint) : 0n
        return { epoch: e, amount: v }
      })
      .filter((c) => c.amount > 0n)
    const pendingTotal = claims.reduce((sum, c) => sum + c.amount, 0n)

    // agents(id) = (uint40 lastFed, uint32 lastAtkEpoch1, bool dead, uint8 cachedTier, bool tierCached).
    // The rank is NOT in the struct until it is cached; tier(id) derives it from the seed.
    const tuple =
      info?.status === 'success'
        ? (info.result as unknown as readonly [number, number, boolean, number, boolean])
        : undefined
    const revRes = details?.[i * stride + 2]
    const tierRes = details?.[i * stride + 3]
    const revealed = revRes?.status === 'success' ? (revRes.result as boolean) : false
    const rank =
      tierRes?.status === 'success' ? (Number(tierRes.result) as RankId) : null
    const lastFed = tuple ? Number(tuple[0]) : 0
    const lastAttackEpoch = tuple ? Number(tuple[1]) : 0
    const dead = tuple ? tuple[2] : false
    const starvesAt = lastFed + FEED_INTERVAL_SEC

    return {
      id,
      rank,
      revealed,
      dead,
      alive: aliveRes?.status === 'success' ? (aliveRes.result as boolean) : !dead,
      lastFed,
      starvesAt,
      secondsUntilStarving: starvesAt - nowSec,
      lastAttackEpoch: lastAttackEpoch || null,
      // lastAtkEpoch1 is epoch+1 of the last attack (0 = never), see attack():
      // require(e + 1 > lastAtkEpoch1) — one attack per epoch.
      canAttackThisEpoch:
        epoch === undefined ? false : lastAttackEpoch !== epoch + 1,
      pendingLastEpoch: pendingTotal > 0n ? pendingTotal : undefined,
      claims,
    }
  })

  const refetch = useCallback(() => {
    void refetchIds()
    void refetchDetails()
  }, [refetchIds, refetchDetails])

  if (DEMO) {
    const demoAgents: Agent[] = demo.agents.map((d) => {
      const starvesAt = nowSec - d.fedAgo + FEED_INTERVAL_SEC
      return {
        id: d.id,
        rank: d.revealed ? (d.tier as RankId) : null,
        revealed: d.revealed,
        dead: d.dead,
        alive: !d.dead,
        lastFed: nowSec - d.fedAgo,
        starvesAt,
        secondsUntilStarving: starvesAt - nowSec,
        lastAttackEpoch: d.atkOffset ? demo.epoch + 1 : null,
        canAttackThisEpoch: d.atkOffset === 0 && d.revealed && !d.dead,
        pendingLastEpoch: d.pending,
        claims: d.pending > 0n ? [{ epoch: demo.epoch - 1, amount: d.pending }] : [],
      }
    })
    return {
      agents: demoAgents,
      living: demoAgents.filter((a) => a.alive),
      dead: demoAgents.filter((a) => !a.alive),
      refetch,
      configured: true,
    }
  }

  // alive() is false until the rank is revealed — an unrevealed agent is waiting, not dead.
  const isLiving = (a: Agent) => a.alive || (!a.revealed && !a.dead)
  return {
    agents,
    living: agents.filter(isLiving),
    dead: agents.filter((a) => !isLiving(a)),
    refetch,
    configured: enabled,
  }
}

export type PendingReveal = { id: bigint; rank: RankId }
export type PendingAudit = { id: bigint; epoch: number }

/**
 * Ranks are revealed once the mint epoch's seed exists (keeper reveal + post-close
 * block hash); TierRevealed fires when a rank is first cached (first attack/feed or
 * anyone calling cacheTier). Attacked only records the attack — whether it hit is
 * decided when the epoch is tallied, and shows up as a claimable prize.
 *
 * `useWatchContractEvent` falls back to polling `eth_getLogs` when the
 * transport has no websocket, which covers the RPC-only case.
 */
export function useAsyncResults(onChange?: () => void) {
  const [reveals, setReveals] = useState<PendingReveal[]>([])
  const [audits, setAudits] = useState<PendingAudit[]>([])
  const enabled = configured('irsAgent') && !DEMO

  useWatchContractEvent({
    address: addresses.irsAgent as Address,
    abi: irsAgentAbi,
    eventName: 'TierRevealed',
    enabled,
    poll: true,
    pollingInterval: 4_000,
    onLogs(logs) {
      const next = logs
        .map((l) => l.args)
        .filter((a): a is { id: bigint; tier: number } => 'tier' in a && a.id !== undefined && a.tier !== undefined)
        .map((a) => ({ id: a.id, rank: a.tier as RankId }))
      if (next.length) {
        setReveals((prev) => [...prev, ...next])
        onChange?.()
      }
    },
  })

  useWatchContractEvent({
    address: addresses.irsAgent as Address,
    abi: irsAgentAbi,
    eventName: 'Attacked',
    enabled,
    poll: true,
    pollingInterval: 4_000,
    onLogs(logs) {
      const next = logs
        .map((l) => l.args)
        .filter(
          (a): a is { id: bigint; epoch: number } =>
            a.id !== undefined && a.epoch !== undefined,
        )
      if (next.length) {
        setAudits((prev) => [...prev, ...next])
        onChange?.()
      }
    },
  })

  const clearReveal = (id: bigint) =>
    setReveals((prev) => prev.filter((r) => r.id !== id))
  const clearAudit = (id: bigint) => setAudits((prev) => prev.filter((a) => a.id !== id))

  return { reveals, audits, clearReveal, clearAudit }
}
