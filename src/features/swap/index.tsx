import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";

import { useWalletStore } from "../../stores/wallet-store";
import {
  formatEthereumBalance,
  getEthereumBalance,
  type EthereumTransactionFee,
} from "../../services/ethereum";
import {
  formatUsdtBalance,
  getUsdtBalance,
  USDT_CONTRACT_ADDRESS,
} from "../../services/usdt";
import {
  formatSwapAmount,
  getSwapPrice,
  parseSwapAmount,
  type SwapPrice,
  type SwapToken,
  getUsdtApprovalFeeQuote,
  ZEROX_ALLOWANCE_HOLDER,
  prepareSwapExecution,
  type SwapExecutionPlan,
} from "../../services/swap";
import ApprovalReview from "./approval-review";
import SwapReview from "./swap-review";

const ETH_TOKEN_ADDRESS = "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE";

function tokenFromAddress(address: string): SwapToken | null {
  const normalized = address.toLowerCase();

  if (normalized === ETH_TOKEN_ADDRESS.toLowerCase()) {
    return "ETH";
  }

  if (normalized === USDT_CONTRACT_ADDRESS.toLowerCase()) {
    return "USDT";
  }

  return null;
}

export default function Swap() {
  const ethAddress = useWalletStore((state) => state.ethAddress);

  const [sellToken, setSellToken] = useState<SwapToken>("ETH");
  const [buyToken, setBuyToken] = useState<SwapToken>("USDT");
  const [amount, setAmount] = useState("");
  const [quote, setQuote] = useState<SwapPrice | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [approvalPlan, setApprovalPlan] =
    useState<EthereumTransactionFee | null>(null);
  const [approvalPreparing, setApprovalPreparing] = useState(false);
  const [swapPlan, setSwapPlan] = useState<SwapExecutionPlan | null>(null);
  const [swapPreparing, setSwapPreparing] = useState(false);

  const ethereumBalanceQuery = useQuery({
    queryKey: ["ethereum-balance", ethAddress],
    queryFn: () => getEthereumBalance(ethAddress!),
    enabled: Boolean(ethAddress),
    refetchInterval: 30_000,
  });

  const usdtBalanceQuery = useQuery({
    queryKey: ["usdt-balance", ethAddress],
    queryFn: () => getUsdtBalance(ethAddress!),
    enabled: Boolean(ethAddress),
    refetchInterval: 30_000,
  });

  const ethBalance =
    ethereumBalanceQuery.data !== undefined
      ? formatEthereumBalance(ethereumBalanceQuery.data)
      : null;

  const usdtBalance =
    usdtBalanceQuery.data !== undefined
      ? formatUsdtBalance(usdtBalanceQuery.data)
      : null;

  const availableBalance = sellToken === "ETH" ? ethBalance : usdtBalance;

  function reversePair() {
    setSellToken(buyToken);
    setBuyToken(sellToken);
    setAmount("");
    setQuote(null);
    setError("");
  }

  async function handleGetQuote() {
    if (!ethAddress) {
      return;
    }

    try {
      setLoading(true);
      setError("");
      setQuote(null);
      setApprovalPlan(null);
      setSwapPlan(null);

      const sellAmount = parseSwapAmount(amount, sellToken);

      const result = await getSwapPrice({
        sellToken,
        buyToken,
        sellAmount,
        taker: ethAddress,
      });

      if (!result.liquidityAvailable) {
        throw new Error("No swap liquidity is currently available");
      }

      setQuote(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to get swap quote");
    } finally {
      setLoading(false);
    }
  }

  async function handleReviewApproval() {
    if (!ethAddress || sellToken !== "USDT" || !quote?.issues.allowance) {
      return;
    }

    try {
      setApprovalPreparing(true);
      setError("");

      const sellAmount = parseSwapAmount(amount, "USDT");
      const currentAllowance = BigInt(quote.issues.allowance.actual);
      const spender = quote.issues.allowance.spender;

      if (spender.toLowerCase() !== ZEROX_ALLOWANCE_HOLDER.toLowerCase()) {
        throw new Error("Unexpected USDT approval spender");
      }

      if (currentAllowance >= sellAmount) {
        throw new Error("USDT approval is no longer required");
      }

      /*
       * Ethereum USDT requires an existing non-zero allowance
       * to be reset to zero before setting another non-zero value.
       */
      if (currentAllowance !== 0n) {
        throw new Error(
          "The existing USDT allowance must be reset to zero first",
        );
      }

      if (usdtBalanceQuery.data === undefined) {
        throw new Error("USDT balance is not available");
      }

      if (sellAmount > usdtBalanceQuery.data) {
        throw new Error("Insufficient USDT balance");
      }

      const plan = await getUsdtApprovalFeeQuote(ethAddress, sellAmount);

      if (ethereumBalanceQuery.data === undefined) {
        throw new Error("Ethereum balance is not available");
      }

      if (plan.estimatedFee > BigInt(ethereumBalanceQuery.data)) {
        throw new Error(
          "Insufficient ETH balance to cover the approval network fee",
        );
      }

      setApprovalPlan(plan);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Unable to prepare USDT approval",
      );
    } finally {
      setApprovalPreparing(false);
    }
  }

  async function handleReviewSwap() {
    if (!ethAddress || !quote) {
      return;
    }

    try {
      setSwapPreparing(true);
      setError("");

      const sellAmount = parseSwapAmount(amount, sellToken);

      if (ethereumBalanceQuery.data === undefined) {
        throw new Error("Ethereum balance is not available");
      }

      if (sellToken === "USDT" && usdtBalanceQuery.data === undefined) {
        throw new Error("USDT balance is not available");
      }

      if (
        sellToken === "USDT" &&
        usdtBalanceQuery.data !== undefined &&
        sellAmount > usdtBalanceQuery.data
      ) {
        throw new Error("Insufficient USDT balance");
      }

      const plan = await prepareSwapExecution({
        sellToken,
        buyToken,
        sellAmount,
        taker: ethAddress,
      });

      const ethereumBalance = BigInt(ethereumBalanceQuery.data);
      const requiredEthereum =
        plan.fee.estimatedFee + (sellToken === "ETH" ? sellAmount : 0n);

      if (requiredEthereum > ethereumBalance) {
        throw new Error(
          sellToken === "ETH"
            ? "Insufficient ETH balance for the swap amount and network fee"
            : "Insufficient ETH balance to cover the swap network fee",
        );
      }

      setSwapPlan(plan);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to prepare swap");
    } finally {
      setSwapPreparing(false);
    }
  }

  if (approvalPlan && ethAddress) {
    return (
      <ApprovalReview
        ethAddress={ethAddress}
        amount={formatSwapAmount(parseSwapAmount(amount, "USDT"), "USDT")}
        plan={approvalPlan}
        onBack={() => {
          setApprovalPlan(null);
          setError("");
        }}
      />
    );
  }

  if (swapPlan && ethAddress) {
    return (
      <SwapReview
        ethAddress={ethAddress}
        sellToken={sellToken}
        buyToken={buyToken}
        sellAmount={parseSwapAmount(amount, sellToken)}
        plan={swapPlan}
        onBack={() => {
          setSwapPlan(null);
          setError("");
        }}
      />
    );
  }

  const providerFeeToken = quote?.fees.zeroExFee
    ? tokenFromAddress(quote.fees.zeroExFee.token)
    : null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-white">Swap</h1>
        <p className="mt-1 text-sm text-slate-500">
          Get a read-only ETH/USDT quote on Ethereum Mainnet.
        </p>
      </div>

      {!ethAddress ? (
        <div className="max-w-2xl rounded-3xl border border-amber-400/20 bg-amber-400/[0.05] p-6">
          <div className="font-medium text-amber-200">
            Ethereum wallet is not available
          </div>
          <p className="mt-2 text-sm leading-6 text-slate-400">
            Create or restore the multichain wallet before requesting a quote.
          </p>
          <Link
            to="/wallet"
            className="mt-4 inline-flex rounded-xl bg-violet-400 px-4 py-2 text-sm font-semibold text-slate-950"
          >
            Open Wallet
          </Link>
        </div>
      ) : (
        <div className="max-w-2xl rounded-3xl border border-white/10 bg-white/[0.03] p-6">
          <div className="rounded-2xl border border-white/10 bg-black/10 p-4">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium text-slate-300">
                You sell
              </label>
              <span className="text-xs text-slate-500">
                Available: {availableBalance ?? "Loading..."} {sellToken}
              </span>
            </div>

            <div className="mt-3 flex gap-3">
              <input
                value={amount}
                onChange={(event) => {
                  setAmount(event.target.value);
                  setQuote(null);
                  setError("");
                }}
                inputMode="decimal"
                placeholder="0.0"
                className="min-w-0 flex-1 rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-lg text-white outline-none focus:border-violet-400/40"
              />

              <select
                value={sellToken}
                onChange={(event) => {
                  const token = event.target.value as SwapToken;
                  setSellToken(token);
                  setBuyToken(token === "ETH" ? "USDT" : "ETH");
                  setAmount("");
                  setQuote(null);
                  setError("");
                }}
                className="rounded-xl border border-white/10 bg-slate-900 px-4 py-3 font-semibold text-white outline-none"
              >
                <option value="ETH">ETH</option>
                <option value="USDT">USDT</option>
              </select>
            </div>
          </div>

          <div className="flex justify-center py-3">
            <button
              type="button"
              onClick={reversePair}
              className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-violet-300 transition hover:bg-white/10"
            >
              ⇅ Reverse
            </button>
          </div>

          <div className="rounded-2xl border border-white/10 bg-black/10 p-4">
            <div className="text-sm font-medium text-slate-300">
              You receive
            </div>
            <div className="mt-3 flex items-center justify-between">
              <span className="text-2xl font-semibold text-white">
                {quote ? formatSwapAmount(quote.buyAmount, buyToken) : "—"}
              </span>
              <span className="font-semibold text-white">{buyToken}</span>
            </div>
          </div>

          <button
            type="button"
            disabled={loading || !amount.trim()}
            onClick={() => {
              void handleGetQuote();
            }}
            className="mt-5 w-full rounded-xl bg-violet-400 px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-violet-300 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? "Getting quote..." : "Get swap quote"}
          </button>

          {quote && (
            <div className="mt-5 space-y-3 rounded-2xl border border-cyan-400/20 bg-cyan-400/[0.05] p-4 text-sm">
              <div className="flex justify-between gap-4">
                <span className="text-slate-500">Minimum received</span>
                <span className="text-cyan-100">
                  {formatSwapAmount(quote.minBuyAmount, buyToken)} {buyToken}
                </span>
              </div>

              <div className="flex justify-between gap-4">
                <span className="text-slate-500">Estimated gas limit</span>
                <span className="text-cyan-100">{quote.gas}</span>
              </div>

              <div className="flex justify-between gap-4">
                <span className="text-slate-500">0x fee</span>
                <span className="text-cyan-100">
                  {quote.fees.zeroExFee && providerFeeToken
                    ? `${formatSwapAmount(
                        quote.fees.zeroExFee.amount,
                        providerFeeToken,
                      )} ${providerFeeToken}`
                    : "Included in quote"}
                </span>
              </div>

              <div className="flex justify-between gap-4">
                <span className="text-slate-500">TatCoin Wallet fee</span>
                <span className="text-cyan-100">
                  {quote.fees.integratorFee ? "Enabled" : "Not enabled"}
                </span>
              </div>

              {sellToken === "USDT" && quote.issues.allowance && (
                <div className="rounded-xl border border-amber-400/20 bg-amber-400/[0.05] p-3">
                  <div className="font-medium text-amber-200">
                    USDT approval required
                  </div>

                  <div className="mt-2 text-xs leading-5 text-slate-400">
                    Current allowance:{" "}
                    {formatSwapAmount(quote.issues.allowance.actual, "USDT")}{" "}
                    USDT
                  </div>

                  <div className="mt-1 break-all font-mono text-xs text-slate-500">
                    Spender: {quote.issues.allowance.spender}
                  </div>

                  <button
                    type="button"
                    disabled={approvalPreparing}
                    onClick={() => {
                      void handleReviewApproval();
                    }}
                    className="mt-3 w-full rounded-xl bg-amber-300 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-amber-200 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {approvalPreparing
                      ? "Preparing approval..."
                      : "Review USDT approval"}
                  </button>
                </div>
              )}

              {quote.issues.simulationIncomplete && (
                <div className="rounded-xl border border-amber-400/20 bg-amber-400/[0.05] p-3 text-amber-200">
                  Provider simulation is incomplete.
                </div>
              )}

              {quote.issues.allowance === null &&
                quote.issues.balance === null &&
                !quote.issues.simulationIncomplete && (
                  <button
                    type="button"
                    disabled={swapPreparing}
                    onClick={() => {
                      void handleReviewSwap();
                    }}
                    className="w-full rounded-xl bg-emerald-400 px-4 py-3 text-sm font-semibold text-slate-950 transition hover:bg-emerald-300 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {swapPreparing ? "Preparing final quote..." : "Review swap"}
                  </button>
                )}

              <div className="pt-2 text-xs leading-5 text-slate-500">
                Read-only quote from 0x. Nothing is signed or broadcast.
              </div>
            </div>
          )}

          {error && (
            <div className="mt-4 rounded-xl border border-red-400/20 bg-red-400/[0.05] p-3 text-sm text-red-300">
              {error}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
