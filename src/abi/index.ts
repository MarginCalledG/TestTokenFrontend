/* ===========================================================================
 * Real ABIs, generated from the Foundry artifacts as `as const` modules —
 * JSON imports lose the literal types wagmi needs to infer call signatures.
 * Regenerate with: python3 frontend/scripts/gen-abi.py (after `forge build`).
 *
 * Trading is Uniswap V2 with HIGHER directly in the HIGHER/SPY pair — no wrapper,
 * one hop. The tax lives in the token; its rate is previewed via TwapOracle.taxBps().
 * =========================================================================== */

import { parseAbi } from 'viem'

export { higherAbi } from './Higher'
export { caymanAbi } from './CaymanIslands'
export { irsAgentAbi } from './IRSAgent'
export { twapOracleAbi } from './TwapOracle'
export { seedAbi } from './HashChainSeed'
export { v2RouterAbi, v2PairAbi } from './V2'

/** Plain ERC20, for USDG and SPY. */
export const erc20Abi = parseAbi([
  'function name() view returns (string)',
  'function symbol() view returns (string)',
  'function decimals() view returns (uint8)',
  'function totalSupply() view returns (uint256)',
  'function balanceOf(address) view returns (uint256)',
  'function allowance(address owner, address spender) view returns (uint256)',
  'function approve(address spender, uint256 amount) returns (bool)',
  'function transfer(address to, uint256 amount) returns (bool)',
  'event Transfer(address indexed from, address indexed to, uint256 value)',
])
