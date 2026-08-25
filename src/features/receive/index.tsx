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
  const btcAddress = useWalletStore((state) => state.btcAddress);
  const ethAddress = useWalletStore((state) => state.ethAddress);
  const [copied, setCopied] = useState(false);
  const [asset, setAsset] = useState<"tat" | "btc" | "eth">("tat");

  const selectedAddress =
    asset === "tat" ? address : asset === "btc" ? btcAddress : ethAddress;

  const qrValue =
    asset === "btc"
      ? selectedAddress
        ? `bitcoin:${selectedAddress}`
        : ""
      : asset === "eth"
        ? selectedAddress
          ? `ethereum:${selectedAddress}`
          : ""
        : (selectedAddress ?? "");

  const title =
    asset === "tat"
      ? "Receive TAT"
      : asset === "btc"
        ? "Receive BTC"
        : "Receive ETH";

  const description =
    asset === "tat"
      ? "Share your address to receive TatCoin."
      : asset === "btc"
        ? "Share your address to receive Bitcoin."
        : "Share your address to receive Ethereum.";

  const addressLabel =
    asset === "tat"
      ? "Your TatCoin address"
      : asset === "btc"
        ? "Your Bitcoin address"
        : "Your Ethereum address";

  async function handleCopy() {
    if (!selectedAddress) {
      return;
    }

    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(selectedAddress);
      } else {
        const textarea = document.createElement("textarea");

        textarea.value = selectedAddress;
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

  if (!selectedAddress) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold text-white">Receive TAT</h1>

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
        <h1 className="text-2xl font-semibold text-white">{title}</h1>

        <p className="mt-1 text-sm text-slate-500">{description}</p>
      </div>

      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => {
            setAsset("tat");
            setCopied(false);
          }}
          className={
            asset === "tat"
              ? "rounded-xl bg-cyan-400 px-4 py-2.5 text-sm font-semibold text-slate-950"
              : "rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm font-semibold text-white"
          }
        >
          TAT
        </button>

        <button
          type="button"
          onClick={() => {
            setAsset("btc");
            setCopied(false);
          }}
          className={
            asset === "btc"
              ? "rounded-xl bg-amber-400 px-4 py-2.5 text-sm font-semibold text-slate-950"
              : "rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm font-semibold text-white"
          }
        >
          BTC
        </button>

        <button
          type="button"
          onClick={() => {
            setAsset("eth");
            setCopied(false);
          }}
          className={
            asset === "eth"
              ? "rounded-xl bg-violet-400 px-4 py-2.5 text-sm font-semibold text-slate-950"
              : "rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm font-semibold text-white"
          }
        >
          ETH
        </button>
      </div>

      <div className="max-w-2xl rounded-3xl border border-white/10 bg-white/[0.03] p-6">
        <div className="flex justify-center">
          <div className="rounded-3xl bg-white p-5">
            {selectedAddress ? (
              <QRCode value={qrValue} size={220} level="M" />
            ) : (
              <div className="flex h-[220px] w-[220px] items-center justify-center text-sm text-slate-500">
                Address unavailable
              </div>
            )}
          </div>
        </div>

        <div className="mt-7 text-center">
          <div className="flex items-center justify-center gap-2 text-sm text-slate-500">
            <RiQrCodeLine className="text-lg" />
            {addressLabel}
          </div>

          <div className="mx-auto mt-3 max-w-lg break-all rounded-2xl border border-white/10 bg-black/20 p-4 font-mono text-sm text-cyan-300">
            {selectedAddress ?? "—"}
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
              {asset === "tat"
                ? "TatCoin Mainnet"
                : asset === "btc"
                  ? "Bitcoin Mainnet"
                  : "Ethereum Mainnet"}
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-black/10 p-4">
            <div className="text-xs uppercase tracking-wider text-slate-500">
              Chain ID
            </div>

            <div className="mt-2 text-sm font-medium text-white">
              {asset === "tat" ? "tat-1" : asset === "btc" ? "Bitcoin" : "1"}
            </div>
          </div>
        </div>

        <div className="mt-5 rounded-2xl border border-amber-400/20 bg-amber-400/[0.05] p-4 text-sm leading-6 text-amber-100">
          {asset === "tat"
            ? "Only send TAT on the TatCoin network to this address."
            : asset === "btc"
              ? "Only send BTC on the Bitcoin mainnet to this address."
              : "Only send ETH and supported Ethereum assets on Ethereum Mainnet to this address."}
        </div>
      </div>
    </div>
  );
}
