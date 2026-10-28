/**
 * RiskNotice — shared escrow risk disclosure, shown on Create and View/Manage screens.
 *
 * Wording satisfies two pre-mainnet documentation requirements:
 *  1. Buyer-cancellation, no dispute resolution, no automatic expiry.
 *  2. USDC issuer restriction / contract-address blacklist risk.
 */
export default function RiskNotice() {
  return (
    <div
      className="rounded-2xl px-4 py-3 text-xs leading-relaxed"
      style={{
        background: 'rgba(186, 140, 20, 0.07)',
        border: '1px solid rgba(186, 140, 20, 0.22)',
        color: 'var(--ink-2)',
      }}
    >
      <p className="mb-1.5 font-semibold" style={{ color: 'rgba(150,110,0,0.9)' }}>
        Important risks — read before proceeding
      </p>
      <ul className="flex flex-col gap-1 pl-3" style={{ listStyleType: 'disc' }}>
        <li>
          <strong>Buyer cancellation:</strong> The buyer may cancel any pending escrow at any time
          and recover all deposited USDC. There is no time restriction, no dispute resolution, and
          no arbitrator. Sellers have no on-chain protection against cancellation.
        </li>
        <li>
          <strong>No automatic expiry:</strong> Pending escrows remain open indefinitely. Funds are
          not automatically released or refunded — only an explicit buyer action moves them.
        </li>
        <li>
          <strong>USDC issuer restrictions:</strong> USDC is issued by Circle and may be subject to
          regulatory or compliance actions. If Circle blacklists the escrow contract address or
          either party's wallet, transfers may revert and funds in active escrows could become
          temporarily or permanently inaccessible. This risk is inherent to all USDC custody
          contracts and cannot be eliminated on-chain.
        </li>
      </ul>
    </div>
  )
}
