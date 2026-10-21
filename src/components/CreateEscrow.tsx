import { useState, useEffect, useRef } from 'react'
import { useAccount, useWriteContract, useWaitForTransactionReceipt, useReadContract } from 'wagmi'
import { erc20Abi, isAddress } from 'viem'
import { arcTestnet } from 'viem/chains'
import { Loader2, ExternalLink, ShieldCheck } from 'lucide-react'
import { toast } from 'sonner'
import { getUsdc } from '@/onchain-facts'
import { parseUsdc, Amount } from '@/onchain-money'
import { buildTxExplorerUrl } from '@/onchain-facts'
import { ESCROW_ABI, getEscrowAddress, parseEscrowError } from '@/lib/escrow'

const CHAIN_ID = arcTestnet.id
const usdcFact = getUsdc(CHAIN_ID)!
const USDC_ADDRESS = usdcFact.address as `0x${string}`

const glass = {
  card: { background: 'var(--surface-strong)', backdropFilter: 'blur(24px) saturate(180%)', WebkitBackdropFilter: 'blur(24px) saturate(180%)', border: '1px solid var(--border)' },
  inner: { background: 'var(--surface-muted)', border: '1px solid var(--border)' },
}

export default function CreateEscrow({ onCreated }: { onCreated: (id: bigint) => void }) {
  const { address, isConnected, chainId } = useAccount()
  const escrowAddress = getEscrowAddress()

  const [seller, setSeller] = useState('')
  const [amount, setAmount] = useState('')

  // --- USDC balance ---
  const { data: rawBalance } = useReadContract({
    address: USDC_ADDRESS,
    abi: erc20Abi,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
    chainId: CHAIN_ID,
    query: { enabled: !!address },
  })
  const formattedBalance = rawBalance !== undefined
    ? Amount.fromRaw(rawBalance, usdcFact.decimals).toFixed(2)
    : null

  // Parse the amount input into a raw bigint (6-decimal USDC units)
  let parsedRaw: bigint | null = null
  if (amount && /^\d*\.?\d*$/.test(amount) && parseFloat(amount) > 0) {
    try { parsedRaw = parseUsdc(amount) } catch { parsedRaw = null }
  }

  // --- USDC allowance ---
  const { data: allowance, refetch: refetchAllowance } = useReadContract({
    address: USDC_ADDRESS,
    abi: erc20Abi,
    functionName: 'allowance',
    args: address && escrowAddress ? [address, escrowAddress] : undefined,
    chainId: CHAIN_ID,
    query: { enabled: !!address && !!escrowAddress },
  })

  const needsApproval = parsedRaw !== null && allowance !== undefined
    ? (allowance) < parsedRaw
    : true

  // --- Step 1: Approve ---
  const {
    writeContract: approveWrite,
    data: approveHash,
    isPending: approvePending,
    reset: resetApprove,
  } = useWriteContract()

  const { isLoading: approveConfirming, isSuccess: approveSuccess } = useWaitForTransactionReceipt({
    hash: approveHash,
    chainId: CHAIN_ID,
  })

  // Refetch allowance after approval confirms (effect avoids render-side side effect)
  const prevApproveSuccess = useRef(false)
  useEffect(() => {
    if (approveSuccess && !prevApproveSuccess.current) {
      prevApproveSuccess.current = true
      void refetchAllowance()
    }
    if (!approveSuccess) prevApproveSuccess.current = false
  }, [approveSuccess, refetchAllowance])

  // --- Step 2: Create escrow ---
  const {
    writeContract: createWrite,
    data: createHash,
    isPending: createPending,
    reset: resetCreate,
  } = useWriteContract()

  const { isLoading: createConfirming, isSuccess: createSuccess, data: createReceipt } = useWaitForTransactionReceipt({
    hash: createHash,
    chainId: CHAIN_ID,
  })

  // Navigate to view panel once creation confirms
  const prevCreateSuccess = useRef(false)
  useEffect(() => {
    if (createSuccess && !prevCreateSuccess.current && createReceipt) {
      prevCreateSuccess.current = true
      const created = createReceipt.logs.find(
        log => log.address.toLowerCase() === escrowAddress?.toLowerCase()
      )
      if (created && created.topics[1]) {
        onCreated(BigInt(created.topics[1]))
      }
    }
    if (!createSuccess) prevCreateSuccess.current = false
  }, [createSuccess, createReceipt, escrowAddress, onCreated])

  const wrongChain = isConnected && chainId !== CHAIN_ID
  const sellerValid = isAddress(seller) &&
    seller.toLowerCase() !== address?.toLowerCase() &&
    BigInt(seller) > 0xFFn
  const amountValid = parsedRaw !== null
  const canProceed = isConnected && !wrongChain && !!escrowAddress && sellerValid && amountValid

  const step: 'connect' | 'no-contract' | 'wrong-chain' | 'approve' | 'create' =
    !isConnected ? 'connect'
    : !escrowAddress ? 'no-contract'
    : wrongChain ? 'wrong-chain'
    : needsApproval ? 'approve'
    : 'create'

  function handleApprove() {
    if (!canProceed || !escrowAddress || parsedRaw === null) return
    resetCreate()
    approveWrite({
      address: USDC_ADDRESS,
      abi: erc20Abi,
      functionName: 'approve',
      args: [escrowAddress, parsedRaw],
      chainId: CHAIN_ID,
    })
  }

  function handleCreate() {
    if (!canProceed || !escrowAddress || parsedRaw === null || !isAddress(seller)) return
    resetApprove()
    createWrite(
      {
        address: escrowAddress,
        abi: ESCROW_ABI,
        functionName: 'createEscrow',
        args: [seller, parsedRaw],
        chainId: CHAIN_ID,
      },
      { onError: (e) => toast.error(parseEscrowError(e)) }
    )
  }

  return (
    <section className="rounded-3xl p-5" style={glass.card}>
      <div className="mb-5 flex items-center gap-2">
        <div className="flex size-7 items-center justify-center rounded-xl" style={{ background: 'rgba(18,45,69,0.08)' }}>
          <ShieldCheck className="size-4" style={{ color: 'var(--accent)' }} />
        </div>
        <h2 className="display text-base font-bold" style={{ color: 'var(--ink)' }}>Create Escrow</h2>
      </div>

      {!escrowAddress && (
        <p className="mb-4 rounded-2xl px-4 py-3 text-sm" style={{ background: 'rgba(186,43,76,0.07)', color: 'var(--danger)' }}>
          Contract not yet deployed. Deploy ArcEscrow first, then set <span className="mono text-xs">VITE_ESCROW_CONTRACT</span> in <span className="mono text-xs">.env</span>.
        </p>
      )}

      {/* Seller input */}
      <div className="mb-3">
        <label className="mb-1.5 block text-xs font-semibold tracking-wide" style={{ color: 'var(--muted)' }}>SELLER ADDRESS</label>
        <div className="rounded-2xl px-4 py-3" style={glass.inner}>
          <input
            type="text"
            value={seller}
            onChange={e => setSeller(e.target.value.trim())}
            placeholder="0x..."
            className="mono w-full bg-transparent text-sm outline-none placeholder:opacity-40"
            style={{ color: 'var(--ink)' }}
          />
        </div>
        {seller && !sellerValid && (
          <p className="mt-1 text-xs" style={{ color: 'var(--danger)' }}>
            {!isAddress(seller) ? 'Not a valid address.' :
              seller.toLowerCase() === address?.toLowerCase() ? 'Cannot escrow to yourself.' :
              'Address is in precompile range and cannot receive USDC.'}
          </p>
        )}
      </div>

      {/* Amount input */}
      <div className="mb-5">
        <label className="mb-1.5 block text-xs font-semibold tracking-wide" style={{ color: 'var(--muted)' }}>AMOUNT</label>
        <div className="rounded-2xl px-4 py-3" style={glass.inner}>
          <input
            inputMode="decimal"
            value={amount}
            onChange={e => {
              const v = e.target.value.replace(/[^0-9.]/g, '')
              if (v === '' || /^\d*\.?\d*$/.test(v)) setAmount(v)
            }}
            placeholder="0.00"
            className="display w-full bg-transparent text-3xl font-bold tabular-nums outline-none placeholder:opacity-30"
            style={{ color: 'var(--ink)' }}
          />
          <div className="mt-2 flex items-center justify-between">
            <span className="text-xs font-semibold" style={{ color: 'var(--subtle)' }}>USDC</span>
            {formattedBalance !== null ? (
              <button
                onClick={() => setAmount(formattedBalance)}
                className="text-xs font-semibold transition-opacity hover:opacity-70"
                style={{ color: 'var(--accent-hover)' }}
              >
                Balance: {formattedBalance} · Max
              </button>
            ) : (
              <span className="text-xs" style={{ color: 'var(--subtle)' }}>Connect to see balance</span>
            )}
          </div>
        </div>
      </div>

      {/* Buyer disclaimer */}
      <p className="mb-4 text-xs leading-relaxed" style={{ color: 'var(--subtle)' }}>
        As buyer, you may cancel any pending escrow at any time. This contract does not provide dispute resolution or guaranteed seller protection.
      </p>

      {/* Two-step CTA */}
      <div className="flex flex-col gap-2.5">
        <button
          disabled={!canProceed || step !== 'approve' || approvePending || approveConfirming}
          onClick={handleApprove}
          className="w-full rounded-2xl py-3.5 text-sm font-semibold transition-all hover:scale-[1.01] active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-40"
          style={{ background: step === 'approve' ? 'var(--accent)' : 'var(--surface-muted)', color: step === 'approve' ? '#fff' : 'var(--muted)' }}
        >
          {approvePending
            ? <span className="flex items-center justify-center gap-2"><Loader2 className="size-4 animate-spin" /> Confirm in wallet...</span>
            : approveConfirming
            ? <span className="flex items-center justify-center gap-2"><Loader2 className="size-4 animate-spin" /> Approving...</span>
            : approveSuccess && !needsApproval ? '1. USDC Approved'
            : '1. Approve USDC'}
        </button>

        <button
          disabled={!canProceed || step !== 'create' || createPending || createConfirming}
          onClick={handleCreate}
          className="w-full rounded-2xl py-3.5 text-sm font-semibold transition-all hover:scale-[1.01] active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-40"
          style={{ background: step === 'create' ? 'var(--accent)' : 'var(--surface-muted)', color: step === 'create' ? '#fff' : 'var(--muted)' }}
        >
          {createPending
            ? <span className="flex items-center justify-center gap-2"><Loader2 className="size-4 animate-spin" /> Confirm in wallet...</span>
            : createConfirming
            ? <span className="flex items-center justify-center gap-2"><Loader2 className="size-4 animate-spin" /> Confirming...</span>
            : '2. Deposit & Create Escrow'}
        </button>
      </div>

      {/* Receipts */}
      {approveHash && (
        <a
          href={buildTxExplorerUrl(CHAIN_ID, approveHash)}
          target="_blank"
          rel="noreferrer"
          className="mt-3 flex items-center gap-1 text-xs transition-opacity hover:opacity-70"
          style={{ color: 'var(--accent-hover)' }}
        >
          Approval tx <ExternalLink className="size-3" />
        </a>
      )}
      {createHash && (
        <a
          href={buildTxExplorerUrl(CHAIN_ID, createHash)}
          target="_blank"
          rel="noreferrer"
          className="mt-2 flex items-center gap-1 text-xs transition-opacity hover:opacity-70"
          style={{ color: 'var(--accent-hover)' }}
        >
          Escrow creation tx <ExternalLink className="size-3" />
        </a>
      )}
    </section>
  )
}
