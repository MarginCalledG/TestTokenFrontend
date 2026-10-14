import { useQuery } from '@tanstack/react-query'

/**
 * The indexer on the keeper server records what the contracts cannot answer about the past.
 * In production it is reached through a Netlify proxy at /api (see netlify.toml), so the
 * browser never talks to the server directly and the site stays on https.
 */
const BASE = (import.meta.env.VITE_INDEXER_URL as string | undefined) ?? '/api'

export type Snap = {
  t: number
  supply: number
  pool: number
  locked: [number, number, number]
  pot: number
  rateBps: number
  priceUsd: number
  spyUsd: number
  ethUsd: number
  liquidityUsd: number
  holders: number | null
  agentsAlive: number
  agentsMinted: number
  reserveUsd: number
}
export type Round = { epoch: number; start: number; audits: number; agents: number[]; claimed: number }
export type AgentEvent = {
  t: number
  type: 'minted' | 'revealed' | 'audit' | 'claimed' | 'died'
  id: number
  epoch?: number
  amount?: number
  tier?: number
  owner?: string
}
export type LockEvent = { t: number; type: 'lock' | 'withdraw'; user: string; tier: number; amount: number }
export type History = {
  updatedAt: number
  block: number
  holders: number | null
  launchSupply: number
  price: [number, number | null][]
  snaps: Snap[]
  rounds: Round[]
  agentEvents: AgentEvent[]
  lockEvents: LockEvent[]
}

export function useHistory() {
  return useQuery({
    queryKey: ['indexer-history'],
    queryFn: async (): Promise<History> => {
      const r = await fetch(`${BASE}/history`)
      if (!r.ok) throw new Error(`indexer ${r.status}`)
      return (await r.json()) as History
    },
    refetchInterval: 60_000,
    retry: 1,
  })
}
