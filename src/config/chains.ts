import { defineChain } from 'viem'

/**
 * Robinhood Chain. Values supplied by the protocol team; native currency
 * symbol/decimals are assumed to be ETH/18 — VERIFY against the RH Chain dev
 * docs before mainnet, it only affects gas display but it is user-visible.
 */
export const rhTestnet = defineChain({
  id: 46630,
  name: 'Robinhood Chain Testnet',
  nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
  rpcUrls: {
    default: { http: ['https://rpc.testnet.chain.robinhood.com/rpc'] },
  },
  blockExplorers: {
    default: {
      name: 'RH Chain Testnet Explorer',
      url: 'https://explorer.testnet.chain.robinhood.com',
    },
  },
  testnet: true,
})

export const rhMainnet = defineChain({
  id: 4663,
  name: 'Robinhood Chain',
  nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
  rpcUrls: {
    // VITE_RPC_URL overrides the public endpoint (dedicated RPC in production, a fork in tests).
    default: { http: [import.meta.env.VITE_RPC_URL || 'https://rpc.mainnet.chain.robinhood.com'] },
  },
  blockExplorers: {
    default: {
      name: 'Blockscout',
      url: 'https://robinhoodchain.blockscout.com',
    },
  },
})

export const FAUCET_URL = 'https://faucet.testnet.chain.robinhood.com'

const selected = import.meta.env.VITE_CHAIN === 'testnet' ? 'testnet' : 'mainnet'

export const activeChain = selected === 'mainnet' ? rhMainnet : rhTestnet
export const isTestnet = selected === 'testnet'

export function explorerTx(hash: string) {
  return `${activeChain.blockExplorers.default.url}/tx/${hash}`
}

export function explorerAddress(address: string) {
  return `${activeChain.blockExplorers.default.url}/address/${address}`
}
