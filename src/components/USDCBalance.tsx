import { useAccount, useReadContract } from 'wagmi'
import { erc20Abi } from 'viem'
import { arcMainnet } from '@/config'
import { getUsdc } from '@/onchain-facts'
import { Amount } from '@/onchain-money'

const CHAIN_ID = arcMainnet.id
const usdcFact = getUsdc(CHAIN_ID)!
const USDC_ADDRESS = usdcFact.address as `0x${string}`

export default function USDCBalance() {
  const { address, isConnected } = useAccount()

  const { data: rawBalance, isLoading } = useReadContract({
    address: USDC_ADDRESS,
    abi: erc20Abi,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
    chainId: CHAIN_ID,
    query: { enabled: !!address && isConnected },
  })

  if (!isConnected) return null

  const formatted = rawBalance !== undefined
    ? Amount.fromRaw(rawBalance, usdcFact.decimals).toFixed(2)
    : null

  return (
    <div
      className="mx-auto mb-5 max-w-lg rounded-2xl px-5 py-4"
      style={{ background: 'rgba(255,255,255,0.72)', backdropFilter: 'blur(20px)', border: '1px solid var(--border)' }}
    >
      <p className="mb-0.5 text-xs font-semibold tracking-wide" style={{ color: 'var(--muted)' }}>YOUR USDC BALANCE</p>
      <div className="flex items-baseline gap-1.5">
        <span className="display text-3xl font-bold tabular-nums" style={{ color: 'var(--ink)' }}>
          {isLoading ? '...' : (formatted ?? '0.00')}
        </span>
        <span className="text-base font-medium" style={{ color: 'var(--subtle)' }}>USDC</span>
      </div>
      <p className="mt-1 text-xs" style={{ color: 'var(--subtle)' }}>Arc Mainnet · ERC-20 view</p>
    </div>
  )
}
