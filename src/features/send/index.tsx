import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";

import { useWalletStore } from "../../stores/wallet-store";
import { sendTat } from "../../services/send";

function tatToUtat(value: string): string {
  const normalized = value.trim();

  if (!/^\d+(\.\d{0,6})?$/.test(normalized)) {
    throw new Error("Invalid amount");
  }

  const [whole, fraction = ""] = normalized.split(".");
  const paddedFraction = fraction.padEnd(6, "0");

  return `${BigInt(whole) * 1_000_000n + BigInt(paddedFraction)}`;
}

export default function Send() {
  const queryClient = useQueryClient();

  const address = useWalletStore((state) => state.address);
  const signer = useWalletStore((state) => state.signer);

  const [toAddress, setToAddress] = useState("");
  const [amount, setAmount] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [txHash, setTxHash] = useState("");
  const [height, setHeight] = useState<number | null>(null);

  const canSend =
    Boolean(address) &&
    Boolean(signer) &&
    Boolean(toAddress.trim()) &&
    Boolean(amount.trim()) &&
    !sending;

  if (!address || !signer) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold text-white">Send TAT</h1>
          <p className="mt-1 text-sm text-slate-500">
            Send TatCoin to another address.
          </p>
        </div>

        <div className="max-w-2xl rounded-3xl border border-amber-400/20 bg-amber-400/[0.05] p-6">
          <div className="text-sm text-amber-200">
            Create or import a wallet before sending TAT.
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-white">Send TAT</h1>
        <p className="mt-1 text-sm text-slate-500">
          Send TatCoin to another address.
        </p>
      </div>

      <div className="max-w-2xl rounded-3xl border border-white/10 bg-white/[0.03] p-6">
        <div>
          <label className="text-sm font-medium text-slate-300">
            Recipient address
          </label>

          <input
            value={toAddress}
            onChange={(event) => {
              setToAddress(event.target.value);
              setError("");
              setTxHash("");
              setHeight(null);
            }}
            placeholder="tat1..."
            spellCheck={false}
            autoComplete="off"
            className="mt-2 w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 font-mono text-sm text-white outline-none transition placeholder:text-slate-700 focus:border-cyan-400/40"
          />
        </div>

        <div className="mt-5">
          <label className="text-sm font-medium text-slate-300">
            Amount
          </label>

          <div className="relative mt-2">
            <input
              value={amount}
              onChange={(event) => {
                setAmount(event.target.value);
                setError("");
                setTxHash("");
                setHeight(null);
              }}
              placeholder="1.000000"
              inputMode="decimal"
              className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 pr-16 text-white outline-none transition placeholder:text-slate-700 focus:border-cyan-400/40"
            />

            <div className="pointer-events-none absolute inset-y-0 right-4 flex items-center text-sm font-medium text-cyan-300">
              TAT
            </div>
          </div>
        </div>

        <div className="mt-5 rounded-2xl border border-white/10 bg-black/10 p-4">
          <div className="text-xs uppercase tracking-wider text-slate-500">
            From
          </div>
          <div className="mt-2 break-all font-mono text-sm text-slate-300">
            {address}
          </div>
        </div>

        <button
          type="button"
          disabled={!canSend}
          onClick={async () => {
            try {
              setSending(true);
              setError("");
              setTxHash("");
              setHeight(null);

              const recipient = toAddress.trim();

              if (!recipient.startsWith("tat1")) {
                throw new Error("Invalid TatCoin recipient address");
              }

              const amountUtat = tatToUtat(amount);

              if (BigInt(amountUtat) <= 0n) {
                throw new Error("Amount must be greater than zero");
              }

              const result = await sendTat({
                signer,
                fromAddress: address,
                toAddress: recipient,
                amountUtat,
              });

              setTxHash(result.transactionHash);
              setHeight(result.height);

              await queryClient.invalidateQueries({
                queryKey: ["tat-balance", address],
              });

              setAmount("");
            } catch (err) {
              setError(
                err instanceof Error
                  ? err.message
                  : "Failed to send transaction",
              );
            } finally {
              setSending(false);
            }
          }}
          className="mt-6 w-full rounded-xl bg-cyan-400 px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-cyan-300 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {sending ? "Sending..." : "Send TAT"}
        </button>

        {error && (
          <div className="mt-4 rounded-xl border border-red-400/20 bg-red-400/[0.05] p-3 text-sm text-red-300">
            {error}
          </div>
        )}

        {txHash && (
          <div className="mt-4 rounded-2xl border border-emerald-400/20 bg-emerald-400/[0.05] p-4">
            <div className="text-sm font-medium text-emerald-200">
              Transaction confirmed
            </div>

            {height !== null && (
              <div className="mt-2 text-xs text-slate-400">
                Height: {height}
              </div>
            )}

            <div className="mt-2 break-all font-mono text-xs text-emerald-300">
              {txHash}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
