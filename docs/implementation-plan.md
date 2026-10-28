Checking for it directly.This session is in Plan mode, so I cannot run commands. Switch to Build mode to check the filesystem, then run:

```bash
ls -la /tmp/ | grep -i arc
find /tmp -name "*standard-input*" 2>/dev/null
find /tmp -name "ArcEscrow*" 2>/dev/null
```

That said — `/tmp/ArcEscrow-standard-input.json` is not a file this project generates automatically. It would only exist if it was produced by a prior `forge verify-contract` or `forge build --standard-json` command run in your terminal. A few possibilities:

1. **It was never created** — the preflight report I wrote described the verify command but did not run it (read-only mode). Nothing in this session has written that file.
2. **It was created in a previous session** — `/tmp` is ephemeral and does not survive sandbox restarts. If the sandbox was recycled between sessions, the file is gone.
3. **You created it yourself** — if you ran a `forge` command in a terminal tab, check there.

To generate it fresh, switch to Build mode and run:

```bash
forge verify-contract --show-standard-json-input \
  0x77ed48faeba9566d2d9f0d6552949a534e010513 \
  contracts/ArcEscrow.sol:ArcEscrow \
  --compiler-version 0.8.28 \
  --num-of-optimizations 200 \
  --evm-version paris \
  > /tmp/ArcEscrow-standard-input.json
```

That writes the standard JSON input file you would submit to Blockscout for source verification.
