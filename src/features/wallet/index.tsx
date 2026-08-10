import { useState } from "react";
import {
  RiAddLine,
  RiDownloadLine,
  RiShieldKeyholeLine,
  RiWallet3Line,
} from "react-icons/ri";

import {
  createWallet,
  getWalletAddress,
  importWallet,
} from "../../lib/wallet-core";

import { useWalletStore } from "../../stores/wallet-store";

type WalletMode = "choose" | "create" | "import";

export default function Wallet() {
  const [mode, setMode] = useState<WalletMode>("choose");

  const [mnemonic, setMnemonic] = useState("");
  const [address, setAddress] = useState("");
  const [creating, setCreating] = useState(false);

  const [importMnemonic, setImportMnemonic] = useState("");
  const [importAddress, setImportAddress] = useState("");
  const [importing, setImporting] = useState(false);

  const [error, setError] = useState("");

  const setActiveAddress = useWalletStore((state) => state.setAddress);

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
          <h1 className="text-2xl font-semibold text-white">
            Create Wallet
          </h1>

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
            Your recovery phrase gives complete access to your wallet.
            Never share it with anyone.
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
		  setActiveAddress(wallet.address);
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
                Save this recovery phrase securely before continuing.
                Anyone with this phrase can control the wallet.
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
          <h1 className="text-2xl font-semibold text-white">
            Import Wallet
          </h1>

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
                const walletAddress = await getWalletAddress(wallet);

                setImportAddress(walletAddress);
		setActiveAddress(walletAddress);
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
        <h1 className="text-2xl font-semibold text-white">
          Wallet
        </h1>

        <p className="mt-1 text-sm text-slate-500">
          Create a new TatCoin wallet or restore an existing one.
        </p>
      </div>

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
            TatCoin Wallet will never ask you to send your recovery phrase
            to a server.
          </p>
        </div>
      </div>
    </div>
  );
}
