import { useState, useEffect, useRef } from 'react'
import { useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt } from 'wagmi'
import { arcTestnet } from 'viem/chains'
import { Loader2, ExternalLink, Search, CheckCircle2, XCircle, Clock } from 'lucide-react'
import { toast } from 'sonner'
import { getUsdc } from '@/onchain-facts'
import { Amount } from '@/onchain-money'
import { buildTxExplorerUrl } from '@/onchain-facts'
import { ESCROW_ABI, ESCROW_STATE_LABELS, getEscrowAddress, parseEscrowError } from '@/lib/escrow'

const CHAIN_ID = arcTestnet.id
const usdcFact = getUsdc(CHAIN_ID)!

const glass = {
  card: { background: 'var(--surface-strong)', backdropFilter: 'blur(24px) saturate(180%)', WebkitBackdropFilter: 'blur(24px) saturate(180%)', border: '1px solid var(--border)' },
  inner: { background: 'var(--surface-muted)', border: '1px solid var(--border)' },
}

function formatAddr(addr: string) {
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`
}

const STATE_ICON = {
  0: <Clock className="size-4" style={{ color: '#e8932a' }} />,
  1: <CheckCircle2 className="size-4" style={{ color: 'var(--success)' }} />,
  2: <XCircle className="size-4" style={{ color: 'var(--danger)' }} />,
} as Record<number, React.ReactNode>

const STATE_COLOR: Record<number, string> = {
  0: '#e8932a',
  1: 'var(--success)',
  2: 'var(--danger)',
}

export default function ViewEscrow({ initialId }: { initialId?: bigint }) {
  const { address, isConnected, chainId } = useAccount()
  const escrowAddress = getEscrowAddress()

  const [inputId, setInputId] = useState(initialId !== undefined ? String(initialId) : '')
  const [queriedId, setQueriedId] = useState<bigint | null>(initialId ?? null)

  const wrongChain = isConnected && chainId !== CHAIN_ID

  // Fetch escrow
  const { data: escrow, isLoading: escrowLoading, refetch } = useReadContract({
    address: escrowAddress,
    abi: ESCROW_ABI,
    functionName: 'getEscrow',
    args: queriedId !== null ? [queriedId] : undefined,
    chainId: CHAIN_ID,
    query: { enabled: !!escrowAddress && queriedId !== null },
  })

  const escrowData = escrow as { buyer: string; seller: string; amount: bigint; state: number } | undefined
  const isBuyer = isConnected && address && escrowData?.buyer.toLowerCase() === address.toLowerCase()
  const isPending = escrowData?.state === 0

  // Release
  const { writeContract: releaseWrite, data: releaseHash, isPending: releasePending, reset: resetRelease } = useWriteContract()
  const { isLoading: releaseConfirming, isSuccess: releaseSuccess } = useWaitForTransactionReceipt({ hash: releaseHash, chainId: CHAIN_ID })
  const prevReleaseSuccess = useRef(false)
  useEffect(() => {
    if (releaseSuccess && !prevReleaseSuccess.current) {
      prevReleaseSuccess.current = true
      void refetch()
      toast.success('Escrow released — funds sent to seller.')
    }
    if (!releaseSuccess) prevReleaseSuccess.current = false
  }, [releaseSuccess, refetch])

  // Cancel
  const { writeContract: cancelWrite, data: cancelHash, isPending: cancelPending, reset: resetCancel } = useWriteContract()
  const { isLoading: cancelConfirming, isSuccess: cancelSuccess } = useWaitForTransactionReceipt({ hash: cancelHash, chainId: CHAIN_ID })
  const prevCancelSuccess = useRef(false)
  useEffect(() => {
    if (cancelSuccess && !prevCancelSuccess.current) {
      prevCancelSuccess.current = true
      void refetch()
      toast.success('Escrow cancelled — USDC refunded to buyer.')
    }
    if (!cancelSuccess) prevCancelSuccess.current = false
  }, [cancelSuccess, refetch])

  function handleRelease() {
    if (!escrowAddress || queriedId === null) return
    resetCancel()
    releaseWrite(
      { address: escrowAddress, abi: ESCROW_ABI, functionName: 'releaseEscrow', args: [queriedId], chainId: CHAIN_ID },
      { onError: (e) => toast.error(parseEscrowError(e)) }
    )
  }

  function handleCancel() {
    if (!escrowAddress || queriedId === null) return
    resetRelease()
    cancelWrite(
      { address: escrowAddress, abi: ESCROW_ABI, functionName: 'cancelEscrow', args: [queriedId], chainId: CHAIN_ID },
      { onError: (e) => toast.error(parseEscrowError(e)) }
    )
  }

  const formattedAmount = escrowData
    ? Amount.fromRaw(escrowData.amount, usdcFact.decimals).toFixed(2)
    : null

  const isNotFound = escrowData && escrowData.buyer === '0x0000000000000000000000000000000000000000'

  return (
    <section className="rounded-3xl p-5" style={glass.card}>
      <div className="mb-5 flex items-center gap-2">
        <div className="flex size-7 items-center justify-center rounded-xl" style={{ background: 'rgba(18,45,69,0.08)' }}>
          <Search className="size-4" style={{ color: 'var(--accent)' }} />
        </div>
        <h2 className="display text-base font-bold" style={{ color: 'var(--ink)' }}>View / Manage Escrow</h2>
      </div>

      {/* ID lookup */}
      <div className="mb-4 flex gap-2">
        <div className="flex-1 rounded-2xl px-4 py-3" style={glass.inner}>
          <input
            type="number"
            min="1"
            value={inputId}
            onChange={e => setInputId(e.target.value)}
            placeholder="Escrow ID"
            className="display w-full bg-transparent text-xl font-bold tabular-nums outline-none placeholder:opacity-30"
            style={{ color: 'var(--ink)' }}
          />
        </div>
        <button
          onClick={() => {
            const n = parseInt(inputId)
            if (!isNaN(n) && n > 0) setQueriedId(BigInt(n))
          }}
          disabled={!escrowAddress || !inputId || parseInt(inputId) < 1}
          className="rounded-2xl px-5 text-sm font-semibold text-white transition-all hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
          style={{ background: 'var(--accent)' }}
        >
          Look up
        </button>
      </div>

      {/* Loading */}
      {escrowLoading && <p className="text-sm" style={{ color: 'var(--muted)' }}>Loading...</p>}

      {/* Not found */}
      {!escrowLoading && isNotFound && queriedId !== null && (
        <p className="rounded-2xl px-4 py-3 text-sm" style={{ background: 'rgba(186,43,76,0.07)', color: 'var(--danger)' }}>
          Escrow #{String(queriedId)} does not exist.
        </p>
      )}

      {/* Escrow details */}
      {!escrowLoading && escrowData && !isNotFound && (
        <>
          {/* Hero amount */}
          <div className="mb-4 rounded-3xl p-4" style={{ background: 'var(--surface-muted)', border: '1px solid var(--border)' }}>
            <p className="mb-1 text-xs font-semibold tracking-wide" style={{ color: 'var(--muted)' }}>ESCROWED AMOUNT</p>
            <div className="flex items-baseline gap-1.5">
              <span className="display text-4xl font-bold tabular-nums" style={{ color: 'var(--ink)' }}>{formattedAmount}</span>
              <span className="text-lg font-medium" style={{ color: 'var(--subtle)' }}>USDC</span>
            </div>
            <div className="mt-2 flex items-center gap-1.5">
              {STATE_ICON[escrowData.state]}
              <span className="text-sm font-semibold" style={{ color: STATE_COLOR[escrowData.state] }}>
                {ESCROW_STATE_LABELS[escrowData.state] ?? 'Unknown'}
              </span>
              <span className="text-xs" style={{ color: 'var(--subtle)' }}>· Escrow #{String(queriedId)}</span>
            </div>
          </div>

          {/* Parties */}
          <div className="mb-4 grid grid-cols-2 gap-3">
            <div className="rounded-2xl px-4 py-3" style={glass.inner}>
              <p className="mb-0.5 text-xs font-semibold tracking-wide" style={{ color: 'var(--muted)' }}>BUYER</p>
              <p className="mono text-xs font-medium tabular-nums" style={{ color: 'var(--ink-2)' }}>{formatAddr(escrowData.buyer)}</p>
              {address && escrowData.buyer.toLowerCase() === address.toLowerCase() && (
                <span className="mt-1 block text-xs font-bold" style={{ color: 'var(--accent-hover)' }}>You</span>
              )}
            </div>
            <div className="rounded-2xl px-4 py-3" style={glass.inner}>
              <p className="mb-0.5 text-xs font-semibold tracking-wide" style={{ color: 'var(--muted)' }}>SELLER</p>
              <p className="mono text-xs font-medium tabular-nums" style={{ color: 'var(--ink-2)' }}>{formatAddr(escrowData.seller)}</p>
              {address && escrowData.seller.toLowerCase() === address.toLowerCase() && (
                <span className="mt-1 block text-xs font-bold" style={{ color: 'var(--accent-hover)' }}>You</span>
              )}
            </div>
          </div>

          {/* Buyer actions */}
          {isBuyer && isPending && (
            <>
              <div className="mb-3 rounded-2xl px-4 py-3 text-xs leading-relaxed" style={{ background: 'rgba(18,45,69,0.05)', border: '1px solid var(--border)', color: 'var(--subtle)' }}>
                You are the buyer. Release funds to the seller once work is complete, or cancel to recover your USDC. Cancellation is available at any time — this contract has no dispute mechanism.
              </div>
              <div className="flex gap-2.5">
                <button
                  disabled={releasePending || releaseConfirming || wrongChain}
                  onClick={handleRelease}
                  className="flex-1 rounded-2xl py-3.5 text-sm font-semibold text-white transition-all hover:scale-[1.01] active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-40"
                  style={{ background: 'var(--success)' }}
                >
                  {releasePending ? <span className="flex items-center justify-center gap-2"><Loader2 className="size-4 animate-spin" /> Confirm...</span>
                    : releaseConfirming ? <span className="flex items-center justify-center gap-2"><Loader2 className="size-4 animate-spin" /> Releasing...</span>
                    : 'Release to Seller'}
                </button>
                <button
                  disabled={cancelPending || cancelConfirming || wrongChain}
                  onClick={handleCancel}
                  className="flex-1 rounded-2xl py-3.5 text-sm font-semibold transition-all hover:scale-[1.01] active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-40"
                  style={{ background: 'rgba(186,43,76,0.10)', color: 'var(--danger)', border: '1px solid rgba(186,43,76,0.2)' }}
                >
                  {cancelPending ? <span className="flex items-center justify-center gap-2"><Loader2 className="size-4 animate-spin" /> Confirm...</span>
                    : cancelConfirming ? <span className="flex items-center justify-center gap-2"><Loader2 className="size-4 animate-spin" /> Cancelling...</span>
                    : 'Cancel & Refund'}
                </button>
              </div>
            </>
          )}

          {/* Non-buyer pending view */}
          {!isBuyer && isPending && (
            <p className="rounded-2xl px-4 py-3 text-sm" style={{ background: 'rgba(18,45,69,0.04)', color: 'var(--muted)' }}>
              Awaiting buyer release. Only the buyer can release or cancel this escrow.
            </p>
          )}

          {/* Terminal state */}
          {!isPending && (
            <p className="rounded-2xl px-4 py-3 text-sm font-semibold" style={{ background: escrowData.state === 1 ? 'rgba(26,128,71,0.08)' : 'rgba(186,43,76,0.07)', color: STATE_COLOR[escrowData.state] }}>
              This escrow is {ESCROW_STATE_LABELS[escrowData.state]?.toLowerCase()} and no further actions are available.
            </p>
          )}

          {/* Tx links */}
          {releaseHash && (
            <a href={buildTxExplorerUrl(CHAIN_ID, releaseHash)} target="_blank" rel="noreferrer" className="mt-3 flex items-center gap-1 text-xs" style={{ color: 'var(--accent-hover)' }}>
              Release tx <ExternalLink className="size-3" />
            </a>
          )}
          {cancelHash && (
            <a href={buildTxExplorerUrl(CHAIN_ID, cancelHash)} target="_blank" rel="noreferrer" className="mt-2 flex items-center gap-1 text-xs" style={{ color: 'var(--danger)' }}>
              Cancel tx <ExternalLink className="size-3" />
            </a>
          )}
        </>
      )}
    </section>
  )
}
