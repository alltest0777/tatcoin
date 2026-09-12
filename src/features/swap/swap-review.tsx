import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";

import {
  broadcastEthereumTransaction,
  getEthereumTransactionReceipt,
} from "../../services/ethereum";

import type { BuiltEthereumTransaction } from "../../lib/ethereum-transaction";
import { signEthereumTransaction } from "../../lib/ethereum-wallet";

import type { SwapExecutionPlan, SwapToken } from "../../services/swap";
import { formatSwapAmount } from "../../services/swap";

interface SwapReviewProps {
  ethAddress: string;
  sellToken: SwapToken;
  buyToken: SwapToken;
  sellAmount: bigint;
  plan: SwapExecutionPlan;
  onBack: () => void;
}

function weiToGwei(value: bigint): string {
  const divisor = 1_000_000_000n;
  const whole = value / divisor;
  const fraction = value % divisor;

  const formattedFraction = fraction
    .toString()
    .padStart(9, "0")
    .replace(/0+$/, "");

  return formattedFraction
    ? `${whole.toString()}.${formattedFraction}`
    : whole.toString();
}

export default function SwapReview({
  ethAddress,
  sellToken,
  buyToken,
  sellAmount,
  plan,
  onBack,
}: SwapReviewProps) {
  const maximumEthDebit =
    sellToken === "ETH"
      ? sellAmount + plan.fee.estimatedFee
      : plan.fee.estimatedFee;
  const [mnemonic, setMnemonic] = useState("");
  const [signing, setSigning] = useState(false);
  const [signed, setSigned] = useState<BuiltEthereumTransaction | null>(null);
  const [error, setError] = useState("");

  const queryClient = useQueryClient();

  const [signedAt, setSignedAt] = useState<number | null>(null);
  const [broadcasting, setBroadcasting] = useState(false);
  const [broadcastTxid, setBroadcastTxid] = useState<string | null>(null);
  const [receiptStatus, setReceiptStatus] = useState<
    "idle" | "pending" | "confirmed" | "failed"
  >("idle");
  const [actualFee, setActualFee] = useState<bigint | null>(null);
  const [confirmedBlock, setConfirmedBlock] = useState<bigint | null>(null);

  function handleSign() {
    try {
      setSigning(true);
      setError("");
      setSigned(null);

      setSignedAt(null);
      setBroadcastTxid(null);
      setReceiptStatus("idle");
      setActualFee(null);
      setConfirmedBlock(null);

      const quoteAge = Date.now() - plan.preparedAt;

      if (quoteAge > 120_000) {
        throw new Error(
          "This quote is older than two minutes. Go back and prepare a fresh quote.",
        );
      }

      const normalizedMnemonic = mnemonic.trim().replace(/\s+/g, " ");

      if (!normalizedMnemonic) {
        throw new Error("Enter your recovery phrase");
      }

      const result = signEthereumTransaction({
        mnemonic: normalizedMnemonic,
        expectedFromAddress: ethAddress,
        chainId: plan.fee.chainId,
        nonce: plan.fee.nonce,
        to: plan.quote.transaction.to,
        value: BigInt(plan.quote.transaction.value),
        gasLimit: plan.fee.gasLimit,
        maxPriorityFeePerGas: plan.fee.maxPriorityFeePerGas,
        maxFeePerGas: plan.fee.maxFeePerGas,
        data: plan.quote.transaction.data,
      });

      setSigned(result);
      setSignedAt(Date.now());
      setMnemonic("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to sign swap");
    } finally {
      setSigning(false);
    }
  }

  async function handleBroadcast() {
    if (!signed || signedAt === null) {
      return;
    }

    if (Date.now() - plan.preparedAt > 120_000) {
      setError(
        "This signed quote is older than two minutes. Go back and prepare a fresh quote.",
      );
      return;
    }

    const confirmed = window.confirm(
      `Broadcast this swap to Ethereum Mainnet?\n\n` +
        `Sell: ${formatSwapAmount(sellAmount, sellToken)} ${sellToken}\n` +
        `Minimum received: ${formatSwapAmount(
          plan.quote.minBuyAmount,
          buyToken,
        )} ${buyToken}\n\n` +
        `This action is irreversible and costs ETH gas.`,
    );

    if (!confirmed) {
      return;
    }

    try {
      setBroadcasting(true);
      setError("");
      setReceiptStatus("pending");
      setActualFee(null);
      setConfirmedBlock(null);

      const txid = await broadcastEthereumTransaction(signed.rawTxHex);

      if (txid.toLowerCase() !== signed.txid.toLowerCase()) {
        throw new Error(
          "Broadcast TXID does not match the locally signed swap",
        );
      }

      setBroadcastTxid(txid);

      for (let attempt = 0; attempt < 30; attempt += 1) {
        const receipt = await getEthereumTransactionReceipt(txid);

        if (receipt) {
          if (receipt.status === "0x1") {
            const gasUsed = BigInt(receipt.gasUsed);
            const effectiveGasPrice = BigInt(receipt.effectiveGasPrice);

            setActualFee(gasUsed * effectiveGasPrice);
            setConfirmedBlock(BigInt(receipt.blockNumber));
            setReceiptStatus("confirmed");

            await Promise.all([
              queryClient.invalidateQueries({
                queryKey: ["ethereum-balance", ethAddress],
              }),
              queryClient.invalidateQueries({
                queryKey: ["usdt-balance", ethAddress],
              }),
            ]);

            return;
          }

          if (receipt.status === "0x0") {
            setReceiptStatus("failed");
            return;
          }
        }

        await new Promise((resolve) => window.setTimeout(resolve, 3000));
      }

      setReceiptStatus("pending");
    } catch (err) {
      setReceiptStatus("idle");
      setError(err instanceof Error ? err.message : "Failed to broadcast swap");
    } finally {
      setBroadcasting(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-white">Review swap</h1>
        <p className="mt-1 text-sm text-slate-500">
          Review the final 0x quote before local signing.
        </p>
      </div>

      <div className="max-w-3xl rounded-3xl border border-white/10 bg-white/[0.03] p-6">
        <div className="space-y-5">
          <div>
            <div className="text-xs uppercase tracking-wider text-slate-500">
              From
            </div>
            <div className="mt-2 break-all font-mono text-sm text-violet-300">
              {ethAddress}
            </div>
          </div>

          <div className="grid gap-3 border-t border-white/10 pt-5 sm:grid-cols-2">
            <div className="rounded-xl border border-white/10 bg-black/10 p-4">
              <div className="text-xs text-slate-500">You sell</div>
              <div className="mt-2 text-lg font-semibold text-white">
                {formatSwapAmount(sellAmount, sellToken)} {sellToken}
              </div>
            </div>

            <div className="rounded-xl border border-white/10 bg-black/10 p-4">
              <div className="text-xs text-slate-500">Expected receive</div>
              <div className="mt-2 text-lg font-semibold text-white">
                {formatSwapAmount(plan.quote.buyAmount, buyToken)} {buyToken}
              </div>
            </div>
          </div>

          <div className="border-t border-white/10 pt-5">
            <div className="flex justify-between gap-4">
              <span className="text-sm text-slate-500">Minimum received</span>
              <span className="font-medium text-white">
                {formatSwapAmount(plan.quote.minBuyAmount, buyToken)} {buyToken}
              </span>
            </div>

            <div className="mt-3 flex justify-between gap-4">
              <span className="text-sm text-slate-500">
                Slippage protection
              </span>
              <span className="font-medium text-white">1%</span>
            </div>
          </div>

          <div className="grid gap-3 border-t border-white/10 pt-5 sm:grid-cols-2">
            <div className="rounded-xl border border-white/10 bg-black/10 p-3">
              <div className="text-xs text-slate-500">Network</div>
              <div className="mt-1 text-sm font-medium text-white">
                Ethereum Mainnet
              </div>
            </div>

            <div className="rounded-xl border border-white/10 bg-black/10 p-3">
              <div className="text-xs text-slate-500">Nonce</div>
              <div className="mt-1 text-sm font-medium text-white">
                {plan.fee.nonce.toString()}
              </div>
            </div>

            <div className="rounded-xl border border-white/10 bg-black/10 p-3">
              <div className="text-xs text-slate-500">Gas limit</div>
              <div className="mt-1 text-sm font-medium text-white">
                {plan.fee.gasLimit.toString()}
              </div>
            </div>

            <div className="rounded-xl border border-white/10 bg-black/10 p-3">
              <div className="text-xs text-slate-500">Max fee per gas</div>
              <div className="mt-1 text-sm font-medium text-white">
                {weiToGwei(plan.fee.maxFeePerGas)} Gwei
              </div>
            </div>
          </div>

          <div className="border-t border-white/10 pt-5">
            <div className="flex justify-between gap-4">
              <span className="text-sm text-slate-500">
                Maximum network fee
              </span>
              <span className="font-medium text-white">
                {formatSwapAmount(plan.fee.estimatedFee, "ETH")} ETH
              </span>
            </div>

            {sellToken === "ETH" && (
              <div className="mt-3 flex justify-between gap-4">
                <span className="text-sm text-slate-500">
                  Maximum ETH debit
                </span>
                <span className="font-medium text-white">
                  {formatSwapAmount(maximumEthDebit, "ETH")} ETH
                </span>
              </div>
            )}
          </div>

          <div className="border-t border-white/10 pt-5">
            <div className="text-xs uppercase tracking-wider text-slate-500">
              Transaction target
            </div>
            <div className="mt-2 break-all font-mono text-xs text-violet-300">
              {plan.quote.transaction.to}
            </div>
          </div>

          <div>
            <div className="text-xs uppercase tracking-wider text-slate-500">
              Transaction data
            </div>
            <div className="mt-2 max-h-36 overflow-auto break-all rounded-xl border border-white/10 bg-black/20 p-3 font-mono text-xs leading-5 text-slate-300">
              {plan.quote.transaction.data}
            </div>
          </div>

          <div className="rounded-2xl border border-amber-400/20 bg-amber-400/[0.05] p-4 text-sm leading-6 text-amber-100">
            Quotes are time-sensitive. This review was prepared at{" "}
            {new Date(plan.preparedAt).toLocaleTimeString()}. Nothing has been
            signed or broadcast.
          </div>

          {!signed && (
            <div className="border-t border-white/10 pt-5">
              <label className="text-sm font-medium text-slate-300">
                Recovery phrase
              </label>

              <p className="mt-1 text-xs leading-5 text-slate-500">
                Used only in this browser to derive the Ethereum private key and
                sign this swap locally.
              </p>

              <textarea
                value={mnemonic}
                onChange={(event) => {
                  setMnemonic(event.target.value);
                  setError("");
                }}
                rows={3}
                placeholder="Enter your recovery phrase"
                spellCheck={false}
                autoComplete="off"
                className="mt-3 w-full resize-none rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none transition placeholder:text-slate-700 focus:border-violet-400/40"
              />
            </div>
          )}

          {signed && (
            <div className="rounded-2xl border border-emerald-400/20 bg-emerald-400/[0.05] p-4">
              <div className="text-sm font-semibold text-emerald-200">
                Swap signed locally
              </div>

              <div className="mt-3 text-xs uppercase tracking-wider text-slate-500">
                TXID
              </div>

              <div className="mt-2 break-all font-mono text-xs text-emerald-300">
                {signed.txid}
              </div>

              <div className="mt-3 text-xs uppercase tracking-wider text-slate-500">
                Raw transaction
              </div>

              <div className="mt-2 max-h-36 overflow-auto break-all rounded-xl border border-white/10 bg-black/20 p-3 font-mono text-xs leading-5 text-slate-300">
                {signed.rawTxHex}
              </div>

              <div className="mt-3 rounded-xl border border-cyan-400/20 bg-cyan-400/[0.05] p-3 text-sm leading-6 text-cyan-200">
                {broadcastTxid ? (
                  <>
                    {receiptStatus === "confirmed" ? (
                      <>
                        Swap confirmed on Ethereum Mainnet.
                        {confirmedBlock !== null && (
                          <div className="mt-2">
                            Block: {confirmedBlock.toString()}
                          </div>
                        )}
                        {actualFee !== null && (
                          <div>
                            Actual network fee:{" "}
                            {formatSwapAmount(actualFee, "ETH")} ETH
                          </div>
                        )}
                      </>
                    ) : receiptStatus === "failed" ? (
                      <>Swap transaction failed on Ethereum Mainnet.</>
                    ) : (
                      <>
                        Swap broadcast successfully. Waiting for confirmation...
                      </>
                    )}

                    <div className="mt-2 break-all font-mono text-xs text-emerald-200">
                      TXID: {broadcastTxid}
                    </div>

                    <a
                      href={`https://etherscan.io/tx/${broadcastTxid}`}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-2 inline-block text-cyan-300 underline"
                    >
                      View on Etherscan
                    </a>
                  </>
                ) : (
                  <>Signed locally but not broadcast to Ethereum Mainnet.</>
                )}
              </div>
            </div>
          )}

          {error && (
            <div className="rounded-xl border border-red-400/20 bg-red-400/[0.05] p-3 text-sm text-red-300">
              {error}
            </div>
          )}

          <div className="grid gap-3 sm:grid-cols-2">
            <button
              type="button"
              disabled={signing || broadcasting}
              onClick={onBack}
              className="rounded-xl border border-white/10 bg-white/5 px-5 py-3 text-sm font-semibold text-white transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Back
            </button>

            {!signed ? (
              <button
                type="button"
                disabled={signing || !mnemonic.trim()}
                onClick={handleSign}
                className="rounded-xl bg-violet-400 px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-violet-300 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {signing ? "Signing locally..." : "Sign swap locally"}
              </button>
            ) : (
              <button
                type="button"
                disabled={broadcasting || Boolean(broadcastTxid)}
                onClick={() => {
                  void handleBroadcast();
                }}
                className="rounded-xl bg-emerald-400 px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-emerald-300 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {broadcastTxid
                  ? receiptStatus === "confirmed"
                    ? "Swap confirmed"
                    : "Swap broadcast"
                  : broadcasting
                    ? "Broadcasting..."
                    : "Broadcast swap"}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
