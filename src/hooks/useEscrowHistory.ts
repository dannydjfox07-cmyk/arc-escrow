/**
 * useEscrowHistory
 *
 * Fetches on-chain event logs for a specific escrow ID using eth_getLogs
 * filtered by topic (escrowId is the first indexed parameter on all three
 * ArcEscrow events). Returns the transaction hashes for the creation,
 * release, and cancellation events — one RPC call, no backend, no local
 * storage. Works for any user in any session.
 *
 * Limitations:
 * - Uses fromBlock: 'earliest' — acceptable because ArcEscrow was just
 *   deployed so the chain depth is small. For a contract deployed long
 *   ago on a deep chain, callers should narrow the range with the
 *   contract's deployment block.
 * - If the RPC node prunes historical logs, history may be unavailable.
 *   The hook returns { status: 'unavailable' } in that case.
 */

import { useEffect, useState } from 'react'
import { usePublicClient } from 'wagmi'
import { parseAbiItem } from 'viem'

const CREATED_EVENT = parseAbiItem(
  'event EscrowCreated(uint256 indexed escrowId, address indexed buyer, address indexed seller, uint256 amount)',
)
const RELEASED_EVENT = parseAbiItem(
  'event EscrowReleased(uint256 indexed escrowId, address indexed buyer, address indexed seller, uint256 amount)',
)
const CANCELLED_EVENT = parseAbiItem(
  'event EscrowCancelled(uint256 indexed escrowId, address indexed buyer, address indexed seller, uint256 amount)',
)

export type EscrowHistoryStatus = 'idle' | 'loading' | 'loaded' | 'unavailable'

export interface EscrowHistory {
  status: EscrowHistoryStatus
  createdTx: `0x${string}` | null
  releasedTx: `0x${string}` | null
  cancelledTx: `0x${string}` | null
}

const EMPTY: EscrowHistory = {
  status: 'idle',
  createdTx: null,
  releasedTx: null,
  cancelledTx: null,
}

/**
 * Returns transaction hashes for EscrowCreated / EscrowReleased /
 * EscrowCancelled events for the given escrowId on the given contract.
 * Re-fetches whenever escrowId or contractAddress changes.
 */
export function useEscrowHistory(
  contractAddress: `0x${string}` | undefined,
  escrowId: bigint | null,
  chainId: number,
): EscrowHistory {
  const publicClient = usePublicClient({ chainId })
  const [history, setHistory] = useState<EscrowHistory>(EMPTY)

  useEffect(() => {
    if (!contractAddress || escrowId === null || !publicClient) {
      setHistory(EMPTY)
      return
    }

    let cancelled = false
    setHistory({ ...EMPTY, status: 'loading' })

    async function fetch() {
      try {
        // Three getLogs calls in parallel — each scoped to one event signature
        // and one escrowId. This returns at most 1 log per call.
        const [createdLogs, releasedLogs, cancelledLogs] = await Promise.all([
          publicClient!.getLogs({
            address: contractAddress,
            event: CREATED_EVENT,
            args: { escrowId },
            fromBlock: 28650424n,
            toBlock: 'latest',
          }),
          publicClient!.getLogs({
            address: contractAddress,
            event: RELEASED_EVENT,
            args: { escrowId },
            fromBlock: 28650424n,
            toBlock: 'latest',
          }),
          publicClient!.getLogs({
            address: contractAddress,
            event: CANCELLED_EVENT,
            args: { escrowId },
            fromBlock: 28650424n,
            toBlock: 'latest',
          }),
        ])

        if (cancelled) return

        setHistory({
          status: 'loaded',
          createdTx: createdLogs[0]?.transactionHash ?? null,
          releasedTx: releasedLogs[0]?.transactionHash ?? null,
          cancelledTx: cancelledLogs[0]?.transactionHash ?? null,
        })
      } catch (error) {
        console.error('[ArcEscrow] Failed to fetch transaction history:', error)

        if (!cancelled) {
          setHistory({ ...EMPTY, status: 'unavailable' })
        }
      }
    }

    void fetch()
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contractAddress, escrowId, chainId])

  return history
}
