import { Link } from "react-router-dom";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import { formatTatBalance, getTatBalance } from "../../services/bank";
import { estimateSendFee, sendTat } from "../../services/send";
import {
  formatBitcoinBalance,
  getBitcoinBalance,
  getBitcoinFeeRates,
  getBitcoinUtxos,
  broadcastBitcoinTransaction,
} from "../../services/bitcoin";
import { useWalletStore } from "../../stores/wallet-store";
import {
  calculateBitcoinFee,
  planBitcoinTransaction,
  type BitcoinTransactionPlan,
} from "../../lib/bitcoin-transaction";

import { signBitcoinTransaction } from "../../lib/bitcoin-wallet";

import type { BuiltBitcoinTransaction } from "../../lib/bitcoin-transaction";

import {
  broadcastEthereumTransaction,
  formatEthereumBalance,
  getEthereumBalance,
  getEthereumTransactionFee,
  getEthereumTransactionReceipt,
  type EthereumTransactionFee,
} from "../../services/ethereum";
import { signEthereumTransaction } from "../../lib/ethereum-wallet";
import type { BuiltEthereumTransaction } from "../../lib/ethereum-transaction";

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

function btcToSats(value: string): bigint {
  const normalized = value.trim().replace(",", ".");

  if (!/^\d+(\.\d{0,8})?$/.test(normalized)) {
    throw new Error("Invalid Bitcoin amount");
  }

  const [whole, fraction = ""] = normalized.split(".");
  const paddedFraction = fraction.padEnd(8, "0");

  return BigInt(whole) * 100_000_000n + BigInt(paddedFraction);
}

function satsToBtc(value: bigint): string {
  const whole = value / 100_000_000n;
  const fraction = value % 100_000_000n;

  return `${whole}.${fraction.toString().padStart(8, "0")}`;
}

function ethToWei(value: string): bigint {
  const normalized = value.trim().replace(",", ".");

  if (!/^\d+(\.\d{0,18})?$/.test(normalized)) {
    throw new Error("Invalid Ethereum amount");
  }

  const [whole, fraction = ""] = normalized.split(".");
  const paddedFraction = fraction.padEnd(18, "0");

  return BigInt(whole) * 1_000_000_000_000_000_000n + BigInt(paddedFraction);
}

function weiToEth(value: bigint): string {
  const divisor = 1_000_000_000_000_000_000n;
  const whole = value / divisor;
  const fraction = value % divisor;

  return `${whole}.${fraction.toString().padStart(18, "0")}`;
}

function weiToGwei(value: bigint): string {
  const divisor = 1_000_000_000n;
  const whole = value / divisor;
  const fraction = value % divisor;

  return `${whole}.${fraction.toString().padStart(9, "0")}`;
}

type BitcoinFeeMode = "fast" | "normal" | "economy";

export default function Send() {
  const queryClient = useQueryClient();

  const address = useWalletStore((state) => state.address);
  const signer = useWalletStore((state) => state.signer);
  const btcAddress = useWalletStore((state) => state.btcAddress);
  const ethAddress = useWalletStore((state) => state.ethAddress);
  const walletLocked = Boolean(address && !signer);

  const [asset, setAsset] = useState<"tat" | "btc" | "eth">("tat");

  const balanceQuery = useQuery({
    queryKey: ["tat-balance", address],
    queryFn: () => getTatBalance(address!),
    enabled: Boolean(address),
    refetchInterval: 10_000,
  });

  const bitcoinBalanceQuery = useQuery({
    queryKey: ["bitcoin-balance", btcAddress],
    queryFn: () => getBitcoinBalance(btcAddress!),
    enabled: asset === "btc" && Boolean(btcAddress),
    refetchInterval: 30_000,
  });

  const bitcoinUtxosQuery = useQuery({
    queryKey: ["bitcoin-utxos", btcAddress],
    queryFn: () => getBitcoinUtxos(btcAddress!),
    enabled: asset === "btc" && Boolean(btcAddress),
    refetchInterval: 30_000,
  });

  const bitcoinFeesQuery = useQuery({
    queryKey: ["bitcoin-fee-rates"],
    queryFn: getBitcoinFeeRates,
    enabled: asset === "btc",
    refetchInterval: 60_000,
  });

  const ethereumBalanceQuery = useQuery({
    queryKey: ["ethereum-balance", ethAddress],
    queryFn: () => getEthereumBalance(ethAddress!),
    enabled: asset === "eth" && Boolean(ethAddress),
    refetchInterval: 30_000,
  });

  const availableBalance =
    address && balanceQuery.data ? formatTatBalance(balanceQuery.data) : null;

  const availableBitcoinBalance =
    btcAddress && bitcoinBalanceQuery.data !== undefined
      ? formatBitcoinBalance(bitcoinBalanceQuery.data.total)
      : null;

  const confirmedBitcoinBalance =
    btcAddress && bitcoinBalanceQuery.data !== undefined
      ? formatBitcoinBalance(bitcoinBalanceQuery.data.confirmed)
      : null;

  const unconfirmedBitcoinBalance =
    btcAddress && bitcoinBalanceQuery.data !== undefined
      ? formatBitcoinBalance(bitcoinBalanceQuery.data.unconfirmed)
      : null;

  const availableEthereumBalance =
    ethAddress && ethereumBalanceQuery.data !== undefined
      ? formatEthereumBalance(ethereumBalanceQuery.data)
      : null;

  const [toAddress, setToAddress] = useState("");
  const [amount, setAmount] = useState("");

  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [txHash, setTxHash] = useState("");
  const [height, setHeight] = useState<number | null>(null);

  const [estimatedFee, setEstimatedFee] = useState<string | null>(null);

  const [estimatingFee, setEstimatingFee] = useState(false);

  const [confirming, setConfirming] = useState(false);

  const [btcToAddress, setBtcToAddress] = useState("");
  const [btcAmount, setBtcAmount] = useState("");
  const [btcFeeMode, setBtcFeeMode] = useState<BitcoinFeeMode>("normal");
  const [btcPlan, setBtcPlan] = useState<BitcoinTransactionPlan | null>(null);
  const [btcError, setBtcError] = useState("");
  const [btcReviewing, setBtcReviewing] = useState(false);
  const [btcMnemonic, setBtcMnemonic] = useState("");
  const [btcSigning, setBtcSigning] = useState(false);
  const [btcSigned, setBtcSigned] = useState<BuiltBitcoinTransaction | null>(
    null,
  );
  const [btcBroadcasting, setBtcBroadcasting] = useState(false);
  const [btcBroadcastTxid, setBtcBroadcastTxid] = useState<string | null>(null);

  const [ethToAddress, setEthToAddress] = useState("");
  const [ethAmount, setEthAmount] = useState("");
  const [ethPlan, setEthPlan] = useState<EthereumTransactionFee | null>(null);
  const [ethError, setEthError] = useState("");
  const [ethReviewing, setEthReviewing] = useState(false);
  const [ethMnemonic, setEthMnemonic] = useState("");
  const [ethSigning, setEthSigning] = useState(false);
  const [ethSigned, setEthSigned] = useState<BuiltEthereumTransaction | null>(
    null,
  );
  const [ethPreparing, setEthPreparing] = useState(false);

  const [ethBroadcasting, setEthBroadcasting] = useState(false);
  const [ethBroadcastTxid, setEthBroadcastTxid] = useState<string | null>(null);

  const [ethReceiptStatus, setEthReceiptStatus] = useState<
    "idle" | "pending" | "confirmed" | "failed"
  >("idle");

  const [ethActualFee, setEthActualFee] = useState<bigint | null>(null);
  const [ethConfirmedBlock, setEthConfirmedBlock] = useState<bigint | null>(
    null,
  );

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

  if (walletLocked && asset === "tat") {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold text-white">Send TAT</h1>
          <p className="mt-1 text-sm text-slate-500">
            Send TatCoin to another address.
          </p>
        </div>

        <div className="flex gap-2">
          <button
            type="button"
            className="rounded-xl bg-cyan-400 px-4 py-2.5 text-sm font-semibold text-slate-950"
          >
            TAT
          </button>
          <button
            type="button"
            onClick={() => setAsset("btc")}
            className="rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-white/10"
          >
            BTC
          </button>
          <button
            type="button"
            onClick={() => setAsset("eth")}
            className="rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-white/10"
          >
            ETH
          </button>
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

  if (asset === "eth") {
    async function handleEthereumMax() {
      if (!ethAddress || !ethereumBalanceQuery.data) {
        return;
      }

      const recipient = ethToAddress.trim();

      if (!/^0x[a-fA-F0-9]{40}$/.test(recipient)) {
        setEthError(
          "Enter a valid Ethereum recipient address before using MAX",
        );
        return;
      }

      try {
        setEthPreparing(true);
        setEthError("");
        setEthPlan(null);
        setEthSigned(null);

        const balanceWei = BigInt(ethereumBalanceQuery.data);

        const initialFee = await getEthereumTransactionFee({
          from: ethAddress,
          to: recipient,
          value: 0n,
        });

        let maxValue = balanceWei - initialFee.estimatedFee;

        if (maxValue <= 0n) {
          throw new Error(
            "Ethereum balance is too low to cover the network fee",
          );
        }

        const finalFee = await getEthereumTransactionFee({
          from: ethAddress,
          to: recipient,
          value: maxValue,
        });

        maxValue = balanceWei - finalFee.estimatedFee;

        if (maxValue <= 0n) {
          throw new Error(
            "Ethereum balance is too low to cover the network fee",
          );
        }

        setEthAmount(weiToEth(maxValue));
      } catch (err) {
        setEthError(
          err instanceof Error
            ? err.message
            : "Unable to calculate maximum Ethereum amount",
        );
      } finally {
        setEthPreparing(false);
      }
    }

    async function prepareEthereumReview() {
      if (!ethAddress || !ethereumBalanceQuery.data) {
        return;
      }

      try {
        setEthPreparing(true);
        setEthError("");
        setEthPlan(null);
        setEthSigned(null);

        const recipient = ethToAddress.trim();

        if (!/^0x[a-fA-F0-9]{40}$/.test(recipient)) {
          throw new Error("Invalid Ethereum recipient address");
        }

        const value = ethToWei(ethAmount);

        if (value <= 0n) {
          throw new Error("Amount must be greater than zero");
        }

        const plan = await getEthereumTransactionFee({
          from: ethAddress,
          to: recipient,
          value,
        });

        const balanceWei = BigInt(ethereumBalanceQuery.data);
        const maximumTotal = value + plan.estimatedFee;

        if (maximumTotal > balanceWei) {
          throw new Error(
            "Insufficient ETH balance to cover amount and maximum network fee",
          );
        }

        setEthPlan(plan);
        setEthMnemonic("");
        setEthReviewing(true);
      } catch (err) {
        setEthReviewing(false);
        setEthError(
          err instanceof Error
            ? err.message
            : "Unable to prepare Ethereum transaction",
        );
      } finally {
        setEthPreparing(false);
      }
    }

    function handleEthereumSign() {
      if (!ethAddress || !ethPlan) {
        return;
      }

      try {
        setEthSigning(true);
        setEthError("");
        setEthSigned(null);

        const mnemonic = ethMnemonic.trim().replace(/\s+/g, " ");

        if (!mnemonic) {
          throw new Error("Enter your recovery phrase");
        }

        const signed = signEthereumTransaction({
          mnemonic,
          expectedFromAddress: ethAddress,
          chainId: ethPlan.chainId,
          nonce: ethPlan.nonce,
          to: ethToAddress.trim(),
          value: ethToWei(ethAmount),
          gasLimit: ethPlan.gasLimit,
          maxPriorityFeePerGas: ethPlan.maxPriorityFeePerGas,
          maxFeePerGas: ethPlan.maxFeePerGas,
          data: "0x",
        });

        setEthSigned(signed);
        setEthMnemonic("");
      } catch (err) {
        setEthError(
          err instanceof Error
            ? err.message
            : "Failed to sign Ethereum transaction",
        );
      } finally {
        setEthSigning(false);
      }
    }

    async function handleEthereumBroadcast() {
      if (!ethSigned || !ethAddress) {
        return;
      }

      const confirmed = window.confirm(
        "Broadcast this signed transaction to Ethereum Mainnet?\n\n" +
          "This action is irreversible.",
      );

      if (!confirmed) {
        return;
      }

      try {
        setEthBroadcasting(true);
        setEthError("");
        setEthReceiptStatus("pending");
        setEthActualFee(null);
        setEthConfirmedBlock(null);

        const txid = await broadcastEthereumTransaction(ethSigned.rawTxHex);

        if (txid.toLowerCase() !== ethSigned.txid.toLowerCase()) {
          throw new Error(
            "Broadcast TXID does not match the locally signed transaction",
          );
        }

        setEthBroadcastTxid(txid);

        await queryClient.invalidateQueries({
          queryKey: ["ethereum-balance", ethAddress],
        });

        // Wait for Ethereum Mainnet receipt.
        for (let attempt = 0; attempt < 30; attempt += 1) {
          const receipt = await getEthereumTransactionReceipt(txid);

          if (receipt) {
            if (receipt.status === "0x1") {
              const gasUsed = BigInt(receipt.gasUsed);
              const effectiveGasPrice = BigInt(receipt.effectiveGasPrice);

              setEthActualFee(gasUsed * effectiveGasPrice);

              setEthConfirmedBlock(BigInt(receipt.blockNumber));

              setEthReceiptStatus("confirmed");

              await queryClient.invalidateQueries({
                queryKey: ["ethereum-balance", ethAddress],
              });

              return;
            }

            if (receipt.status === "0x0") {
              setEthReceiptStatus("failed");
              return;
            }
          }

          await new Promise((resolve) => window.setTimeout(resolve, 3000));
        }

        // Transaction was accepted, but we did not see
        // a receipt within the polling window.
        setEthReceiptStatus("pending");
      } catch (err) {
        setEthReceiptStatus("idle");

        setEthError(
          err instanceof Error
            ? err.message
            : "Failed to broadcast Ethereum transaction",
        );
      } finally {
        setEthBroadcasting(false);
      }
    }

    if (ethReviewing && ethPlan) {
      return (
        <div className="space-y-6">
          <div>
            <h1 className="text-2xl font-semibold text-white">
              Review ETH transaction
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              Review and sign locally. Nothing will be broadcast.
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

              <div className="border-t border-white/10 pt-5">
                <div className="text-xs uppercase tracking-wider text-slate-500">
                  To
                </div>
                <div className="mt-2 break-all font-mono text-sm text-slate-300">
                  {ethToAddress.trim()}
                </div>
              </div>

              <div className="border-t border-white/10 pt-5">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-slate-500">Amount</span>
                  <span className="font-medium text-white">
                    {ethAmount} ETH
                  </span>
                </div>
              </div>

              <div className="border-t border-white/10 pt-5 grid gap-3 sm:grid-cols-2">
                <div className="rounded-xl border border-white/10 bg-black/10 p-3">
                  <div className="text-xs text-slate-500">Chain ID</div>
                  <div className="mt-1 text-sm font-medium text-white">
                    {ethPlan.chainId.toString()}
                  </div>
                </div>
                <div className="rounded-xl border border-white/10 bg-black/10 p-3">
                  <div className="text-xs text-slate-500">Nonce</div>
                  <div className="mt-1 text-sm font-medium text-white">
                    {ethPlan.nonce.toString()}
                  </div>
                </div>
                <div className="rounded-xl border border-white/10 bg-black/10 p-3">
                  <div className="text-xs text-slate-500">Gas limit</div>
                  <div className="mt-1 text-sm font-medium text-white">
                    {ethPlan.gasLimit.toString()}
                  </div>
                </div>
                <div className="rounded-xl border border-white/10 bg-black/10 p-3">
                  <div className="text-xs text-slate-500">Base fee</div>
                  <div className="mt-1 text-sm font-medium text-white">
                    {weiToGwei(ethPlan.baseFeePerGas)} Gwei
                  </div>
                </div>
                <div className="rounded-xl border border-white/10 bg-black/10 p-3">
                  <div className="text-xs text-slate-500">Priority fee</div>
                  <div className="mt-1 text-sm font-medium text-white">
                    {weiToGwei(ethPlan.maxPriorityFeePerGas)} Gwei
                  </div>
                </div>
                <div className="rounded-xl border border-white/10 bg-black/10 p-3">
                  <div className="text-xs text-slate-500">Max fee per gas</div>
                  <div className="mt-1 text-sm font-medium text-white">
                    {weiToGwei(ethPlan.maxFeePerGas)} Gwei
                  </div>
                </div>
              </div>

              <div className="border-t border-white/10 pt-5">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-slate-500">
                    Maximum network fee
                  </span>
                  <span className="font-medium text-slate-200">
                    {weiToEth(ethPlan.estimatedFee)} ETH
                  </span>
                </div>
                <div className="mt-2 text-xs leading-5 text-slate-500">
                  EIP-1559 maximum. The actual fee can be lower.
                </div>
              </div>
            </div>

            {!ethSigned && (
              <div className="mt-7 border-t border-white/10 pt-6">
                <label className="text-sm font-medium text-slate-300">
                  Recovery phrase
                </label>
                <p className="mt-1 text-xs leading-5 text-slate-500">
                  Used only in this browser to derive the Ethereum private key
                  and sign this transaction locally.
                </p>
                <textarea
                  value={ethMnemonic}
                  onChange={(event) => {
                    setEthMnemonic(event.target.value);
                    setEthError("");
                  }}
                  rows={3}
                  placeholder="Enter your recovery phrase"
                  spellCheck={false}
                  autoComplete="off"
                  className="mt-3 w-full resize-none rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none transition placeholder:text-slate-700 focus:border-violet-400/40"
                />
                <div className="mt-4 rounded-2xl border border-violet-400/20 bg-violet-400/[0.05] p-4 text-sm leading-6 text-violet-100">
                  The phrase must derive the Ethereum address shown above. It is
                  cleared from this form immediately after successful signing.
                </div>
              </div>
            )}

            {ethError && (
              <div className="mt-4 rounded-xl border border-red-400/20 bg-red-400/[0.05] p-3 text-sm text-red-300">
                {ethError}
              </div>
            )}

            {ethSigned && (
              <div className="mt-6 rounded-2xl border border-emerald-400/20 bg-emerald-400/[0.05] p-5">
                <div className="text-sm font-semibold text-emerald-200">
                  Signed locally
                </div>
                <div className="mt-4 text-xs uppercase tracking-wider text-slate-500">
                  TXID
                </div>
                <div className="mt-2 break-all font-mono text-xs text-emerald-300">
                  {ethSigned.txid}
                </div>
                <div className="mt-4 text-xs uppercase tracking-wider text-slate-500">
                  Raw transaction
                </div>
                <div className="mt-2 max-h-44 overflow-auto break-all rounded-xl border border-white/10 bg-black/20 p-3 font-mono text-xs leading-5 text-slate-300">
                  {ethSigned.rawTxHex}
                </div>
                <div className="mt-4 rounded-xl border border-cyan-400/20 bg-cyan-400/[0.05] p-3 text-sm leading-6 text-cyan-200">
                  {ethBroadcastTxid ? (
                    <>
                      {ethReceiptStatus === "confirmed" ? (
                        <>
                          Transaction confirmed on Ethereum Mainnet.
                          {ethConfirmedBlock !== null && (
                            <div className="mt-2">
                              Block: {ethConfirmedBlock.toString()}
                            </div>
                          )}
                          {ethActualFee !== null && (
                            <div>
                              Actual network fee: {weiToEth(ethActualFee)} ETH
                            </div>
                          )}
                        </>
                      ) : ethReceiptStatus === "failed" ? (
                        <>Transaction failed on Ethereum Mainnet.</>
                      ) : (
                        <>
                          Transaction broadcast successfully. Waiting for
                          confirmation...
                        </>
                      )}

                      <div className="mt-2 break-all font-mono text-xs text-emerald-200">
                        TXID: {ethBroadcastTxid}
                      </div>
                    </>
                  ) : (
                    <>
                      The transaction is signed but has not been broadcast to
                      Ethereum Mainnet.
                    </>
                  )}
                </div>
              </div>
            )}

            <div className="mt-7 grid gap-3 sm:grid-cols-2">
              <button
                type="button"
                disabled={ethSigning}
                onClick={() => {
                  setEthReviewing(false);
                  setEthSigned(null);
                  setEthMnemonic("");
                  setEthBroadcastTxid(null);
                  setEthReceiptStatus("idle");
                  setEthActualFee(null);
                  setEthConfirmedBlock(null);
                  setEthError("");
                }}
                className="rounded-xl border border-white/10 bg-white/5 px-5 py-3 text-sm font-semibold text-white transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Back
              </button>

              {!ethSigned ? (
                <button
                  type="button"
                  disabled={ethSigning || !ethMnemonic.trim()}
                  onClick={handleEthereumSign}
                  className="rounded-xl bg-violet-400 px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-violet-300 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {ethSigning ? "Signing locally..." : "Sign locally"}
                </button>
              ) : (
                <button
                  type="button"
                  disabled={ethBroadcasting || Boolean(ethBroadcastTxid)}
                  onClick={() => {
                    void handleEthereumBroadcast();
                  }}
                  className="rounded-xl bg-emerald-400 px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-emerald-300 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {ethBroadcastTxid
                    ? "Broadcasted"
                    : ethBroadcasting
                      ? "Broadcasting..."
                      : "Broadcast to Ethereum Mainnet"}
                </button>
              )}
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold text-white">Send ETH</h1>
          <p className="mt-1 text-sm text-slate-500">
            Prepare an Ethereum Mainnet EIP-1559 transaction.
          </p>
        </div>

        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setAsset("tat")}
            className="rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-white/10"
          >
            TAT
          </button>
          <button
            type="button"
            onClick={() => setAsset("btc")}
            className="rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-white/10"
          >
            BTC
          </button>
          <button
            type="button"
            className="rounded-xl bg-violet-400 px-4 py-2.5 text-sm font-semibold text-slate-950"
          >
            ETH
          </button>
        </div>

        {!ethAddress ? (
          <div className="max-w-2xl rounded-3xl border border-amber-400/20 bg-amber-400/[0.05] p-6">
            <div className="font-medium text-amber-300">
              Ethereum address unavailable
            </div>
            <p className="mt-2 text-sm text-slate-400">
              Unlock the wallet once to derive your Ethereum address.
            </p>
            <Link
              to="/wallet"
              className="mt-5 inline-flex rounded-xl bg-violet-400 px-5 py-3 text-sm font-semibold text-slate-950"
            >
              Open wallet
            </Link>
          </div>
        ) : (
          <div className="max-w-3xl rounded-3xl border border-white/10 bg-white/[0.03] p-6">
            <div className="text-xs uppercase tracking-wider text-slate-500">
              Ethereum address
            </div>
            <div className="mt-2 break-all font-mono text-sm text-violet-300">
              {ethAddress}
            </div>

            <div className="mt-6 rounded-2xl border border-white/10 bg-black/10 p-4">
              <div className="text-xs uppercase tracking-wider text-slate-500">
                Balance
              </div>
              <div className="mt-2 text-lg font-semibold text-white">
                {ethereumBalanceQuery.isLoading
                  ? "Loading..."
                  : ethereumBalanceQuery.isError
                    ? "Unable to load"
                    : `${availableEthereumBalance ?? "0.000000000000000000"} ETH`}
              </div>
            </div>

            <div className="mt-6">
              <label className="text-sm font-medium text-slate-300">
                Recipient address
              </label>
              <input
                value={ethToAddress}
                onChange={(event) => {
                  setEthToAddress(event.target.value);
                  setEthPlan(null);
                  setEthSigned(null);
                  setEthError("");
                }}
                placeholder="0x..."
                spellCheck={false}
                autoComplete="off"
                className="mt-2 w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 font-mono text-sm text-white outline-none transition placeholder:text-slate-700 focus:border-violet-400/40"
              />
            </div>

            <div className="mt-5">
              <div className="flex items-center justify-between gap-4">
                <label className="text-sm font-medium text-slate-300">
                  Amount
                </label>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-slate-500">
                    Available:{" "}
                    <span className="font-medium text-slate-300">
                      {availableEthereumBalance ?? "0.000000000000000000"} ETH
                    </span>
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      void handleEthereumMax();
                    }}
                    disabled={
                      !ethereumBalanceQuery.data ||
                      !ethToAddress.trim() ||
                      ethPreparing
                    }
                    className="text-xs font-semibold text-violet-300 transition hover:text-violet-200 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    MAX
                  </button>
                </div>
              </div>

              <div className="relative mt-2">
                <input
                  value={ethAmount}
                  onChange={(event) => {
                    setEthAmount(event.target.value);
                    setEthPlan(null);
                    setEthSigned(null);
                    setEthError("");
                  }}
                  placeholder="0.000000000000000000"
                  inputMode="decimal"
                  className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 pr-16 text-white outline-none transition placeholder:text-slate-700 focus:border-violet-400/40"
                />
                <div className="pointer-events-none absolute inset-y-0 right-4 flex items-center text-sm font-medium text-violet-300">
                  ETH
                </div>
              </div>
            </div>

            <button
              type="button"
              disabled={
                !ethToAddress.trim() ||
                !ethAmount.trim() ||
                ethereumBalanceQuery.isLoading ||
                ethPreparing
              }
              onClick={() => {
                void prepareEthereumReview();
              }}
              className="mt-6 w-full rounded-xl bg-violet-400 px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-violet-300 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {ethPreparing ? "Preparing..." : "Review ETH transaction"}
            </button>

            {ethError && (
              <div className="mt-4 rounded-xl border border-red-400/20 bg-red-400/[0.05] p-3 text-sm text-red-300">
                {ethError}
              </div>
            )}

            <div className="mt-5 rounded-2xl border border-cyan-400/20 bg-cyan-400/[0.05] p-4 text-sm leading-6 text-cyan-200">
              ETH transactions are signed locally in your browser. Broadcasting
              is intentionally disabled until the signed transaction is
              independently verified.
            </div>
          </div>
        )}
      </div>
    );
  }

  if (asset === "btc") {
    const utxos = bitcoinUtxosQuery.data ?? [];
    const confirmedUtxos = utxos.filter((utxo) => utxo.status.confirmed);

    const feeRates = bitcoinFeesQuery.data;

    const selectedFeeRate = feeRates ? feeRates[btcFeeMode] : null;

    function handleBitcoinMax() {
      if (!selectedFeeRate) {
        setBtcError("Bitcoin fee rate is not available yet");
        return;
      }

      try {
        setBtcError("");
        setBtcPlan(null);
        setBtcSigned(null);

        if (confirmedUtxos.length === 0) {
          throw new Error("No confirmed Bitcoin funds available");
        }

        const totalInput = confirmedUtxos.reduce(
          (sum, utxo) => sum + BigInt(utxo.value),
          0n,
        );

        // P2WPKH transaction with all confirmed inputs
        // and one recipient output (no change output).
        const fee = calculateBitcoinFee(
          confirmedUtxos.length,
          1,
          selectedFeeRate,
        );

        const maxAmount = totalInput - fee;

        if (maxAmount <= 0n) {
          throw new Error(
            "Bitcoin balance is too small to cover the network fee",
          );
        }

        setBtcAmount(satsToBtc(maxAmount));
      } catch (err) {
        setBtcError(
          err instanceof Error
            ? err.message
            : "Unable to calculate maximum Bitcoin amount",
        );
      }
    }

    function prepareBitcoinReview() {
      if (!btcAddress || !selectedFeeRate) {
        return;
      }

      try {
        setBtcError("");

        const plan = planBitcoinTransaction({
          fromAddress: btcAddress,
          toAddress: btcToAddress.trim(),
          amountSats: btcToSats(btcAmount),
          feeRate: selectedFeeRate,
          utxos,
        });

        setBtcPlan(plan);
        setBtcSigned(null);
        setBtcMnemonic("");
        setBtcReviewing(true);
      } catch (err) {
        setBtcPlan(null);
        setBtcReviewing(false);
        setBtcError(
          err instanceof Error
            ? err.message
            : "Unable to prepare Bitcoin transaction",
        );
      }
    }

    function handleBitcoinSign() {
      if (!btcAddress || !selectedFeeRate || !btcPlan) {
        return;
      }

      try {
        setBtcSigning(true);
        setBtcError("");
        setBtcSigned(null);

        const mnemonic = btcMnemonic.trim().replace(/\s+/g, " ");

        if (!mnemonic) {
          throw new Error("Enter your recovery phrase");
        }

        const signed = signBitcoinTransaction({
          mnemonic,
          expectedFromAddress: btcAddress,
          toAddress: btcToAddress.trim(),
          amountSats: btcPlan.amountSats,
          feeRate: selectedFeeRate,
          utxos,
        });

        setBtcSigned(signed);
        setBtcMnemonic("");
      } catch (err) {
        setBtcError(
          err instanceof Error
            ? err.message
            : "Failed to sign Bitcoin transaction",
        );
      } finally {
        setBtcSigning(false);
      }
    }

    async function handleBitcoinBroadcast() {
      if (!btcSigned) {
        return;
      }

      const confirmed = window.confirm(
        "Broadcast this signed transaction to Bitcoin Mainnet?\n\n" +
          "This action is irreversible.",
      );

      if (!confirmed) {
        return;
      }

      try {
        setBtcBroadcasting(true);
        setBtcError("");

        const txid = await broadcastBitcoinTransaction(btcSigned.rawTxHex);

        if (txid !== btcSigned.txid) {
          throw new Error(
            "Broadcast TXID does not match the locally signed transaction",
          );
        }

        setBtcBroadcastTxid(txid);
        await Promise.all([
          queryClient.invalidateQueries({
            queryKey: ["bitcoin-balance", btcAddress],
          }),
          queryClient.invalidateQueries({
            queryKey: ["bitcoin-utxos", btcAddress],
          }),
        ]);
      } catch (err) {
        setBtcError(
          err instanceof Error
            ? err.message
            : "Failed to broadcast Bitcoin transaction",
        );
      } finally {
        setBtcBroadcasting(false);
      }
    }

    if (btcReviewing && btcPlan) {
      return (
        <div className="space-y-6">
          <div>
            <h1 className="text-2xl font-semibold text-white">
              Review BTC transaction
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              Review the Bitcoin transaction plan. Nothing will be broadcast.
            </p>
          </div>

          <div className="max-w-3xl rounded-3xl border border-white/10 bg-white/[0.03] p-6">
            <div className="space-y-5">
              <div>
                <div className="text-xs uppercase tracking-wider text-slate-500">
                  From
                </div>
                <div className="mt-2 break-all font-mono text-sm text-amber-300">
                  {btcAddress}
                </div>
              </div>

              <div className="border-t border-white/10 pt-5">
                <div className="text-xs uppercase tracking-wider text-slate-500">
                  To
                </div>
                <div className="mt-2 break-all font-mono text-sm text-slate-300">
                  {btcToAddress.trim()}
                </div>
              </div>

              <div className="border-t border-white/10 pt-5">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-slate-500">Amount</span>
                  <span className="font-medium text-white">
                    {satsToBtc(btcPlan.amountSats)} BTC
                  </span>
                </div>
              </div>

              <div className="border-t border-white/10 pt-5">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-slate-500">Network fee</span>
                  <span className="font-medium text-slate-200">
                    {btcPlan.feeSats.toString()} sats
                    {" · "}
                    {satsToBtc(btcPlan.feeSats)} BTC
                  </span>
                </div>
                <div className="mt-2 text-xs text-slate-500">
                  {btcPlan.feeRate.toFixed(2)} sat/vB · estimated{" "}
                  {btcPlan.estimatedVBytes} vB
                </div>
              </div>

              <div className="border-t border-white/10 pt-5">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-slate-500">Change</span>
                  <span className="font-medium text-slate-200">
                    {satsToBtc(btcPlan.changeSats)} BTC
                  </span>
                </div>
              </div>

              <div className="border-t border-white/10 pt-5">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-slate-500">
                    Inputs / outputs
                  </span>
                  <span className="font-medium text-slate-200">
                    {btcPlan.inputCount} / {btcPlan.outputCount}
                  </span>
                </div>
              </div>
            </div>

            {!btcSigned && (
              <div className="mt-7 border-t border-white/10 pt-6">
                <label className="text-sm font-medium text-slate-300">
                  Recovery phrase
                </label>
                <p className="mt-1 text-xs leading-5 text-slate-500">
                  Used only in this browser to derive the Bitcoin private key
                  and sign this transaction locally.
                </p>
                <textarea
                  value={btcMnemonic}
                  onChange={(event) => {
                    setBtcMnemonic(event.target.value);
                    setBtcError("");
                  }}
                  rows={3}
                  placeholder="Enter your recovery phrase"
                  spellCheck={false}
                  autoComplete="off"
                  className="mt-3 w-full resize-none rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none transition placeholder:text-slate-700 focus:border-amber-400/40"
                />
                <div className="mt-4 rounded-2xl border border-amber-400/20 bg-amber-400/[0.05] p-4 text-sm leading-6 text-amber-100">
                  The phrase must derive the Bitcoin address shown above. It is
                  cleared from this form immediately after successful signing.
                </div>
              </div>
            )}

            {btcError && (
              <div className="mt-4 rounded-xl border border-red-400/20 bg-red-400/[0.05] p-3 text-sm text-red-300">
                {btcError}
              </div>
            )}

            {btcSigned && (
              <div className="mt-6 rounded-2xl border border-emerald-400/20 bg-emerald-400/[0.05] p-5">
                <div className="text-sm font-semibold text-emerald-200">
                  Signed locally
                </div>
                <div className="mt-4 text-xs uppercase tracking-wider text-slate-500">
                  TXID
                </div>
                <div className="mt-2 break-all font-mono text-xs text-emerald-300">
                  {btcSigned.txid}
                </div>
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <div className="rounded-xl border border-white/10 bg-black/10 p-3">
                    <div className="text-xs text-slate-500">Fee</div>
                    <div className="mt-1 text-sm font-medium text-white">
                      {btcSigned.feeSats.toString()} sats
                    </div>
                  </div>
                  <div className="rounded-xl border border-white/10 bg-black/10 p-3">
                    <div className="text-xs text-slate-500">Change</div>
                    <div className="mt-1 text-sm font-medium text-white">
                      {satsToBtc(btcSigned.changeSats)} BTC
                    </div>
                  </div>
                </div>
                <div className="mt-4 text-xs uppercase tracking-wider text-slate-500">
                  Raw transaction
                </div>
                <div className="mt-2 max-h-44 overflow-auto break-all rounded-xl border border-white/10 bg-black/20 p-3 font-mono text-xs leading-5 text-slate-300">
                  {btcSigned.rawTxHex}
                </div>
                <div className="mt-4 rounded-xl border border-cyan-400/20 bg-cyan-400/[0.05] p-3 text-sm leading-6 text-cyan-200">
                  {btcBroadcastTxid ? (
                    <>
                      Transaction broadcast successfully to Bitcoin Mainnet.
                      <div className="mt-2 break-all font-mono text-xs text-emerald-200">
                        TXID: {btcBroadcastTxid}
                      </div>
                    </>
                  ) : (
                    <>
                      The transaction is signed but has not been broadcast to
                      Bitcoin Mainnet.
                    </>
                  )}
                </div>
              </div>
            )}

            <div className="mt-7 grid gap-3 sm:grid-cols-2">
              <button
                type="button"
                disabled={btcSigning}
                onClick={() => {
                  setBtcReviewing(false);
                  setBtcSigned(null);
                  setBtcMnemonic("");
                  setBtcBroadcastTxid(null);
                  setBtcError("");
                }}
                className="rounded-xl border border-white/10 bg-white/5 px-5 py-3 text-sm font-semibold text-white transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Back
              </button>

              {!btcSigned ? (
                <button
                  type="button"
                  disabled={btcSigning || !btcMnemonic.trim()}
                  onClick={handleBitcoinSign}
                  className="rounded-xl bg-amber-400 px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-amber-300 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {btcSigning ? "Signing locally..." : "Sign locally"}
                </button>
              ) : (
                <button
                  type="button"
                  disabled={btcBroadcasting || Boolean(btcBroadcastTxid)}
                  onClick={handleBitcoinBroadcast}
                  className="rounded-xl bg-emerald-400 px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-emerald-300 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {btcBroadcastTxid
                    ? "Broadcasted"
                    : btcBroadcasting
                      ? "Broadcasting..."
                      : "Broadcast to Bitcoin Mainnet"}
                </button>
              )}
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold text-white">Send BTC</h1>
          <p className="mt-1 text-sm text-slate-500">
            Prepare a Bitcoin Mainnet transaction.
          </p>
        </div>

        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setAsset("tat")}
            className="rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-white/10"
          >
            TAT
          </button>
          <button
            type="button"
            className="rounded-xl bg-amber-400 px-4 py-2.5 text-sm font-semibold text-slate-950"
          >
            BTC
          </button>
          <button
            type="button"
            onClick={() => setAsset("eth")}
            className="rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-white/10"
          >
            ETH
          </button>
        </div>

        {!btcAddress ? (
          <div className="max-w-2xl rounded-3xl border border-amber-400/20 bg-amber-400/[0.05] p-6">
            <div className="font-medium text-amber-300">
              Bitcoin address unavailable
            </div>
            <p className="mt-2 text-sm text-slate-400">
              Unlock the wallet once to derive your Bitcoin address.
            </p>
            <Link
              to="/wallet"
              className="mt-5 inline-flex rounded-xl bg-amber-400 px-5 py-3 text-sm font-semibold text-slate-950"
            >
              Open wallet
            </Link>
          </div>
        ) : (
          <div className="max-w-3xl rounded-3xl border border-white/10 bg-white/[0.03] p-6">
            <div className="text-xs uppercase tracking-wider text-slate-500">
              Bitcoin address
            </div>
            <div className="mt-2 break-all font-mono text-sm text-amber-300">
              {btcAddress}
            </div>

            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              <div className="rounded-2xl border border-white/10 bg-black/10 p-4">
                <div className="text-xs uppercase tracking-wider text-slate-500">
                  Total balance
                </div>
                <div className="mt-2 text-lg font-semibold text-white">
                  {bitcoinBalanceQuery.isLoading
                    ? "Loading..."
                    : bitcoinBalanceQuery.isError
                      ? "Unable to load"
                      : `${availableBitcoinBalance ?? "0.00000000"} BTC`}
                </div>
              </div>

              <div className="rounded-2xl border border-white/10 bg-black/10 p-4">
                <div className="text-xs uppercase tracking-wider text-slate-500">
                  Available to send
                </div>
                <div className="mt-2 text-lg font-semibold text-white">
                  {bitcoinBalanceQuery.isLoading
                    ? "Loading..."
                    : bitcoinBalanceQuery.isError
                      ? "Unable to load"
                      : `${confirmedBitcoinBalance ?? "0.00000000"} BTC`}
                </div>
              </div>

              <div className="rounded-2xl border border-white/10 bg-black/10 p-4">
                <div className="text-xs uppercase tracking-wider text-slate-500">
                  Pending
                </div>
                <div className="mt-2 text-lg font-semibold text-white">
                  {bitcoinBalanceQuery.isLoading
                    ? "Loading..."
                    : bitcoinBalanceQuery.isError
                      ? "Unable to load"
                      : `${unconfirmedBitcoinBalance ?? "0.00000000"} BTC`}
                </div>
              </div>

              <div className="rounded-2xl border border-white/10 bg-black/10 p-4">
                <div className="text-xs uppercase tracking-wider text-slate-500">
                  Confirmed UTXOs
                </div>
                <div className="mt-2 text-lg font-semibold text-white">
                  {bitcoinUtxosQuery.isLoading
                    ? "Loading..."
                    : bitcoinUtxosQuery.isError
                      ? "Unable to load"
                      : `${confirmedUtxos.length}`}
                </div>
              </div>
            </div>

            {bitcoinBalanceQuery.data &&
              BigInt(bitcoinBalanceQuery.data.unconfirmed) !== 0n && (
                <div className="mt-4 rounded-2xl border border-amber-400/20 bg-amber-400/[0.05] p-4 text-sm leading-6 text-amber-200">
                  Some Bitcoin funds are still pending confirmation and are not
                  yet available to send.
                </div>
              )}

            <div className="mt-6">
              <label className="text-sm font-medium text-slate-300">
                Recipient address
              </label>
              <input
                value={btcToAddress}
                onChange={(event) => {
                  setBtcToAddress(event.target.value);
                  setBtcPlan(null);
                  setBtcError("");
                }}
                placeholder="bc1..."
                spellCheck={false}
                autoComplete="off"
                className="mt-2 w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 font-mono text-sm text-white outline-none transition placeholder:text-slate-700 focus:border-amber-400/40"
              />
            </div>

            <div className="mt-5">
              <div className="flex items-center justify-between gap-4">
                <label className="text-sm font-medium text-slate-300">
                  Amount
                </label>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-slate-500">
                    Available:{" "}
                    <span className="font-medium text-slate-300">
                      {confirmedBitcoinBalance ?? "0.00000000"} BTC
                    </span>
                  </span>

                  <button
                    type="button"
                    onClick={handleBitcoinMax}
                    disabled={!selectedFeeRate || confirmedUtxos.length === 0}
                    className="text-xs font-semibold text-amber-300 transition hover:text-amber-200 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    MAX
                  </button>
                </div>
              </div>

              <div className="relative mt-2">
                <input
                  value={btcAmount}
                  onChange={(event) => {
                    setBtcAmount(event.target.value);
                    setBtcPlan(null);
                    setBtcError("");
                  }}
                  placeholder="0.00000000"
                  inputMode="decimal"
                  className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 pr-16 text-white outline-none transition placeholder:text-slate-700 focus:border-amber-400/40"
                />
                <div className="pointer-events-none absolute inset-y-0 right-4 flex items-center text-sm font-medium text-amber-300">
                  BTC
                </div>
              </div>
            </div>

            <div className="mt-6">
              <div className="text-xs uppercase tracking-wider text-slate-500">
                Network fee
              </div>

              {bitcoinFeesQuery.isLoading ? (
                <div className="mt-3 text-sm text-slate-500">
                  Loading fee estimates...
                </div>
              ) : bitcoinFeesQuery.isError ? (
                <div className="mt-3 text-sm text-red-300">
                  Unable to load fee estimates.
                </div>
              ) : feeRates ? (
                <div className="mt-3 grid gap-3 sm:grid-cols-3">
                  {(
                    [
                      ["fast", "Fast", feeRates.fast],
                      ["normal", "Normal", feeRates.normal],
                      ["economy", "Economy", feeRates.economy],
                    ] as const
                  ).map(([mode, label, rate]) => {
                    const active = btcFeeMode === mode;

                    return (
                      <button
                        key={mode}
                        type="button"
                        onClick={() => {
                          setBtcFeeMode(mode);
                          setBtcPlan(null);
                          setBtcError("");
                        }}
                        className={
                          active
                            ? "rounded-2xl border border-amber-400/40 bg-amber-400/[0.08] p-4 text-left"
                            : "rounded-2xl border border-white/10 bg-black/10 p-4 text-left transition hover:bg-white/5"
                        }
                      >
                        <div
                          className={
                            active
                              ? "text-sm text-amber-300"
                              : "text-sm text-slate-500"
                          }
                        >
                          {label}
                        </div>
                        <div className="mt-2 font-semibold text-white">
                          {Number(rate).toFixed(2)} sat/vB
                        </div>
                      </button>
                    );
                  })}
                </div>
              ) : null}
            </div>

            <button
              type="button"
              disabled={
                !btcToAddress.trim() ||
                !btcAmount.trim() ||
                !selectedFeeRate ||
                bitcoinUtxosQuery.isLoading
              }
              onClick={prepareBitcoinReview}
              className="mt-6 w-full rounded-xl bg-amber-400 px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-amber-300 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Review BTC transaction
            </button>

            {btcError && (
              <div className="mt-4 rounded-xl border border-red-400/20 bg-red-400/[0.05] p-3 text-sm text-red-300">
                {btcError}
              </div>
            )}

            <div className="mt-5 rounded-2xl border border-cyan-400/20 bg-cyan-400/[0.05] p-4 text-sm leading-6 text-cyan-200">
              BTC transactions are signed locally in your browser. Broadcasting
              sends the signed transaction to Bitcoin Mainnet and cannot be
              reversed.
            </div>
          </div>
        )}
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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-white">Send TAT</h1>

        <p className="mt-1 text-sm text-slate-500">
          Send TatCoin to another address.
        </p>
      </div>

      <div className="flex gap-2">
        <button
          type="button"
          className="rounded-xl bg-cyan-400 px-4 py-2.5 text-sm font-semibold text-slate-950"
        >
          TAT
        </button>
        <button
          type="button"
          onClick={() => setAsset("btc")}
          className="rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-white/10"
        >
          BTC
        </button>
        <button
          type="button"
          onClick={() => setAsset("eth")}
          className="rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-white/10"
        >
          ETH
        </button>
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
