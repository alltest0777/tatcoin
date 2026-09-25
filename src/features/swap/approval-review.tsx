import { assertWalletSession } from "../../stores/wallet-store";
import { useState } from "react";

import { useQueryClient } from "@tanstack/react-query";

import {
  broadcastEthereumTransaction,
  getEthereumTransactionReceipt,
  type EthereumTransactionFee,
} from "../../services/ethereum";
import type { BuiltEthereumTransaction } from "../../lib/ethereum-transaction";
import { signSessionEthereum as signEthereumTransaction } from "../../stores/wallet-store";
import { USDT_CONTRACT_ADDRESS } from "../../services/usdt";
import {
  encodeUsdtApproval,
  formatSwapAmount,
  parseSwapAmount,
  ZEROX_ALLOWANCE_HOLDER,
} from "../../services/swap";

interface ApprovalReviewProps {
  ethAddress: string;
  amount: string;
  plan: EthereumTransactionFee;
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

export default function ApprovalReview({
  ethAddress,
  amount,
  plan,
  onBack,
}: ApprovalReviewProps) {
  const [signing, setSigning] = useState(false);
  const [signed, setSigned] = useState<BuiltEthereumTransaction | null>(null);
  const [error, setError] = useState("");
  const queryClient = useQueryClient();

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

      const approvalAmount = parseSwapAmount(amount, "USDT");
      const data = encodeUsdtApproval(approvalAmount);

      const result = signEthereumTransaction({
        expectedFromAddress: ethAddress,
        chainId: plan.chainId,
        nonce: plan.nonce,
        to: USDT_CONTRACT_ADDRESS,
        value: 0n,
        gasLimit: plan.gasLimit,
        maxPriorityFeePerGas: plan.maxPriorityFeePerGas,
        maxFeePerGas: plan.maxFeePerGas,
        data,
      });

      setSigned(result);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to sign USDT approval",
      );
    } finally {
      setSigning(false);
    }
  }

  async function handleBroadcast() {
    if (!signed) {
      return;
    }

    const confirmed = window.confirm(
      `Broadcast this USDT approval to Ethereum Mainnet?\n\n` +
        `Allowance: exactly ${amount} USDT\n` +
        `Spender: ${ZEROX_ALLOWANCE_HOLDER}\n\n` +
        `This costs ETH gas but does not execute the swap.`,
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

      assertWalletSession();

      const txid = await broadcastEthereumTransaction(signed.rawTxHex);

      if (txid.toLowerCase() !== signed.txid.toLowerCase()) {
        throw new Error(
          "Broadcast TXID does not match the locally signed approval",
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

            await queryClient.invalidateQueries({
              queryKey: ["ethereum-balance", ethAddress],
            });

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
      setError(
        err instanceof Error
          ? err.message
          : "Failed to broadcast USDT approval",
      );
    } finally {
      setBroadcasting(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-white">
          Review USDT approval
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Allow 0x to spend exactly {amount} USDT for this swap.
        </p>
      </div>

      <div className="max-w-2xl rounded-3xl border border-white/10 bg-white/[0.03] p-6">
        <div className="space-y-5">
          <div>
            <div className="text-xs uppercase tracking-wider text-slate-500">
              Token
            </div>
            <div className="mt-2 font-medium text-white">USDT</div>
          </div>

          <div className="border-t border-white/10 pt-5">
            <div className="text-xs uppercase tracking-wider text-slate-500">
              Approval amount
            </div>
            <div className="mt-2 font-medium text-white">{amount} USDT</div>
          </div>

          <div className="border-t border-white/10 pt-5">
            <div className="text-xs uppercase tracking-wider text-slate-500">
              Authorized spender
            </div>
            <div className="mt-2 break-all font-mono text-sm text-violet-300">
              {ZEROX_ALLOWANCE_HOLDER}
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
                {plan.nonce.toString()}
              </div>
            </div>

            <div className="rounded-xl border border-white/10 bg-black/10 p-3">
              <div className="text-xs text-slate-500">Gas limit</div>
              <div className="mt-1 text-sm font-medium text-white">
                {plan.gasLimit.toString()}
              </div>
            </div>

            <div className="rounded-xl border border-white/10 bg-black/10 p-3">
              <div className="text-xs text-slate-500">Max fee per gas</div>
              <div className="mt-1 text-sm font-medium text-white">
                {weiToGwei(plan.maxFeePerGas)} Gwei
              </div>
            </div>
          </div>

          <div className="border-t border-white/10 pt-5">
            <div className="flex items-center justify-between gap-4">
              <span className="text-sm text-slate-500">
                Maximum network fee
              </span>
              <span className="font-medium text-white">
                {formatSwapAmount(plan.estimatedFee, "ETH")} ETH
              </span>
            </div>
          </div>

          <div className="rounded-2xl border border-amber-400/20 bg-amber-400/[0.05] p-4 text-sm leading-6 text-amber-100">
            This approval is limited to exactly {amount} USDT. It does not
            execute the swap.
          </div>

          <p className="mt-4 text-sm text-slate-400">Signing uses your unlocked wallet session. Review the transaction before signing.</p>

          {signed && (
            <div className="rounded-2xl border border-emerald-400/20 bg-emerald-400/[0.05] p-4">
              <div className="text-sm font-semibold text-emerald-200">
                Approval signed locally
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
                        Approval confirmed on Ethereum Mainnet.
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
                      <>Approval transaction failed on Ethereum Mainnet.</>
                    ) : (
                      <>
                        Approval broadcast successfully. Waiting for
                        confirmation...
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
              disabled={signing || broadcasting || receiptStatus === "pending"}
              onClick={onBack}
              className="rounded-xl border border-white/10 bg-white/5 px-5 py-3 text-sm font-semibold text-white transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Back
            </button>

            {!signed ? (
              <button
                type="button"
                disabled={signing}
                onClick={handleSign}
                className="rounded-xl bg-violet-400 px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-violet-300 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {signing ? "Signing locally..." : "Sign approval locally"}
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
                    ? "Approval confirmed"
                    : "Approval broadcast"
                  : broadcasting
                    ? "Broadcasting..."
                    : "Broadcast approval"}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
