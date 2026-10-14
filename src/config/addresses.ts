import type { Address } from 'viem'
import { isAddress } from 'viem'
import { isTestnet } from './chains'
import { DEMO } from './demo'

/**
 * Nothing is deployed yet. Every address here is read from env and may be
 * blank. `configured()` lets a screen say "not deployed yet" instead of
 * firing eth_calls at the zero address and rendering plausible-looking zeros —
 * a UI that shows 0.00 when it actually means "no contract" is a §7 problem.
 */
function env(key: string): Address | null {
  const raw = import.meta.env[key as keyof ImportMetaEnv] as string | undefined
  if (!raw) return null
  if (!isAddress(raw)) {
    console.warn(`[config] ${key} is not a valid address: ${raw}`)
    return null
  }
  return raw as Address
}

/** USDG on RH Chain mainnet, per docs.robinhood.com/chain/contracts. */
const USDG_MAINNET = '0x5fc5360D0400a0Fd4f2af552ADD042D716F1d168' as Address
/** WETH on RH Chain mainnet, same source. Kept for router paths. */
export const WETH_MAINNET = '0x0Bd7D308f8E1639FAb988df18A8011f41EAcAD73' as Address

/**
 * Live mainnet test deployment (chain 4663), source-verified on Sourcify.
 * Used when VITE_CHAIN is mainnet (the default) and the env var is blank, so a
 * plain `npm run build` points at the real contracts. Override per variable in .env.
 */
const MAINNET: Record<string, Address> = {
  higher: '0x3531F8cc8231062Af78aCa08B21f101DBeAEbf05',
  cayman: '0x00152AB5D5Af491fBC854C0868a03EB1bB82bEFC',
  irsAgent: '0xDfA844D9fF12783F7d75B4E715355b22ab25395d',
  twapOracle: '0xAC3995593e48f5513E97328A72200f2a19b0257E',
  seed: '0x394e3a325dE9dDd48F8CFA38306cF7479CA68285',
  router: '0x89e5DB8B5aA49aA85AC63f691524311AEB649eba',
  pair: '0x11A92E6D1059d58a6A70EE3F1B01Fa36980fF57f',
  spy: '0x117cc2133c37B721F49dE2A7a74833232B3B4C0C',
  usdg: USDG_MAINNET,
  weth: WETH_MAINNET,
  /** Uniswap v2 SPY/USDG and WETH/USDG — the ETH route and the $ prices go through these. */
  spyUsdgPair: '0xE59087890579AfEC2CC316c7Db230B2d0945569F',
  wethUsdgPair: '0x8803c117ccae7B5146297876c2A25DF135141C4d',
}
const pick = (key: string, name: keyof typeof MAINNET) => env(key) ?? (isTestnet ? null : MAINNET[name])

export const addresses = {
  higher: pick('VITE_HIGHER_ADDRESS', 'higher'),
  cayman: pick('VITE_CAYMAN_ADDRESS', 'cayman'),
  irsAgent: pick('VITE_IRSAGENT_ADDRESS', 'irsAgent'),
  twapOracle: pick('VITE_TWAPORACLE_ADDRESS', 'twapOracle'),
  /** HashChainSeed — the agents' randomness source and keeper bond. */
  seed: pick('VITE_SEED_ADDRESS', 'seed'),
  router: pick('VITE_ROUTER_ADDRESS', 'router'),
  pair: pick('VITE_PAIR_ADDRESS', 'pair'),
  spy: pick('VITE_SPY_ADDRESS', 'spy'),
  usdg: pick('VITE_USDG_ADDRESS', 'usdg'),
  weth: pick('VITE_WETH_ADDRESS', 'weth'),
  spyUsdgPair: pick('VITE_SPY_USDG_PAIR', 'spyUsdgPair'),
  wethUsdgPair: pick('VITE_WETH_USDG_PAIR', 'wethUsdgPair'),
} as const

/**
 * No wrapper. HIGHER sits directly in the V2 pair and the tax lives in the
 * token, so a trade is one hop through the router and approvals go to the
 * router. The wHIGHER/Zap route was removed from the contracts.
 */
export const tradesThroughWrapper = false

export type ContractKey = keyof typeof addresses

export function configured(...keys: ContractKey[]): boolean {
  if (DEMO) return true
  return keys.every((k) => addresses[k] !== null)
}

/** Which required addresses are still missing — used by the setup banner. */
export function missing(...keys: ContractKey[]): ContractKey[] {
  if (DEMO) return []
  return keys.filter((k) => addresses[k] === null)
}
