import { ConnectKitButton } from 'connectkit'
import { useAccount, useSwitchChain } from 'wagmi'
import { arcMainnet } from '@/config'
import { AlertCircle } from 'lucide-react'

const TARGET_CHAIN_ID = arcMainnet.id

export default function EscrowHeader() {
  const { chainId, isConnected } = useAccount()
  const { switchChain } = useSwitchChain()
  const wrongChain = isConnected && chainId !== TARGET_CHAIN_ID

  return (
    <header className="sticky top-0 z-30 w-full" style={{ background: 'rgba(255,255,255,0.80)', backdropFilter: 'blur(20px)', borderBottom: '1px solid var(--border)' }}>
      <div className="mx-auto flex max-w-lg items-center justify-between px-4 py-3">
        <div>
          <span className="display text-lg font-bold" style={{ color: 'var(--ink)' }}>ArcEscrow</span>
          <span className="ml-2 rounded-full px-2 py-0.5 text-xs font-semibold" style={{ background: 'rgba(18,45,69,0.08)', color: 'var(--muted)' }}>Mainnet</span>
        </div>
        <ConnectKitButton />
      </div>
      {wrongChain && (
        <div className="flex items-center justify-between px-4 py-2 text-xs font-semibold" style={{ background: 'rgba(186,43,76,0.08)', color: 'var(--danger)'}}>
          <span className="flex items-center gap-1.5">
            <AlertCircle className="size-3.5" />
            Wrong network. Switch to Arc Mainnet to continue.
          </span>
          <button
            onClick={() => switchChain({ chainId: TARGET_CHAIN_ID })}
            className="rounded-lg px-3 py-1 text-xs font-bold transition-opacity hover:opacity-80"
            style={{ background: 'var(--danger)', color: '#fff' }}
          >
            Switch
          </button>
        </div>
      )}
    </header>
  )
}
