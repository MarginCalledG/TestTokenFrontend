import { parseAbi } from 'viem'

/**
 * Uniswap V2 router and pair. Standard interface, so these stay hand-written
 * rather than generated — on testnet these are RH-specific v2-compatible
 * deployments, on mainnet the official ones, and the interface is identical
 * either way.
 */
export const v2RouterAbi = parseAbi([
  'function factory() view returns (address)',
  'function getAmountsOut(uint256 amountIn, address[] path) view returns (uint256[] amounts)',
  'function swapExactTokensForTokensSupportingFeeOnTransferTokens(uint256 amountIn, uint256 amountOutMin, address[] path, address to, uint256 deadline)',
])

export const v2PairAbi = parseAbi([
  'function token0() view returns (address)',
  'function token1() view returns (address)',
  'function getReserves() view returns (uint112 reserve0, uint112 reserve1, uint32 blockTimestampLast)',
])
