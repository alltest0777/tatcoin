import { useState } from "react";
import QRCode from "react-qr-code";
import {
  RiCheckboxCircleLine,
  RiFileCopyLine,
  RiQrCodeLine,
} from "react-icons/ri";

import { useWalletStore } from "../../stores/wallet-store";

export default function Receive() {
  const address = useWalletStore((state) => state.address);
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    if (!address) {
      return;
    }

    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(address);
      } else {
        const textarea = document.createElement("textarea");

        textarea.value = address;
        textarea.style.position = "fixed";
        textarea.style.opacity = "0";

        document.body.appendChild(textarea);

        textarea.focus();
        textarea.select();

        const success = document.execCommand("copy");

        document.body.removeChild(textarea);

        if (!success) {
          throw new Error("Copy command failed");
        }
      }

      setCopied(true);

      window.setTimeout(() => {
        setCopied(false);
      }, 2000);
    } catch (err) {
      console.error("Failed to copy wallet address:", err);
      setCopied(false);
    }
  }

  if (!address) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold text-white">
            Receive TAT
          </h1>

          <p className="mt-1 text-sm text-slate-500">
            Share your address to receive TatCoin.
          </p>
        </div>

        <div className="max-w-2xl rounded-3xl border border-amber-400/20 bg-amber-400/[0.05] p-6">
          <div className="text-sm text-amber-200">
            Create or import a wallet before receiving TAT.
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-white">
          Receive TAT
        </h1>

        <p className="mt-1 text-sm text-slate-500">
          Share your address to receive TatCoin.
        </p>
      </div>

      <div className="max-w-2xl rounded-3xl border border-white/10 bg-white/[0.03] p-6">
        <div className="flex justify-center">
          <div className="rounded-3xl bg-white p-5">
            <QRCode
              value={address}
              size={220}
              level="M"
            />
          </div>
        </div>

        <div className="mt-7 text-center">
          <div className="flex items-center justify-center gap-2 text-sm text-slate-500">
            <RiQrCodeLine className="text-lg" />
            Your TatCoin address
          </div>

          <div className="mx-auto mt-3 max-w-lg break-all rounded-2xl border border-white/10 bg-black/20 p-4 font-mono text-sm text-cyan-300">
            {address}
          </div>

          <button
            type="button"
            onClick={() => {
              void handleCopy();
            }}
            className="mt-4 inline-flex items-center gap-2 rounded-xl bg-cyan-400 px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-cyan-300"
          >
            {copied ? (
              <>
                <RiCheckboxCircleLine className="text-lg" />
                Copied
              </>
            ) : (
              <>
                <RiFileCopyLine className="text-lg" />
                Copy address
              </>
            )}
          </button>
        </div>

        <div className="mt-7 grid gap-3 sm:grid-cols-2">
          <div className="rounded-2xl border border-white/10 bg-black/10 p-4">
            <div className="text-xs uppercase tracking-wider text-slate-500">
              Network
            </div>

            <div className="mt-2 flex items-center gap-2 text-sm font-medium text-white">
              <span className="h-2 w-2 rounded-full bg-emerald-400" />
              TatCoin Mainnet
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-black/10 p-4">
            <div className="text-xs uppercase tracking-wider text-slate-500">
              Chain ID
            </div>

            <div className="mt-2 text-sm font-medium text-white">
              tat-1
            </div>
          </div>
        </div>

        <div className="mt-5 rounded-2xl border border-amber-400/20 bg-amber-400/[0.05] p-4 text-sm leading-6 text-amber-100">
          Only send TAT on the TatCoin network to this address.
        </div>
      </div>
    </div>
  );
}
