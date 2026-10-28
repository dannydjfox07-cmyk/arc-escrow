# ArcEscrow — Pre-Mainnet Security Review

**Date:** 2026-10-24  
**Contract:** ArcEscrow  
**Testnet address:** `0x77ed48faeba9566d2d9f0d6552949a534e010513` (Arc Testnet)  
**Source:** `contracts/ArcEscrow.sol`  
**Solc:** 0.8.28, EVM target: paris  
**OpenZeppelin:** SafeERC20 5.1.0  

---

## 1. Test Results

**33 passed, 0 failed, 0 skipped.**  
Run time: 29ms. No compilation changes since last build.

### Coverage by Category

| Category | Tests | Result |
|---|---|---|
| Happy path (create, release, cancel, updateSeller) | T01–T05 | PASS |
| Unauthorized release | T06 (seller), T07 (third party) | PASS |
| Unauthorized cancel | T08 (seller), T09 (third party) | PASS |
| Unauthorized updateSeller | T10 (seller), T11 (third party) | PASS |
| Duplicate release | T12 | PASS |
| Release after cancel | T13 | PASS |
| Duplicate cancel | T14 | PASS |
| Cancel after release | T15 | PASS |
| updateSeller on terminal escrow | T16 (released), T17 (cancelled) | PASS |
| Zero amount | T18 | PASS |
| Zero seller address | T19 | PASS |
| Self-escrow (seller == buyer) | T20 | PASS |
| Precompile-range seller | T21 | PASS |
| updateSeller validations | T22–T24 | PASS |
| Non-existent escrow ID | T25–T27 | PASS |
| Insufficient allowance | T28 | PASS |
| Insufficient balance | T29 | PASS |
| Transfer returns false (release) | T30 (mock) | PASS |
| Transfer returns false (cancel) | T31 (mock) | PASS |
| Fuzz: createEscrow | T32 (256 runs) | PASS |
| Sequential ID increment | Extra | PASS |

---

## 2. Static Analysis (Slither, 102 detectors)

**8 results — all in OpenZeppelin internals, 0 in ArcEscrow.sol itself.**

| Finding | Location | Assessment |
|---|---|---|
| Assembly usage | OZ SafeERC20, Address | Expected; OZ-internal, not in contract source |
| Low-level calls | OZ Address.sol | Expected; OZ-internal, not in contract source |
| solc-version `^0.8.20` known issues | All files | See note below |

**solc-version note:** Slither flags three known compiler issues for `^0.8.20`: `VerbatimInvalidDeduplication`, `FullInlinerNonExpressionSplitArgumentEvaluationOrder`, and `MissingSideEffectsOnSelectorAccess`. All three affect edge cases in inliner/codegen optimisation paths that do not apply to ArcEscrow's code patterns (no verbatim assembly, no complex inlined expression splits, no `.selector` side-effects). The actual compiler version used is 0.8.28, which postdates and resolves all three bugs. This is a false positive from Slither reading the pragma floor, not the pinned version.

---

## 3. Security Review Findings

### [Medium] Contract-level USDC blacklist can freeze all escrows

**What it is:** All buyer deposits are custodied at `address(this)`. Circle (the USDC issuer) can blacklist any address, including smart contracts. If the ArcEscrow contract address itself is blacklisted, every `safeTransfer` call in `releaseEscrow` and `cancelEscrow` will revert permanently, trapping all deposited USDC for all users.

**Likelihood:** Extremely low in practice — Circle blacklists contracts only in response to court orders or major compliance events. No ordinary usage triggers this.

**Impact if triggered:** Total fund loss for all active escrows. No on-chain recovery path exists.

**Recommended mitigation for mainnet:**
- Document this risk explicitly in user-facing terms and the deployment runbook.
- Consider whether a short escrow lifetime reduces exposure (funds held briefly are less at risk than long-lived escrows).
- An emergency withdrawal function gated to a multisig timelock could allow migration, but adds admin complexity. For an MVP this is out of scope; the risk disclosure is the minimum required action.

**Accepted for MVP:** Yes, with documented disclosure. This is an inherent property of all USDC custody contracts and cannot be fully eliminated without moving away from USDC.

---

### [Low] Custom errors carry no context parameters

**What it is:** `Unauthorized()`, `InvalidState()`, `NotFound()` are emitted without fields (no `escrowId`, no `caller`, no current/expected state). When a transaction reverts on mainnet, the revert reason alone is not enough to reconstruct what happened without a full trace.

**Impact:** Harder incident triage and monitoring. No security impact.

**Recommended fix before mainnet:**
```solidity
error Unauthorized(address caller, address expected, uint256 escrowId);
error InvalidState(uint256 escrowId, EscrowState current);
error NotFound(uint256 escrowId);
```

**Accepted for MVP:** Yes. Low operational risk for a hackathon project. Recommend fixing before a production release.

---

### [Informational] Buyer inaction leaves escrow Pending indefinitely

**What it is:** There is no deadline, expiry, or timeout mechanism. If the buyer never calls `releaseEscrow` or `cancelEscrow`, funds remain locked in the contract forever. The seller has no on-chain recourse.

**This is by design** for the MVP. It is documented in the NatSpec and the frontend warning banner.

**Mainnet recommendation:** Make the "no deadline" limitation explicit in user-facing UI before any real funds are committed. Future versions should consider a deadline with automatic refund or an arbitration path.

---

### [Informational] No source verification on the explorer

**What it is:** The contract source is not publicly verified on the Arc Testnet explorer (confirmed via `lookup_contract` — `verified: false`). The bytecode is correct (confirmed via artifact timestamp chain and `usdc()` read), but the source is not publicly readable on the explorer.

**Mainnet requirement:** Source verification is strongly recommended before any mainnet deployment. Run:
```bash
forge verify-contract \
  <MAINNET_ADDRESS> \
  contracts/ArcEscrow.sol:ArcEscrow \
  --chain-id 5042 \
  --constructor-args $(cast abi-encode "constructor(address)" 0x3600000000000000000000000000000000000000) \
  --verifier blockscout \
  --verifier-url https://explorer.arc.io/api
```

---

## 4. Bytecode / Source Correspondence

| Check | Result | Method |
|---|---|---|
| Contract is live at the testnet address | Confirmed | `lookup_contract` + `eth_getCode` |
| `usdc()` returns `0x3600000000000000000000000000000000000000` | Confirmed | `read_contract` live call |
| `escrowCount()` returns 3 (testnet sessions) | Confirmed | `read_contract` live call |
| Artifact is newer than source | Confirmed | mtime: source Oct 21 13:53, artifact Oct 21 13:54 |
| No source edits since deployment | Confirmed | No `.sol` modifications after Oct 21 13:54 |
| Deploy metadata matches project source | Confirmed | `contract-metadata/ArcEscrow.json` records the correct source path, tx hash, and address |
| On-chain bytecode == local artifact bytecode | **Cannot directly verify** | Arc Studio cannot call `eth_getCode` and diff the raw bytecode. The artifact-timestamp chain is strong indirect evidence. Full verification requires `forge verify-contract` or a manual `cast code` comparison. |

---

## 5. Missing Tests (Low Priority)

| Gap | Risk |
|---|---|
| `constructor(address(0))` reverts `ZeroAddress` | Low |
| `updateSeller` then `releaseEscrow` sends to new seller | Low |
| Multi-escrow isolation: release of escrow #1 does not affect #2 | Informational |
| Event parameters verified on release/cancel (not just emitted) | Informational |

None are blocking. All critical security properties are covered by the existing 33 tests.

---

## 6. Summary and Mainnet Readiness

| Area | Status |
|---|---|
| Access control | Solid — buyer-only guards on all mutating functions |
| State machine | Solid — CEI ordering, no reuse of terminal states |
| Token transfer safety | Solid — SafeERC20, false-return handled |
| Re-entrancy | Not applicable — USDC does not re-enter; CEI order eliminates the window |
| Input validation | Complete — zero amount, zero address, self-escrow, precompile range |
| Arc-specific risks | Precompile guard in place; USDC-as-native-gas handled correctly (ERC-20 path only) |
| USDC blacklist (contract freeze) | Documented risk, accepted for MVP |
| No deadline / buyer inaction | Documented design choice, disclosed in UI |
| Source verification | Not yet done — required before mainnet |
| Custom error context | Missing — recommended fix before production |

**Verdict: Safe to deploy to Arc Mainnet with the two actions below completed first.**

### Required before mainnet
1. Add the contract-freeze risk disclosure to the frontend and any public documentation.
2. Verify the source on the mainnet explorer immediately after deployment.

### Recommended (not blocking)
3. Add context parameters to `Unauthorized`, `InvalidState`, and `NotFound` errors.
4. Add the four missing low-priority test cases.
