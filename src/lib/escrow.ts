/**
 * ArcEscrow contract config.
 * Address is set post-deploy via VITE_ESCROW_CONTRACT.
 * USDC address is read from @/onchain-facts — never hardcoded here.
 */

// ABI derived from contracts/ArcEscrow.sol
export const ESCROW_ABI = [
  {
    type: 'constructor',
    inputs: [{ name: 'usdc_', type: 'address' }],
    stateMutability: 'nonpayable',
  },
  { type: 'error', name: 'ZeroAmount', inputs: [] },
  { type: 'error', name: 'ZeroAddress', inputs: [] },
  { type: 'error', name: 'InvalidSeller', inputs: [] },
  { type: 'error', name: 'Unauthorized', inputs: [] },
  { type: 'error', name: 'InvalidState', inputs: [] },
  { type: 'error', name: 'NotFound', inputs: [] },
  {
    type: 'event',
    name: 'EscrowCreated',
    inputs: [
      { name: 'escrowId', type: 'uint256', indexed: true },
      { name: 'buyer', type: 'address', indexed: true },
      { name: 'seller', type: 'address', indexed: true },
      { name: 'amount', type: 'uint256', indexed: false },
    ],
  },
  {
    type: 'event',
    name: 'EscrowReleased',
    inputs: [
      { name: 'escrowId', type: 'uint256', indexed: true },
      { name: 'buyer', type: 'address', indexed: true },
      { name: 'seller', type: 'address', indexed: true },
      { name: 'amount', type: 'uint256', indexed: false },
    ],
  },
  {
    type: 'event',
    name: 'EscrowCancelled',
    inputs: [
      { name: 'escrowId', type: 'uint256', indexed: true },
      { name: 'buyer', type: 'address', indexed: true },
      { name: 'seller', type: 'address', indexed: true },
      { name: 'amount', type: 'uint256', indexed: false },
    ],
  },
  {
    type: 'event',
    name: 'SellerUpdated',
    inputs: [
      { name: 'escrowId', type: 'uint256', indexed: true },
      { name: 'buyer', type: 'address', indexed: true },
      { name: 'newSeller', type: 'address', indexed: true },
    ],
  },
  {
    type: 'function',
    name: 'createEscrow',
    inputs: [
      { name: 'seller', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    outputs: [{ name: 'escrowId', type: 'uint256' }],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'releaseEscrow',
    inputs: [{ name: 'escrowId', type: 'uint256' }],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'cancelEscrow',
    inputs: [{ name: 'escrowId', type: 'uint256' }],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'updateSeller',
    inputs: [
      { name: 'escrowId', type: 'uint256' },
      { name: 'newSeller', type: 'address' },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'getEscrow',
    inputs: [{ name: 'escrowId', type: 'uint256' }],
    outputs: [
      {
        name: '',
        type: 'tuple',
        components: [
          { name: 'buyer', type: 'address' },
          { name: 'seller', type: 'address' },
          { name: 'amount', type: 'uint256' },
          { name: 'state', type: 'uint8' },
        ],
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'escrowCount',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'usdc',
    inputs: [],
    outputs: [{ name: '', type: 'address' }],
    stateMutability: 'view',
  },
] as const

export const ESCROW_STATE_LABELS: Record<number, string> = {
  0: 'Pending',
  1: 'Released',
  2: 'Cancelled',
}

/** Returns the contract address from env, or undefined if not yet deployed. */
export function getEscrowAddress(): `0x${string}` | undefined {
  const addr = import.meta.env.VITE_ESCROW_CONTRACT as string | undefined
  if (!addr || addr === '' || addr === '0x') return undefined
  return addr as `0x${string}`
}

/** Parse a contract revert into a friendly message. */
export function parseEscrowError(error: unknown): string {
  const msg = (error as { message?: string })?.message?.toLowerCase() ?? ''
  if (msg.includes('user rejected') || msg.includes('user denied')) return 'Transaction cancelled.'
  if (msg.includes('zeroamount')) return 'Amount must be greater than zero.'
  if (msg.includes('zeroaddress')) return 'Address cannot be zero.'
  if (msg.includes('invalidseller')) return 'Seller address is invalid (zero, self, or precompile range).'
  if (msg.includes('unauthorized')) return 'Only the buyer can perform this action.'
  if (msg.includes('invalidstate')) return 'This escrow is not in the Pending state.'
  if (msg.includes('notfound')) return 'Escrow not found.'
  if (msg.includes('insufficient funds') || msg.includes('exceeds balance')) return 'Insufficient USDC balance.'
  if (msg.includes('insufficient allowance') || msg.includes('erc20: transfer amount exceeds allowance'))
    return 'Insufficient USDC allowance. Please approve first.'
  if (msg.includes('reverted')) return 'Transaction reverted. Check your inputs and balance.'
  if (msg.includes('network') || msg.includes('timeout')) return 'Network error. Please retry.'
  return 'Something went wrong. Please try again.'
}
