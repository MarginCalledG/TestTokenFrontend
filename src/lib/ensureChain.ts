import type { Config } from 'wagmi'
import { getAccount, switchChain } from 'wagmi/actions'
import { activeChain } from '../config/chains'

export const WRONG_CHAIN_HELP =
  `Your wallet is not on ${activeChain.name} (chain ${activeChain.id}). ` +
  `Switch the network in your wallet and try again. Phantom: Settings → Active Networks → enable Robinhood Chain, ` +
  `then select it for this site. If the wallet cannot switch, use MetaMask or Rabby.`

/**
 * Every write must land on Robinhood Chain. Some wallets (Phantom in particular) answer the dApp
 * on Ethereum by default and would otherwise sign the transaction there — same addresses, wrong
 * chain, and on Ethereum those addresses are not our contracts. Switch first, verify, refuse otherwise.
 */
export async function ensureChain(config: Config): Promise<void> {
  if (getAccount(config).chainId === activeChain.id) return
  try {
    await switchChain(config, { chainId: activeChain.id })
  } catch {
    /* fall through to the check below */
  }
  if (getAccount(config).chainId !== activeChain.id) throw new Error(WRONG_CHAIN_HELP)
}
