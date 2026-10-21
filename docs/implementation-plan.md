The USDC address is now verified from the generated `onchain-facts.ts` module. Here is the full pre-implementation clarification:

---

## Clarifications Addressed

### 1. USDC Address — Verified

`getUsdc(chainId)` resolves from Arc Studio's generated `onchain-facts.ts`. The verified address for **both Arc Testnet (5042002) and Arc Mainnet (5042)** is:

```
0x3600000000000000000000000000000000000000
```

This is a fixed native predeploy — same address on both networks. The contract will receive this address as an immutable constructor argument, read at deploy time from `onchain-facts.ts`. Nothing is hardcoded in Solidity.

---

### 2. Buyer Cancellation — Documentation Commitment

The contract will include a NatSpec comment block and frontend notice with this exact language:

> **Warning:** The buyer may cancel any pending escrow at any time and recover all deposited USDC. This is a unilateral right with no time restriction. This contract does not provide dispute resolution, arbitration, or guaranteed seller protection. Sellers should only accept escrow terms they trust the buyer to honour.

---

### 3. USDC Token Assumptions

The contract assumes USDC at `0x3600…0000` behaves as a well-formed ERC-20:

- `transfer` and `transferFrom` return `bool true` on success and revert on failure (Circle's USDC does this)
- No fee-on-transfer, no rebase, no blacklist that would silently succeed but deliver less than requested
- The contract uses the return value check pattern (`require(success)` via a SafeERC20-style call, or explicit revert-on-false)

**Known gap:** USDC does have a blacklist. If the buyer or seller is blacklisted by Circle after escrow creation, `transfer` will revert and funds will be locked. This is a known limitation of all USDC escrow contracts and is out of scope for the MVP. It will be documented.

---

### 4. Planned Test Cases

All tests run against a mock ERC-20 (controllable) plus a separate suite against the real USDC predeploy on a fork of Arc Testnet.

#### Happy Path
| # | Test | What it checks |
|---|---|---|
| T01 | Create escrow with valid inputs | Struct stored correctly, USDC pulled from buyer, event emitted |
| T02 | Release escrow by buyer | USDC sent to seller, state → Released, event emitted |
| T03 | Cancel escrow by buyer | USDC returned to buyer, state → Cancelled, event emitted |

#### Authorization
| # | Test | What it checks |
|---|---|---|
| T04 | Release by non-buyer (seller calls release) | Reverts with `Unauthorized` |
| T05 | Release by random third party | Reverts with `Unauthorized` |
| T06 | Cancel by non-buyer (seller calls cancel) | Reverts with `Unauthorized` |
| T07 | Cancel by random third party | Reverts with `Unauthorized` |

#### State Machine
| # | Test | What it checks |
|---|---|---|
| T08 | Duplicate release (release already-Released escrow) | Reverts with `InvalidState` |
| T09 | Release a Cancelled escrow | Reverts with `InvalidState` |
| T10 | Duplicate cancel (cancel already-Cancelled escrow) | Reverts with `InvalidState` |
| T11 | Cancel a Released escrow | Reverts with `InvalidState` |

#### Input Validation
| # | Test | What it checks |
|---|---|---|
| T12 | Create with zero amount | Reverts with `ZeroAmount` |
| T13 | Create with seller = zero address | Reverts with `ZeroAddress` |
| T14 | Create with seller = buyer (self-escrow) | Reverts with `InvalidSeller` |
| T15 | Operate on non-existent escrow ID | Reverts with `InvalidState` (uninitialized default is not Pending) |

#### Token Transfer Failures
| # | Test | What it checks |
|---|---|---|
| T16 | Create with insufficient allowance (buyer approved 0) | Reverts (ERC-20 revert propagates) |
| T17 | Create with insufficient balance (buyer has less than amount) | Reverts (ERC-20 revert propagates) |
| T18 | Transfer failure on release (mock returns false) | Reverts with `TransferFailed` |
| T19 | Transfer failure on cancel/refund (mock returns false) | Reverts with `TransferFailed` |

**Note on T18/T19:** Testing a false-returning transfer requires a mock token. The Circle USDC predeploy always reverts (never returns false), so T18/T19 use a mock. The real-USDC fork tests cover T16/T17 against the actual contract.

---

### 5. State Safety — Checks-Effects-Interactions

The contract follows strict CEI order in every state-mutating function:

```
1. CHECK  — verify caller, state, amount
2. EFFECT — update state enum to Released or Cancelled
3. INTERACT — call token.transfer(...)
```

State is marked final **before** the transfer call. If the transfer reverts, the EVM rolls back the state change too (same transaction). This means:
- No re-entrancy window where a second call sees `Pending` state while a transfer is in flight
- No partial state where Released is recorded but USDC never moved

No `ReentrancyGuard` is added (it would be redundant given CEI and USDC's non-re-entrant implementation), but this will be noted in the audit.

---

### 6. Arc Studio vs. External Deployment

| Step | Supported in Arc Studio | External / Manual |
|---|---|---|
| Write & compile Solidity | Yes | — |
| Audit & static analysis | Yes | — |
| Unit tests (Foundry) | Yes | — |
| Deploy to **Arc Testnet** | Yes (platform deployer wallet, automatic) | — |
| Verify source on **Arc Testnet Explorer** | Not currently (Arc Studio does not call the explorer verify API) | Run `forge verify-contract` manually against `https://explorer.testnet.arc.io` |
| Deploy to **Arc Mainnet** | No — platform deployer is testnet-only | User runs `forge create` or imports the compiled artifact into their own wallet/tool |
| Verify source on **Arc Mainnet Explorer** | No | User runs `forge verify-contract` against `https://explorer.arc.io` |
| Frontend preview | Yes (live preview panel) | — |
| Mainnet frontend config | Yes (swap `VITE_CHAIN_ID`, `VITE_ESCROW_CONTRACT` env vars) | User updates `.env` after manual deploy |

**Mainnet deployment path (post-hackathon):**
1. Arc Studio produces a compiled artifact and ABI
2. User exports the artifact and runs `forge create` with their own private key against `https://rpc.mainnet.arc.io`
3. User updates `VITE_ESCROW_CONTRACT` in `.env` to the mainnet address
4. User runs `forge verify-contract` to publish source on the mainnet explorer

---

### Unresolved Items — None Blocking

All Arc-specific requirements are resolved. The USDC address is verified. No open questions remain before implementation.

Ready to proceed when you approve. The build order will be: contract → audit → tests → frontend.
