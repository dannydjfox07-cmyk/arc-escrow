# ArcEscrow — Pre-Mainnet Deployment Preflight
Generated: Saturday, 25 October 2026

---

## 1. Test Suite

**37 passed, 0 failed, 0 skipped**

| Category | Tests |
|---|---|
| Happy path (create / release / cancel / updateSeller / getEscrow) | T01–T05 |
| Authorization (unauthorized release / cancel / updateSeller) | T06–T11 |
| State machine (duplicate / cross-state transitions) | T12–T17 |
| Input validation (zero amount, zero address, self-escrow, precompile) | T18–T24 |
| Not-found (nonexistent IDs) | T25–T27 |
| Token transfer failures (zero allowance, zero balance, false-returning mock) | T28–T31 |
| Fuzz (createEscrow over 256 random inputs) | T32 |
| Constructor ZeroAddress guard | T33 |
| updateSeller → release goes to new seller | T34 |
| Multi-escrow isolation | T35 |
| Event parameter correctness | T36 |
| Sequential ID increment | Extra |

Source: `forge test` run on `contracts/test/ArcEscrow.t.sol`, no source changes since the last session.

---

## 2. Compiler, Optimizer, and EVM Target

All three verified from the compiled artifact's embedded metadata
(`contracts/out/ArcEscrow.sol/ArcEscrow.json` → `metadata.compiler` / `metadata.settings`):

| Setting | Value | Source |
|---|---|---|
| Solidity compiler | `0.8.28+commit.7893614a` | Artifact metadata — verified |
| `auto_detect_solc` | false (pinned) | `foundry.toml` — verified |
| Optimizer | enabled, 200 runs | Artifact metadata — verified |
| EVM version | `paris` | Artifact metadata — verified |

**Why `paris` matters for Arc:** Arc uses the Paris EVM target (pre-Shanghai). The `PUSH0` opcode
introduced in Shanghai / Solidity ≥ 0.8.20 default target would cause deployment to revert or
produce unreachable code. Pinning `evm_version = "paris"` in `foundry.toml` plus
`auto_detect_solc = false` means this setting cannot be silently overridden.

---

## 3. Arc Mainnet Chain Configuration

| Property | Value | Source |
|---|---|---|
| Chain ID | 5042 | `onchain-facts.ts` registry |
| RPC URL | `https://rpc.mainnet.arc.io` | `onchain-facts.ts` registry |
| Explorer base | `https://explorer.arc.io` | `onchain-facts.ts` registry |
| Native currency | USDC, 18 decimals (gas view) | `onchain-facts.ts` registry |
| `foundry.toml` Arc Mainnet entry | **Absent** — no `arc` key under `[rpc_endpoints]` | `foundry.toml` — gap noted |

**Gap:** `foundry.toml` has no `arc` or `arc_mainnet` RPC entry. You must supply the URL explicitly
on every `forge` command with `--rpc-url https://rpc.mainnet.arc.io` (or add the entry yourself
before deployment). This is not a blocking issue but is easy to miss.

---

## 4. Arc Mainnet USDC — Live Verification

Address: `0x3600000000000000000000000000000000000000`
Chain: Arc Mainnet (chain ID 5042)

| Check | Result | Verified |
|---|---|---|
| `name()` | `"USDC"` | Live `eth_call` — confirmed |
| `symbol()` | `"USDC"` | Live `eth_call` — confirmed |
| `decimals()` | `6` | Live `eth_call` — confirmed |
| `totalSupply()` | `912,062,582,298,056` (raw 6-dec units ≈ $912M USDC) | Live `eth_call` — confirmed |
| `allowance(addr1, addr2)` | `0` (standard ERC-20 behaviour) | Live `eth_call` — confirmed |

**Supported but not live-verified (require a signed transaction):**

| Function | Status | How to verify independently |
|---|---|---|
| `approve(spender, amount)` | Cannot call via read tool — requires a wallet | Call from any EOA on Arc Mainnet; check the `Approval` event |
| `transferFrom(from, to, amount)` | Cannot call via read tool | Create a small testnet escrow with real USDC; observe the pull |
| `transfer(to, amount)` | Cannot call via read tool | Send 0.000001 USDC between two wallets on mainnet |

**Assumption:** Circle's USDC at `0x3600…0000` on Arc Mainnet follows the same FiatToken v2.2
implementation as on other Circle-supported chains. The `totalSupply` of ~$912M confirms this is
the live production deployment. The `allowance` response confirms the standard ERC-20 slot layout
is intact. `approve` / `transferFrom` / `transfer` cannot be confirmed without a signed tx.

---

## 5. Constructor Arguments

One argument, no ambiguity:

```
usdc_ = 0x3600000000000000000000000000000000000000
```

This is the immutable Arc USDC predeploy address. It is identical on testnet and mainnet. The
contract rejects `address(0)` with `ZeroAddress` (tested in T33). There are no other constructor
parameters and no owner/admin.

**Forge create command (mainnet):**
```bash
forge create contracts/ArcEscrow.sol:ArcEscrow \
  --constructor-args 0x3600000000000000000000000000000000000000 \
  --rpc-url https://rpc.mainnet.arc.io \
  --private-key $PRIVATE_KEY \
  --broadcast
```

---

## 6. Source Verification on Arc Mainnet Explorer

**Verifier supported:** Blockscout (Arc's mainnet explorer runs Blockscout).

```bash
forge verify-contract <DEPLOYED_ADDRESS> \
  contracts/ArcEscrow.sol:ArcEscrow \
  --verifier blockscout \
  --verifier-url https://explorer.arc.io/api \
  --compiler-version 0.8.28 \
  --num-of-optimizations 200 \
  --evm-version paris \
  --chain-id 5042
```

**Notes:**
- The `--verifier-url` endpoint must be the Blockscout API root (`/api`), not the UI root. Confirm
  this is live at `https://explorer.arc.io/api` before running (a 404 means the path differs).
- The same command works for the testnet contract (replace address and
  `--verifier-url https://explorer.testnet.arc.io/api --chain-id 5042002`). Run that first as a
  dry-run to confirm the verifier URL shape is correct before touching mainnet.
- `forge verify-contract` is not available inside Arc Studio — run it from your own machine.
- `foundry.toml` has no `[etherscan]` or `[verifier]` section; add one if you want a persistent
  verifier config rather than inline flags.

---

## 7. Artifact vs. Deployed Testnet Bytecode

**What can be confirmed inside Arc Studio:**

| Check | Result |
|---|---|
| Artifact is newer than source | Yes — source last modified Wed Oct 21 13:53, artifact compiled Sat Oct 24 03:19 (recompiled after test additions; source unchanged) |
| Core bytecode sha256 (deployed bytecode minus 53-byte CBOR metadata) | `d176c54f00bda44a2036ab4fc7227b675bc8baa11224960a3e83d7153d0e38cb` |
| Deployed address matches deploy metadata record | Yes — `0x77ed48faeba9566d2d9f0d6552949a534e010513` on ARC-TESTNET |
| `usdc()` on deployed contract returns expected address | Yes — `0x3600000000000000000000000000000000000000` (live read) |
| `escrowCount()` on deployed contract returns non-zero | Yes — returns `3` (live escrows created during testnet session) |

**What cannot be confirmed inside Arc Studio:**

Direct `eth_getCode` bytecode download and comparison is not available as a tool call. To compare
the deployed bytecode against the local artifact exactly:

```bash
# 1. Get on-chain deployed bytecode
cast code 0x77ed48faeba9566d2d9f0d6552949a534e010513 \
  --rpc-url https://rpc.testnet.arc.io > /tmp/onchain.hex

# 2. Extract deployed bytecode from the artifact
cat contracts/out/ArcEscrow.sol/ArcEscrow.json \
  | python3 -c "import json,sys; print(json.load(sys.stdin)['deployedBytecode']['object'])" \
  > /tmp/artifact.hex

# 3. Compare (the last 53 bytes differ — CBOR metadata includes a source hash that
#    changes between compiler runs; strip them for a content-equivalent comparison)
python3 -c "
a = open('/tmp/artifact.hex').read().strip()[2:]   # strip 0x
o = open('/tmp/onchain.hex').read().strip()[2:]
print('Lengths match:', len(a)==len(o))
print('Core match (sans CBOR):', a[:-106]==o[:-106])
"
```

---

## 8. Remaining Blockers and Unverified Assumptions

### Blockers (must resolve before deployment)

| # | Item | Evidence | Action required |
|---|---|---|---|
| B1 | `approve` / `transferFrom` / `transfer` not live-verified on Arc Mainnet USDC | Read calls only confirm the interface is present; write functions require a signed tx | Send a test transaction from your own wallet on Arc Mainnet before committing real escrow funds |
| B2 | Blockscout verify API URL not confirmed live | `https://explorer.arc.io/api` is the expected endpoint but has not been probed | Run `curl -s https://explorer.arc.io/api` and confirm it returns a valid Blockscout API response |
| B3 | Testnet source is not verified on-chain | Explorer shows unverified contract | Verify testnet first (`forge verify-contract` against `explorer.testnet.arc.io/api`) as a dry-run before mainnet |

### Unverified Assumptions (accepted risk for hackathon)

| # | Assumption | Basis | Risk if wrong |
|---|---|---|---|
| A1 | Arc Mainnet USDC `transfer` / `transferFrom` reverts (rather than returns false) on failure | Circle's FiatToken v2.2 always reverts; SafeERC20 handles false-returning tokens too | None — SafeERC20 covers both cases |
| A2 | Arc Mainnet does not impose additional EVM restrictions beyond Paris | Arc Testnet behaves identically to Paris EVM in all tests | A previously-unknown opcode restriction would cause deployment failure; test on testnet with same artifact |
| A3 | Arc Mainnet gas (USDC) is sufficient in the deployer wallet | No wallet balance check is possible without connecting a wallet | Deployment reverts if USDC balance is below gas cost; fund the wallet before deploying |
| A4 | The escrow contract address will not be USDC-blacklisted by Circle | No on-chain check available | Entire contract vault frozen; documented in UI risk notice |

### Not a blocker, but recommended

- Add `arc = "https://rpc.mainnet.arc.io"` to `foundry.toml` `[rpc_endpoints]` before deployment to
  avoid typing the URL on the command line.
- Add `[etherscan.arc]` or a `[verifier]` block to `foundry.toml` for a persistent verifier config.
- Update `README.md` test count from `33` to `37` after the recent additions.

---

## Summary Verdict

The contract is technically sound for mainnet deployment. All 37 tests pass. Compiler settings,
USDC address, and constructor argument are verified. Three items must be resolved first: live-test
`transfer`/`approve` on Arc Mainnet USDC, confirm the Blockscout API endpoint, and verify the
testnet source as a dry-run. None require contract changes.
