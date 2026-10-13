import { createConfig, http } from 'wagmi'
import { injected } from 'wagmi/connectors'
import { activeChain, rhMainnet, rhTestnet } from './chains'

/**
 * Only the active chain is offered to the wallet, but transports are declared
 * for both so flipping VITE_CHAIN is a one-line env change.
 */
export const wagmiConfig = createConfig({
  chains: [activeChain],
  connectors: [injected()],
  transports: {
    [rhMainnet.id]: http(rhMainnet.rpcUrls.default.http[0]),
    [rhTestnet.id]: http(rhTestnet.rpcUrls.default.http[0]),
  },
})

declare module 'wagmi' {
  interface Register {
    config: typeof wagmiConfig
  }
}
