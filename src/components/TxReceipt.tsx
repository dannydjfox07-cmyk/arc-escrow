import { ExternalLink } from 'lucide-react'
import { buildTxExplorerUrl } from '@/onchain-facts'

function shortHash(hash: string) {
  return `${hash.slice(0, 10)}…${hash.slice(-8)}`
}

/**
 * Displays a transaction hash row with:
 * - A status label (submitted / confirming / confirmed / failed)
 * - A shortened hash in monospace
 * - A "View" button linking to the Arc explorer
 * Only shows the confirmed style after `useWaitForTransactionReceipt` returns isSuccess.
 */
export default function TxReceipt({
  label,
  hash,
  confirming,
  confirmed,
  failed = false,
  chainId,
}: {
  label: string
  hash: `0x${string}`
  confirming: boolean
  confirmed: boolean
  failed?: boolean
  chainId: number
}) {
  const url = buildTxExplorerUrl(chainId, hash)

  const bg = confirmed
    ? 'rgba(26,128,71,0.07)'
    : failed
    ? 'rgba(186,43,76,0.07)'
    : 'rgba(18,45,69,0.04)'

  const borderColor = confirmed
    ? 'rgba(26,128,71,0.18)'
    : failed
    ? 'rgba(186,43,76,0.18)'
    : 'var(--border)'

  const labelColor = confirmed
    ? 'var(--success)'
    : failed
    ? 'var(--danger)'
    : 'var(--muted)'

  const statusText = confirmed
    ? `${label} confirmed`
    : failed
    ? `${label} failed`
    : confirming
    ? `${label} confirming…`
    : `${label} submitted`

  return (
    <div
      className="flex items-center justify-between rounded-2xl px-4 py-2.5"
      style={{ background: bg, border: `1px solid ${borderColor}` }}
    >
      <div className="min-w-0">
        <p className="text-xs font-semibold" style={{ color: labelColor }}>
          {statusText}
        </p>
        <p className="mono mt-0.5 text-xs tabular-nums" style={{ color: 'var(--subtle)' }}>
          {shortHash(hash)}
        </p>
      </div>
      <a
        href={url}
        target="_blank"
        rel="noreferrer"
        aria-label={`View ${label} transaction on Arc explorer`}
        className="ml-3 flex shrink-0 items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-semibold transition-opacity hover:opacity-70"
        style={{ background: 'var(--surface-muted)', color: 'var(--accent-hover)', border: '1px solid var(--border)' }}
      >
        View <ExternalLink className="size-3" />
      </a>
    </div>
  )
}
