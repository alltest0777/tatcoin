import { useState } from "react";
import {
  RiAddLine,
  RiDownloadLine,
  RiShieldKeyholeLine,
  RiWallet3Line,
} from "react-icons/ri";

import { createWallet, importWallet } from "../../lib/wallet-core";

import { useWalletStore } from "../../stores/wallet-store";

import { deriveMultichainAddresses } from "../../lib/multichain-wallet";

type WalletMode = "choose" | "create" | "import" | "unlock";

export default function Wallet() {
  const [mode, setMode] = useState<WalletMode>("choose");

  const [mnemonic, setMnemonic] = useState("");
  const [address, setAddress] = useState("");
  const [creating, setCreating] = useState(false);

  const [importMnemonic, setImportMnemonic] = useState("");
  const [unlockMnemonic, setUnlockMnemonic] = useState("");
  const [derivedAddresses, setDerivedAddresses] = useState<{
    tat: string;
    btc: string;
    eth: string;
  } | null>(null);

  const [deriving, setDeriving] = useState(false);
  const [unlocking, setUnlocking] = useState(false);
  const [importAddress, setImportAddress] = useState("");
  const [importing, setImporting] = useState(false);

  const [error, setError] = useState("");

  const [confirmRemove, setConfirmRemove] = useState(false);

  const setActiveWallet = useWalletStore((state) => state.setWallet);
  const setMultichainAddresses = useWalletStore(
    (state) => state.setMultichainAddresses,
  );
  const lockWallet = useWalletStore((state) => state.lockWallet);
  const removeWallet = useWalletStore((state) => state.removeWallet);

  const activeAddress = useWalletStore((state) => state.address);
  const btcAddress = useWalletStore((state) => state.btcAddress);
  const ethAddress = useWalletStore((state) => state.ethAddress);
  const signer = useWalletStore((state) => state.signer);

  const walletLocked = Boolean(activeAddress && !signer);

  if (mode === "unlock") {
    return (
      <div className="space-y-6">
        <button
          type="button"
          onClick={() => {
            setMode("choose");
            setUnlockMnemonic("");
            setError("");
          }}
          className="text-sm text-slate-400 transition hover:text-white"
        >
          ← Back to wallet
        </button>

        <div>
          <h1 className="text-2xl font-semibold text-white">Unlock Wallet</h1>

          <p className="mt-1 text-sm text-slate-500">
            Unlock your TatCoin wallet to sign transactions.
          </p>
        </div>

        <div className="max-w-2xl rounded-3xl border border-white/10 bg-white/[0.03] p-6">
          <RiShieldKeyholeLine className="text-3xl text-cyan-300" />

          <h2 className="mt-5 text-lg font-semibold text-white">
            Recovery phrase
          </h2>

          <p className="mt-2 text-sm leading-6 text-slate-400">
            Enter the recovery phrase for the active wallet. The phrase is used
            only to unlock this browser session and is not saved.
          </p>

          {activeAddress && (
            <div className="mt-5">
              <div className="mb-2 text-xs font-medium uppercase tracking-wider text-slate-500">
                Active wallet
              </div>

              <div className="break-all rounded-2xl border border-white/10 bg-black/20 p-4 font-mono text-sm text-cyan-300">
                {activeAddress}
              </div>
            </div>
          )}

          <textarea
            value={unlockMnemonic}
            onChange={(event) => {
              setUnlockMnemonic(event.target.value);
              setError("");
            }}
            rows={5}
            spellCheck={false}
            autoComplete="off"
            placeholder="Enter your recovery phrase..."
            className="mt-6 w-full resize-none rounded-2xl border border-white/10 bg-black/20 p-4 font-mono text-sm leading-7 text-white outline-none transition placeholder:text-slate-700 focus:border-cyan-400/40"
          />

          <button
            type="button"
            disabled={deriving || !unlockMnemonic.trim()}
            onClick={async () => {
              try {
                setDeriving(true);
                setError("");
                setDerivedAddresses(null);

                const result = await deriveMultichainAddresses(unlockMnemonic);

                setDerivedAddresses(result);
              } catch (err) {
                setError(
                  err instanceof Error
                    ? err.message
                    : "Unable to derive multichain addresses",
                );
              } finally {
                setDeriving(false);
              }
            }}
            className="mt-4 mr-3 rounded-xl border border-cyan-400/20 bg-cyan-400/[0.05] px-5 py-3 text-sm font-semibold text-cyan-300 transition hover:bg-cyan-400/10 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {deriving
              ? "Deriving addresses..."
              : "Preview multichain addresses"}
          </button>

          {derivedAddresses && (
            <div className="mt-5 space-y-3">
              <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                <div className="text-xs uppercase tracking-wider text-slate-500">
                  TatCoin
                </div>

                <div className="mt-2 break-all font-mono text-sm text-cyan-300">
                  {derivedAddresses.tat}
                </div>
              </div>

              <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                <div className="text-xs uppercase tracking-wider text-slate-500">
                  Bitcoin
                </div>

                <div className="mt-2 break-all font-mono text-sm text-amber-300">
                  {derivedAddresses.btc}
                </div>
              </div>

              <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                <div className="text-xs uppercase tracking-wider text-slate-500">
                  Ethereum
                </div>

                <div className="mt-2 break-all font-mono text-sm text-violet-300">
                  {derivedAddresses.eth}
                </div>
              </div>
            </div>
          )}

          <button
            type="button"
            disabled={unlocking || !unlockMnemonic.trim()}
            onClick={async () => {
              if (!activeAddress) {
                setError("No active wallet");
                return;
              }

              try {
                setUnlocking(true);
                setError("");

                const wallet = await importWallet(unlockMnemonic);

                if (wallet.address !== activeAddress) {
                  throw new Error(
                    "Recovery phrase does not match the active wallet",
                  );
                }

                setActiveWallet(wallet.address, wallet.signer);
                const multichain =
                  await deriveMultichainAddresses(unlockMnemonic);

                setMultichainAddresses(multichain.btc, multichain.eth);

                setUnlockMnemonic("");
                setMode("choose");
              } catch (err) {
                setError(
                  err instanceof Error
                    ? err.message
                    : "Unable to unlock wallet",
                );
              } finally {
                setUnlocking(false);
              }
            }}
            className="mt-4 rounded-xl bg-cyan-400 px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-cyan-300 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {unlocking ? "Unlocking wallet..." : "Unlock wallet"}
          </button>

          {error && (
            <div className="mt-4 rounded-xl border border-red-400/20 bg-red-400/[0.05] p-3 text-sm text-red-300">
              {error}
            </div>
          )}
        </div>
      </div>
    );
  }

  if (mode === "create") {
    return (
      <div className="space-y-6">
        <button
          type="button"
          onClick={() => {
            setMode("choose");
            setError("");
          }}
          className="text-sm text-slate-400 transition hover:text-white"
        >
          ← Back to wallet
        </button>

        <div>
          <h1 className="text-2xl font-semibold text-white">Create Wallet</h1>

          <p className="mt-1 text-sm text-slate-500">
            Create a new TatCoin wallet and recovery phrase.
          </p>
        </div>

        <div className="max-w-2xl rounded-3xl border border-white/10 bg-white/[0.03] p-6">
          <RiShieldKeyholeLine className="text-3xl text-cyan-300" />

          <h2 className="mt-5 text-lg font-semibold text-white">
            Recovery phrase
          </h2>

          <p className="mt-2 text-sm leading-6 text-slate-400">
            Your recovery phrase gives complete access to your wallet. Never
            share it with anyone.
          </p>

          {!mnemonic ? (
            <button
              type="button"
              disabled={creating}
              onClick={async () => {
                try {
                  setCreating(true);
                  setError("");

                  const wallet = await createWallet();

                  setMnemonic(wallet.mnemonic);
                  setAddress(wallet.address);
                  setActiveWallet(wallet.address, wallet.signer);
                  const multichain = await deriveMultichainAddresses(
                    wallet.mnemonic,
                  );

                  setMultichainAddresses(multichain.btc, multichain.eth);
                } catch (err) {
                  setError(
                    err instanceof Error
                      ? err.message
                      : "Failed to create wallet",
                  );
                } finally {
                  setCreating(false);
                }
              }}
              className="mt-6 rounded-xl bg-cyan-400 px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-cyan-300 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {creating ? "Creating wallet..." : "Generate wallet"}
            </button>
          ) : (
            <div className="mt-6 space-y-5">
              <div>
                <div className="mb-2 text-xs font-medium uppercase tracking-wider text-slate-500">
                  Recovery phrase
                </div>

                <div className="rounded-2xl border border-amber-400/20 bg-amber-400/[0.05] p-4 font-mono text-sm leading-7 text-amber-100">
                  {mnemonic}
                </div>
              </div>

              <div>
                <div className="mb-2 text-xs font-medium uppercase tracking-wider text-slate-500">
                  TatCoin address
                </div>

                <div className="break-all rounded-2xl border border-white/10 bg-black/20 p-4 font-mono text-sm text-cyan-300">
                  {address}
                </div>
              </div>

              <div className="rounded-2xl border border-red-400/20 bg-red-400/[0.05] p-4 text-sm leading-6 text-red-200">
                Save this recovery phrase securely before continuing. Anyone
                with this phrase can control the wallet.
              </div>
            </div>
          )}

          {error && (
            <div className="mt-4 rounded-xl border border-red-400/20 bg-red-400/[0.05] p-3 text-sm text-red-300">
              {error}
            </div>
          )}
        </div>
      </div>
    );
  }

  if (mode === "import") {
    return (
      <div className="space-y-6">
        <button
          type="button"
          onClick={() => {
            setMode("choose");
            setError("");
            setImportAddress("");
          }}
          className="text-sm text-slate-400 transition hover:text-white"
        >
          ← Back to wallet
        </button>

        <div>
          <h1 className="text-2xl font-semibold text-white">Import Wallet</h1>

          <p className="mt-1 text-sm text-slate-500">
            Restore an existing TatCoin wallet using its recovery phrase.
          </p>
        </div>

        <div className="max-w-2xl rounded-3xl border border-white/10 bg-white/[0.03] p-6">
          <RiDownloadLine className="text-3xl text-cyan-300" />

          <h2 className="mt-5 text-lg font-semibold text-white">
            Recovery phrase
          </h2>

          <p className="mt-2 text-sm leading-6 text-slate-400">
            Enter your recovery phrase to restore your TatCoin wallet.
          </p>

          <textarea
            value={importMnemonic}
            onChange={(event) => {
              setImportMnemonic(event.target.value);
              setImportAddress("");
              setError("");
            }}
            rows={5}
            spellCheck={false}
            autoComplete="off"
            placeholder="Enter your recovery phrase..."
            className="mt-6 w-full resize-none rounded-2xl border border-white/10 bg-black/20 p-4 font-mono text-sm leading-7 text-white outline-none transition placeholder:text-slate-700 focus:border-cyan-400/40"
          />

          <button
            type="button"
            disabled={importing || !importMnemonic.trim()}
            onClick={async () => {
              try {
                setImporting(true);
                setError("");
                setImportAddress("");

                const wallet = await importWallet(importMnemonic);

                setImportAddress(wallet.address);
                setActiveWallet(wallet.address, wallet.signer);
                const multichain =
                  await deriveMultichainAddresses(importMnemonic);

                setMultichainAddresses(multichain.btc, multichain.eth);
              } catch {
                setError("Invalid recovery phrase");
              } finally {
                setImporting(false);
              }
            }}
            className="mt-4 rounded-xl bg-cyan-400 px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-cyan-300 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {importing ? "Importing wallet..." : "Import wallet"}
          </button>

          {importAddress && (
            <div className="mt-6">
              <div className="mb-2 text-xs font-medium uppercase tracking-wider text-slate-500">
                TatCoin address
              </div>

              <div className="break-all rounded-2xl border border-emerald-400/20 bg-emerald-400/[0.05] p-4 font-mono text-sm text-emerald-200">
                {importAddress}
              </div>
            </div>
          )}

          {error && (
            <div className="mt-4 rounded-xl border border-red-400/20 bg-red-400/[0.05] p-3 text-sm text-red-300">
              {error}
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-white">Wallet</h1>

        <p className="mt-1 text-sm text-slate-500">
          Create a new TatCoin wallet or restore an existing one.
        </p>
      </div>

      {activeAddress && (
        <div
          className={
            walletLocked
              ? "max-w-2xl rounded-2xl border border-amber-400/20 bg-amber-400/[0.05] p-4"
              : "max-w-2xl rounded-2xl border border-emerald-400/20 bg-emerald-400/[0.05] p-4"
          }
        >
          <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
            <div>
              <div
                className={
                  walletLocked
                    ? "font-medium text-amber-300"
                    : "font-medium text-emerald-300"
                }
              >
                {walletLocked ? "Wallet locked" : "Wallet unlocked"}
              </div>

              <div className="mt-2 break-all font-mono text-xs text-slate-400">
                {activeAddress}
              </div>

              {btcAddress && (
                <div className="mt-3">
                  <div className="text-xs uppercase tracking-wider text-slate-500">
                    Bitcoin
                  </div>

                  <div className="mt-1 break-all font-mono text-xs text-amber-300">
                    {btcAddress}
                  </div>
                </div>
              )}

              {ethAddress && (
                <div className="mt-3">
                  <div className="text-xs uppercase tracking-wider text-slate-500">
                    Ethereum
                  </div>

                  <div className="mt-1 break-all font-mono text-xs text-violet-300">
                    {ethAddress}
                  </div>
                </div>
              )}

              <div className="mt-2 text-xs text-slate-500">
                {walletLocked
                  ? "Unlock the wallet to sign transactions."
                  : "Wallet is ready to sign transactions."}
              </div>
            </div>

            <div className="flex shrink-0 flex-wrap gap-2">
              {walletLocked ? (
                <button
                  type="button"
                  onClick={() => {
                    setError("");
                    setUnlockMnemonic("");
                    setMode("unlock");
                  }}
                  className="rounded-xl bg-amber-400 px-4 py-2.5 text-sm font-semibold text-slate-950 transition hover:bg-amber-300"
                >
                  Unlock wallet
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    lockWallet();
                  }}
                  className="rounded-xl border border-amber-400/20 bg-amber-400/[0.05] px-4 py-2.5 text-sm font-semibold text-amber-300 transition hover:bg-amber-400/10"
                >
                  Lock wallet
                </button>
              )}

              <button
                type="button"
                onClick={() => {
                  setImportMnemonic("");
                  setImportAddress("");
                  setError("");
                  setMode("import");
                }}
                className="rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-white/10"
              >
                Switch account
              </button>

              <button
                type="button"
                onClick={() => {
                  setConfirmRemove(true);
                  setError("");
                }}
                className="rounded-xl border border-red-400/20 bg-red-400/[0.05] px-4 py-2.5 text-sm font-semibold text-red-300 transition hover:bg-red-400/10"
              >
                Remove account
              </button>
            </div>
          </div>
        </div>
      )}

      {confirmRemove && activeAddress && (
        <div className="max-w-2xl rounded-2xl border border-red-400/20 bg-red-400/[0.05] p-5">
          <div className="font-medium text-red-300">
            Remove account from this browser?
          </div>

          <p className="mt-2 text-sm leading-6 text-slate-400">
            This removes the saved public address and the active signer from
            this browser. It does not delete the wallet or any funds from the
            blockchain. You will need the recovery phrase to restore access.
          </p>

          <div className="mt-4 break-all rounded-xl border border-white/10 bg-black/20 p-3 font-mono text-xs text-slate-400">
            {activeAddress}
          </div>

          <div className="mt-4 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => {
                setConfirmRemove(false);
              }}
              className="rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-white/10"
            >
              Cancel
            </button>

            <button
              type="button"
              onClick={() => {
                removeWallet();
                setConfirmRemove(false);
                setMode("choose");
                setMnemonic("");
                setAddress("");
                setImportMnemonic("");
                setImportAddress("");
                setUnlockMnemonic("");
                setError("");
              }}
              className="rounded-xl bg-red-400 px-4 py-2.5 text-sm font-semibold text-slate-950 transition hover:bg-red-300"
            >
              Remove account
            </button>
          </div>
        </div>
      )}

      <div className="grid max-w-4xl gap-4 md:grid-cols-2">
        <button
          type="button"
          onClick={() => {
            setMode("create");
            setError("");
          }}
          className="group rounded-3xl border border-white/10 bg-white/[0.03] p-6 text-left transition hover:border-cyan-400/30 hover:bg-cyan-400/[0.05]"
        >
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-cyan-400/10 text-cyan-300">
            <RiAddLine className="text-2xl" />
          </div>

          <h2 className="mt-6 text-lg font-semibold text-white">
            Create new wallet
          </h2>

          <p className="mt-2 text-sm leading-6 text-slate-500">
            Generate a new TatCoin address and recovery phrase.
          </p>
        </button>

        <button
          type="button"
          onClick={() => {
            setMode("import");
            setError("");
          }}
          className="group rounded-3xl border border-white/10 bg-white/[0.03] p-6 text-left transition hover:border-cyan-400/30 hover:bg-cyan-400/[0.05]"
        >
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/5 text-slate-300">
            <RiWallet3Line className="text-2xl" />
          </div>

          <h2 className="mt-6 text-lg font-semibold text-white">
            Import wallet
          </h2>

          <p className="mt-2 text-sm leading-6 text-slate-500">
            Restore a wallet using an existing recovery phrase.
          </p>
        </button>
      </div>

      <div className="max-w-4xl rounded-2xl border border-amber-400/10 bg-amber-400/[0.04] p-4">
        <div className="flex gap-3">
          <RiShieldKeyholeLine className="mt-0.5 shrink-0 text-xl text-amber-300" />

          <p className="text-sm leading-6 text-slate-400">
            TatCoin Wallet will never ask you to send your recovery phrase to a
            server.
          </p>
        </div>
      </div>
    </div>
  );
}
