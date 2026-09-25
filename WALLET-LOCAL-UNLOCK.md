# Local password unlock — review build

This patch targets the source archive supplied from `feat/wallet-local-unlock`,
based on main commit `1960d2d`. It does not deploy, broadcast transactions, or
change server files. Existing blockchain derivation paths remain unchanged.

## Behavior

- Create or restore a wallet, confirm a seed backup, and choose a password.
- Existing address-only wallets require the matching recovery phrase once to
  set up encrypted storage. All saved chain addresses must match.
- One encrypted mnemonic is stored under `tatcoin.encryptedVault.v1`.
  Passwords and plaintext seeds are not persisted. Public address keys remain.
- Web Crypto AES-256-GCM, random 16-byte salt and 12-byte IV, a 128-bit tag,
  PBKDF2-HMAC-SHA256 with 600,000 iterations, and a fixed versioned format.
  The derived CryptoKey is not exportable. Passwords are 12–256 characters.
- TAT, staking, BTC, ETH, USDT, approvals and swaps use the unlocked session.
  Low-level signing utilities remain available for offline scripts.
- Reload starts locked. Explicit lock, page exit, other-tab storage changes,
  and a fixed 15-minute session timeout revoke the session. The signing path
  also checks expiry if a background timer is delayed.
- Send/swap/staking forms unmount when locked; their locally prepared/signed
  state is discarded. Previously broadcast transactions cannot be cancelled.
  A copied raw signed transaction remains usable outside this application.
- Reset the local password using the matching recovery phrase. To switch to a
  different wallet, explicitly remove the saved account first.
- The Wallet screen is simplified to creation, restore/setup, password unlock,
  recovery/reset, public addresses, lock and confirmed removal.

## Boundaries

This is browser-local encrypted storage, not hardware device binding or a
server login. A copied encrypted vault can be attacked offline. XSS, malicious
extensions or a compromised browser can access an unlocked wallet. JavaScript
cannot guarantee erasure of all string or library memory copies. Seed backup
remains essential; clearing browser data removes the encrypted copy.

Failed storage writes never publish an unlocked session. Interrupted setup can
leave public address metadata, but does not report successful vault creation.
A malformed encrypted vault is preserved for recovery instead of auto-deleted.
Public addresses are checked against the decrypted phrase before activation.

## Verification

Run from the repository root:

```bash
node --import tsx --test scripts/test-wallet-vault.ts scripts/test-wallet-session.ts
npm run lint
npm run build
```

The automated tests cover encryption round trips/randomness, wrong passwords,
tampering, malformed/oversized envelopes, KDF limits, revoked signers, storage
failure, cancelled unlock/setup, cross-tab locking, password reset, legacy
address migration and expiry. Tests use a public BIP39 test vector and do not
send transactions or call blockchain RPCs.

Local TypeScript/Vite build and lint on application sources were checked.
Browser UI execution has NOT yet been verified. Before production deployment,
use a separate browser profile and a new wallet without funds to check:

1. Generate, back up, save, lock, reload and unlock with the password.
2. Wrong password, seed recovery and password reset.
3. Send/swap/staking are inaccessible while locked; lock clears review/sign
   screens; no seed input remains on transaction screens.
4. A second tab's lock/removal revokes the first tab.
5. Explicit removal, then restoring the same test seed reproduces addresses.

Do not deploy this review build until these flows have been checked. No real
funded wallet or paid mainnet transaction is required for the checks.

## Apply and rollback

Keep the current branch clean. First use `git apply --check` on the supplied
patch, then `git apply` to apply it. A patch check changes no files. Review
`git diff --stat` before testing. Do not overwrite unrelated local changes.

Before committing, the patch can be reversed with `git apply -R` only when it
still applies cleanly. After committing, use a normal revert commit. Rolling
back source code does not remove browser vaults; older code will ignore the
new vault key and require a seed for signing as before. Retain your seed backup.

Reference: https://www.w3.org/TR/2017/REC-WebCryptoAPI-20170126/
