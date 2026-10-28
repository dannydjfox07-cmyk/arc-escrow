import { useState } from 'react'
import EscrowHeader from './components/EscrowHeader'
import CreateEscrow from './components/CreateEscrow'
import ViewEscrow from './components/ViewEscrow'
import USDCBalance from './components/USDCBalance'

type Tab = 'create' | 'view'

export default function App() {
  const [tab, setTab] = useState<Tab>('create')
  const [jumpToId, setJumpToId] = useState<bigint | undefined>()

  function handleCreated(id: bigint) {
    setJumpToId(id)
    setTab('view')
  }

  const tabs: { id: Tab; label: string }[] = [
    { id: 'create', label: 'Create Escrow' },
    { id: 'view', label: 'View / Manage' },
  ]

  return (
    <div className="min-h-dvh" style={{ background: 'var(--bg-gradient)' }}>
      <EscrowHeader />

      <main className="mx-auto max-w-lg px-4 pb-16 pt-6">
        {/* Balance bar */}
        <USDCBalance />

        {/* Tab switcher */}
        <div
          className="mb-5 grid grid-cols-2 gap-1 rounded-2xl p-1"
          style={{ background: 'rgba(255,255,255,0.72)', backdropFilter: 'blur(20px)', border: '1px solid var(--border)' }}
        >
          {tabs.map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className="rounded-xl py-2.5 text-sm font-semibold transition-all"
              style={tab === t.id
                ? { background: 'var(--accent)', color: '#fff', boxShadow: '0 1px 6px rgba(18,45,69,0.18)' }
                : { background: 'transparent', color: 'var(--muted)' }}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Panel */}
        {tab === 'create' && <CreateEscrow onCreated={handleCreated} />}
        {tab === 'view' && <ViewEscrow initialId={jumpToId} />}

        {/* Footer note */}
        <p className="mt-8 text-center text-xs leading-relaxed" style={{ color: 'var(--subtle)' }}>
          ArcEscrow · Testnet demo · No dispute resolution · Buyer may cancel at any time · No automatic expiry · Subject to USDC issuer restrictions
        </p>
      </main>
    </div>
  )
}
