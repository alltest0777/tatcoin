import { Link } from "react-router-dom";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import { formatTatBalance, getTatBalance } from "../../services/bank";
import { estimateSendFee, sendTat } from "../../services/send";
import { useWalletStore } from "../../stores/wallet-store";

function tatToUtat(value: string): string {
  const normalized = value.trim();

  if (!/^\d+(\.\d{0,6})?$/.test(normalized)) {
    throw new Error("Invalid amount");
  }

  const [whole, fraction = ""] = normalized.split(".");
  const paddedFraction = fraction.padEnd(6, "0");

  return `${BigInt(whole) * 1_000_000n + BigInt(paddedFraction)}`;
}

function utatToTat(value: string): string {
  const amount = BigInt(value);
  const whole = amount / 1_000_000n;
  const fraction = amount % 1_000_000n;

  return `${whole}.${fraction.toString().padStart(6, "0")}`;
}

function addTatValues(first: string, second: string): string {
  const total = BigInt(tatToUtat(first)) + BigInt(tatToUtat(second));

  return utatToTat(total.toString());
}

export default function Send() {
  const queryClient = useQueryClient();

  const address = useWalletStore((state) => state.address);
  const signer = useWalletStore((state) => state.signer);
  const walletLocked = Boolean(address && !signer);

  const balanceQuery = useQuery({
    queryKey: ["tat-balance", address],
    queryFn: () => getTatBalance(address!),
    enabled: Boolean(address),
    refetchInterval: 10_000,
  });

  const availableBalance =
    address && balanceQuery.data ? formatTatBalance(balanceQuery.data) : null;

  const [toAddress, setToAddress] = useState("");
  const [amount, setAmount] = useState("");

  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [txHash, setTxHash] = useState("");
  const [height, setHeight] = useState<number | null>(null);

  const [estimatedFee, setEstimatedFee] = useState<string | null>(null);

  const [estimatingFee, setEstimatingFee] = useState(false);

  const [confirming, setConfirming] = useState(false);

  const canReview =
    Boolean(address) &&
    Boolean(signer) &&
    Boolean(toAddress.trim()) &&
    Boolean(amount.trim()) &&
    !sending &&
    !estimatingFee;

  function clearResult() {
    setError("");
    setTxHash("");
    setHeight(null);
  }

  async function handleEstimateFee() {
    if (!address || !signer) {
      return;
    }

    const recipient = toAddress.trim();

    if (!recipient.startsWith("tat1")) {
      setEstimatedFee(null);
      return;
    }

    if (!amount.trim()) {
      setEstimatedFee(null);
      return;
    }

    try {
      setEstimatingFee(true);

      const amountUtat = tatToUtat(amount);

      const result = await estimateSendFee({
        signer,
        fromAddress: address,
        toAddress: recipient,
        amountUtat,
      });

      setEstimatedFee(formatTatBalance(result.feeUtat));
    } catch {
      setEstimatedFee(null);
    } finally {
      setEstimatingFee(false);
    }
  }

  async function handleMax() {
    if (!address || !signer || !balanceQuery.data) {
      return;
    }

    const recipient = toAddress.trim();

    if (!recipient.startsWith("tat1")) {
      setError("Enter a valid recipient address before using MAX");
      return;
    }

    try {
      setEstimatingFee(true);
      clearResult();

      const estimate = await estimateSendFee({
        signer,
        fromAddress: address,
        toAddress: recipient,
        amountUtat: "1",
      });

      const balanceUtat = BigInt(balanceQuery.data);

      const feeUtat = BigInt(estimate.feeUtat);

      if (balanceUtat <= feeUtat) {
        throw new Error("Balance is too low to cover the network fee");
      }

      const maxUtat = balanceUtat - feeUtat;

      setAmount(utatToTat(maxUtat.toString()));

      setEstimatedFee(utatToTat(feeUtat.toString()));
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to calculate MAX amount",
      );
    } finally {
      setEstimatingFee(false);
    }
  }

  async function handleReview() {
    if (!address || !signer || !balanceQuery.data) {
      return;
    }

    try {
      clearResult();

      const recipient = toAddress.trim();

      if (!recipient.startsWith("tat1")) {
        throw new Error("Invalid TatCoin recipient address");
      }

      const amountUtat = tatToUtat(amount);

      if (BigInt(amountUtat) <= 0n) {
        throw new Error("Amount must be greater than zero");
      }

      setEstimatingFee(true);

      const estimate = await estimateSendFee({
        signer,
        fromAddress: address,
        toAddress: recipient,
        amountUtat,
      });

      const feeUtat = BigInt(estimate.feeUtat);

      const balanceUtat = BigInt(balanceQuery.data);

      const totalUtat = BigInt(amountUtat) + feeUtat;

      if (totalUtat > balanceUtat) {
        throw new Error("Insufficient balance to cover amount and network fee");
      }

      setEstimatedFee(utatToTat(feeUtat.toString()));

      setConfirming(true);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Unable to review transaction",
      );
    } finally {
      setEstimatingFee(false);
    }
  }

  async function handleConfirmSend() {
    if (!address || !signer || !estimatedFee) {
      return;
    }

    try {
      setSending(true);
      clearResult();

      const recipient = toAddress.trim();

      const amountUtat = tatToUtat(amount);

      const result = await sendTat({
        signer,
        fromAddress: address,
        toAddress: recipient,
        amountUtat,
      });

      setTxHash(result.transactionHash);

      setHeight(result.height);

      setConfirming(false);

      await queryClient.invalidateQueries({
        queryKey: ["tat-balance", address],
      });

      setAmount("");
      setEstimatedFee(null);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to send transaction",
      );
    } finally {
      setSending(false);
    }
  }

  if (!address) {
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

  if (walletLocked) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold text-white">Send TAT</h1>

          <p className="mt-1 text-sm text-slate-500">
            Send TatCoin to another address.
          </p>
        </div>

        <div className="max-w-2xl rounded-3xl border border-amber-400/20 bg-amber-400/[0.05] p-6">
          <div className="text-lg font-semibold text-amber-300">
            Wallet locked
          </div>

          <p className="mt-2 text-sm leading-6 text-slate-400">
            Unlock your wallet before signing and sending transactions.
          </p>

          <div className="mt-4 break-all rounded-2xl border border-white/10 bg-black/20 p-4 font-mono text-sm text-slate-300">
            {address}
          </div>

          <Link
            to="/wallet"
            className="mt-5 inline-flex rounded-xl bg-amber-400 px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-amber-300"
          >
            Unlock wallet
          </Link>
        </div>
      </div>
    );
  }

  if (confirming) {
    const reviewFee = estimatedFee ?? "0.000000";
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold text-white">
            Review transaction
          </h1>

          <p className="mt-1 text-sm text-slate-500">
            Check the transaction details before signing.
          </p>
        </div>

        <div className="max-w-2xl rounded-3xl border border-white/10 bg-white/[0.03] p-6">
          <div className="space-y-5">
            <div>
              <div className="text-xs uppercase tracking-wider text-slate-500">
                From
              </div>

              <div className="mt-2 break-all font-mono text-sm text-slate-300">
                {address}
              </div>
            </div>

            <div className="border-t border-white/10 pt-5">
              <div className="text-xs uppercase tracking-wider text-slate-500">
                To
              </div>

              <div className="mt-2 break-all font-mono text-sm text-slate-300">
                {toAddress.trim()}
              </div>
            </div>

            <div className="border-t border-white/10 pt-5">
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-500">Amount</span>

                <span className="font-medium text-white">{amount} TAT</span>
              </div>
            </div>

            <div className="border-t border-white/10 pt-5">
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-500">Network fee</span>

                <span className="font-medium text-slate-200">
                  ~{reviewFee} TAT
                </span>
              </div>
            </div>

            <div className="border-t border-white/10 pt-5">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-slate-300">
                  Total
                </span>

                <span className="text-lg font-semibold text-white">
                  {addTatValues(amount, reviewFee)} TAT
                </span>
              </div>
            </div>
          </div>

          <div className="mt-7 grid gap-3 sm:grid-cols-2">
            <button
              type="button"
              disabled={sending}
              onClick={() => {
                setConfirming(false);
                setError("");
              }}
              className="rounded-xl border border-white/10 bg-white/5 px-5 py-3 text-sm font-semibold text-white transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Back
            </button>

            <button
              type="button"
              disabled={sending}
              onClick={() => {
                void handleConfirmSend();
              }}
              className="rounded-xl bg-cyan-400 px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-cyan-300 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {sending ? "Signing & broadcasting..." : "Confirm & Send"}
            </button>
          </div>

          {error && (
            <div className="mt-4 rounded-xl border border-red-400/20 bg-red-400/[0.05] p-3 text-sm text-red-300">
              {error}
            </div>
          )}
        </div>
      </div>
    );
  }

  if (walletLocked) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold text-white">Send TAT</h1>

          <p className="mt-1 text-sm text-slate-500">
            Send TatCoin to another address.
          </p>
        </div>

        <div className="max-w-2xl rounded-3xl border border-amber-400/20 bg-amber-400/[0.05] p-6">
          <div className="text-lg font-semibold text-amber-300">
            Wallet locked
          </div>

          <p className="mt-2 text-sm leading-6 text-slate-400">
            Unlock your wallet before signing and sending transactions.
          </p>

          <div className="mt-4 break-all rounded-2xl border border-white/10 bg-black/20 p-4 font-mono text-sm text-slate-300">
            {address}
          </div>

          <Link
            to="/wallet"
            className="mt-5 inline-flex rounded-xl bg-amber-400 px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-amber-300"
          >
            Unlock wallet
          </Link>
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

              clearResult();
              setEstimatedFee(null);
            }}
            onBlur={() => {
              void handleEstimateFee();
            }}
            placeholder="tat1..."
            spellCheck={false}
            autoComplete="off"
            className="mt-2 w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 font-mono text-sm text-white outline-none transition placeholder:text-slate-700 focus:border-cyan-400/40"
          />
        </div>

        <div className="mt-5">
          <div className="flex items-center justify-between gap-4">
            <label className="text-sm font-medium text-slate-300">Amount</label>

            <div className="flex items-center gap-3 text-xs">
              <span className="text-slate-500">
                Available:{" "}
                <span className="font-medium text-slate-300">
                  {balanceQuery.isLoading
                    ? "Loading..."
                    : balanceQuery.isError
                      ? "Unavailable"
                      : `${availableBalance ?? "0.000000"} TAT`}
                </span>
              </span>

              <button
                type="button"
                onClick={() => {
                  void handleMax();
                }}
                disabled={
                  !balanceQuery.data || !toAddress.trim() || estimatingFee
                }
                className="font-semibold text-cyan-300 transition hover:text-cyan-200 disabled:cursor-not-allowed disabled:opacity-40"
              >
                MAX
              </button>
            </div>
          </div>

          <div className="relative mt-2">
            <input
              value={amount}
              onChange={(event) => {
                setAmount(event.target.value);

                clearResult();
                setEstimatedFee(null);
              }}
              onBlur={() => {
                void handleEstimateFee();
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

        <div className="mt-5 rounded-2xl border border-white/10 bg-black/10 p-4">
          <div className="flex items-center justify-between text-sm">
            <span className="text-slate-500">Network fee</span>

            <span className="font-medium text-slate-200">
              {estimatingFee
                ? "Estimating..."
                : estimatedFee
                  ? `~${estimatedFee} TAT`
                  : "—"}
            </span>
          </div>

          {estimatedFee && amount && (
            <div className="mt-3 flex items-center justify-between border-t border-white/10 pt-3 text-sm">
              <span className="text-slate-500">Total</span>

              <span className="font-medium text-white">
                {addTatValues(amount, estimatedFee)} TAT
              </span>
            </div>
          )}
        </div>

        <button
          type="button"
          disabled={!canReview}
          onClick={() => {
            void handleReview();
          }}
          className="mt-6 w-full rounded-xl bg-cyan-400 px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-cyan-300 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {estimatingFee ? "Preparing..." : "Review transaction"}
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
