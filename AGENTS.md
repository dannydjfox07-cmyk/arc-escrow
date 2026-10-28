# ArcEscrow

> Built with Arc Studio - money-powered apps in minutes

Non-custodial USDC escrow on Arc. A buyer deposits USDC into the contract; only the buyer can release funds to the seller or cancel and recover their deposit.

---

## What This App Does

Buyers create escrows by depositing USDC. The designated seller can view the escrow. Only the buyer can release funds to the seller (confirming work is done) or cancel the escrow and recover USDC. No admin, no owner, no dispute resolution — a minimal hackathon demo.

## Tech Stack

- Frontend: React 18, Vite, TypeScript, Tailwind CSS
- Web3: wagmi v2, viem v2, ConnectKit
- Contracts: Solidity 0.8.28 + Foundry + OpenZeppelin 5.1.0 SafeERC20
- Wallet: injected (MetaMask, etc.)
- Chain: Arc Testnet (Chain ID: 5042002)
- Token: USDC ERC-20, 6 decimals, `0x3600000000000000000000000000000000000000` (same address on Arc Testnet and Arc Mainnet)
- Toasts: Sonner

## Deployed Contracts

| Contract | Network | Address | Explorer |
|---|---|---|---|
| ArcEscrow | Arc Testnet | `0x77ed48faeba9566d2d9f0d6552949a534e010513` | https://explorer.testnet.arc.io/address/0x77ed48faeba9566d2d9f0d6552949a534e010513 |

Constructor arg: USDC at `0x3600000000000000000000000000000000000000`

## Key Files

- `src/App.tsx` — thin composition root
- `src/components/CreateEscrow.tsx` — approve + deposit flow
- `src/components/ViewEscrow.tsx` — lookup, release, cancel
- `src/components/USDCBalance.tsx` — live ERC-20 balance
- `src/components/EscrowHeader.tsx` — wallet connect + chain guard
- `src/lib/escrow.ts` — ABI, address resolver, error parser
- `contracts/ArcEscrow.sol` — escrow contract
- `contracts/test/ArcEscrow.t.sol` — 33 Foundry unit tests
- `contracts/contract-metadata/ArcEscrow.json` — deployment record

## Environment Variables

| Variable | Purpose |
|---|---|
| `VITE_ESCROW_CONTRACT` | Deployed ArcEscrow address (set post-deploy) |
| `RPC_PROXY_BASE_URL` | Arc Studio RPC proxy (optional outside Arc Studio) |
| `RPC_PROXY_TOKEN` | Arc Studio RPC proxy token (optional outside Arc Studio) |
| `RPC_PROXY_CHAINS` | Arc Studio RPC proxy chain list (optional outside Arc Studio) |

## To Run

```bash
bun install
bun run dev
```

## To Build Contracts

```bash
bun run contracts:build   # forge build
bun run contracts:test    # forge test (33 tests)
```

## Mainnet Deployment (post-hackathon)

Arc Studio deploys to testnet only. For mainnet:
1. Export the compiled artifact from `contracts/out/ArcEscrow.sol/ArcEscrow.json`
2. Deploy with your own wallet: `forge create contracts/ArcEscrow.sol:ArcEscrow --constructor-args 0x3600000000000000000000000000000000000000 --rpc-url https://rpc.mainnet.arc.io --private-key $PRIVATE_KEY --broadcast`
3. Set `VITE_ESCROW_CONTRACT` to the mainnet address
4. Verify: `forge verify-contract <address> contracts/ArcEscrow.sol:ArcEscrow --verifier blockscout --verifier-url https://explorer.arc.io/api`

## Security Notes

- Buyer can cancel any pending escrow at any time — no seller protection
- USDC blacklist can prevent release/cancel if buyer or seller is blocked by Circle
- `updateSeller` is available as a recovery path while the escrow is Pending
- No re-entrancy risk: strict checks-effects-interactions ordering throughout
- Passed balanced security review (2 rounds), Slither (0 findings), 33/33 unit tests
