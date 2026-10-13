import type { Address } from 'viem'
import { useReadContracts } from 'wagmi'
import { irsAgentAbi, seedAbi } from '../abi'
import { addresses, configured } from '../config/addresses'
import { DEMO, demo } from '../config/demo'

/**
 * The pot as the agent contract sees it, plus the two switches that decide
 * whether an attack can be placed at all.
 *
 * `potPreview()` is what this epoch's raids compete for. Prizes already won
 * but not yet claimed are excluded by the vault itself (they melt with the
 * winner, not with the pot).
 *
 * `bondOk()` on the seed source: attacks are refused protocol-wide while the
 * keeper's bond is below the pot. That is not a per-player condition, so the
 * screen has to say it out loud rather than let every Attack button revert.
 */
export function useAgentPot() {
  const agent = { address: addresses.irsAgent as Address, abi: irsAgentAbi } as const
  const seed = { address: addresses.seed as Address, abi: seedAbi } as const

  const { data } = useReadContracts({
    contracts: [
      { ...agent, functionName: 'potPreview' },
      { ...agent, functionName: 'paused' },
      { ...seed, functionName: 'bondOk' },
      { ...agent, functionName: 'refundsReady' },
    ],
    query: { enabled: configured('irsAgent', 'seed') && !DEMO, refetchInterval: 15_000 },
  })

  if (DEMO) {
    return { potPreview: demo.potBalance, paused: false, bondOk: true, refundsReady: true }
  }

  const ok = (i: number) => data?.[i]?.status === 'success'
  return {
    potPreview: ok(0) ? (data![0].result as bigint) : undefined,
    /**
     * The owner can halt the game. Minting, feeding and attacking stop while
     * feed timers keep running — so a pause can cost you agents you already
     * paid for. Stated rather than left to be discovered.
     */
    paused: ok(1) ? (data![1].result as boolean) : undefined,
    bondOk: ok(2) ? (data![2].result as boolean) : undefined,
    refundsReady: ok(3) ? (data![3].result as boolean) : undefined,
  }
}
