import { Link } from "react-router-dom";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  RiCoinsLine,
  RiErrorWarningLine,
  RiShieldCheckLine,
  RiStackLine,
} from "react-icons/ri";

import { getTatBalance } from "../../services/bank";
import {
  claimRewards,
  delegateTat,
  estimateDelegateFee,
  estimateUndelegateFee,
  getDelegations,
  getRewards,
  getUnbondings,
  getValidators,
  undelegateTat,
} from "../../services/staking";
import { useWalletStore } from "../../stores/wallet-store";

function normalizeUtat(value: string): bigint {
  const [whole = "0"] = value.trim().split(".");
  return BigInt(whole || "0");
}

function formatUtat(value: string): string {
  const amount = normalizeUtat(value);

  const whole = amount / 1_000_000n;
  const fraction = amount % 1_000_000n;

  return `${whole}.${fraction.toString().padStart(6, "0")}`;
}

function sumUtat(values: string[]): string {
  return values
    .reduce((total, value) => total + normalizeUtat(value), 0n)
    .toString();
}

function tatToUtat(value: string): string {
  const normalized = value.trim();

  if (!/^\d+(\.\d{0,6})?$/.test(normalized)) {
    throw new Error("Invalid amount");
  }

  const [whole, fraction = ""] = normalized.split(".");
  const paddedFraction = fraction.padEnd(6, "0");

  return `${BigInt(whole) * 1_000_000n + BigInt(paddedFraction)}`;
}

function formatRemainingTime(completionTime: string): string {
  const completion = new Date(completionTime).getTime();
  const now = Date.now();

  const diff = completion - now;

  if (diff <= 0) {
    return "Available now";
  }

  const totalHours = Math.floor(diff / (1000 * 60 * 60));

  const days = Math.floor(totalHours / 24);
  const hours = totalHours % 24;

  if (days > 0) {
    return `${days}d ${hours}h remaining`;
  }

  return `${hours}h remaining`;
}

export default function Staking() {
  const queryClient = useQueryClient();

  const address = useWalletStore((state) => state.address);
  const signer = useWalletStore((state) => state.signer);
  const walletLocked = Boolean(address && !signer);

  /*
   * Delegate state
   */
  const [selectedValidator, setSelectedValidator] = useState("");

  const [amount, setAmount] = useState("");

  const [estimatedFee, setEstimatedFee] = useState<string | null>(null);

  const [estimatingFee, setEstimatingFee] = useState(false);

  const [confirming, setConfirming] = useState(false);

  const [delegating, setDelegating] = useState(false);

  const [error, setError] = useState("");

  const [txHash, setTxHash] = useState("");

  const [height, setHeight] = useState<number | null>(null);

  /*
   * Claim rewards state
   */
  const [claimingValidator, setClaimingValidator] = useState<string | null>(
    null,
  );

  const [claimError, setClaimError] = useState("");

  const [claimSuccess, setClaimSuccess] = useState("");

  const [claimTxHash, setClaimTxHash] = useState("");

  /*
   * Undelegate state
   */
  const [undelegateValidator, setUndelegateValidator] = useState("");

  const [undelegateAmount, setUndelegateAmount] = useState("");

  const [undelegateFee, setUndelegateFee] = useState<string | null>(null);

  const [undelegateReview, setUndelegateReview] = useState(false);

  const [undelegating, setUndelegating] = useState(false);

  const [undelegateError, setUndelegateError] = useState("");

  const [undelegateSuccess, setUndelegateSuccess] = useState("");

  const [undelegateTxHash, setUndelegateTxHash] = useState("");

  /*
   * Queries
   */
  const validatorsQuery = useQuery({
    queryKey: ["tat-validators"],
    queryFn: getValidators,
    refetchInterval: 15_000,
  });

  const delegationsQuery = useQuery({
    queryKey: ["tat-delegations", address],
    queryFn: () => getDelegations(address!),
    enabled: Boolean(address),
    refetchInterval: 15_000,
  });

  const rewardsQuery = useQuery({
    queryKey: ["tat-rewards", address],
    queryFn: () => getRewards(address!),
    enabled: Boolean(address),
    refetchInterval: 15_000,
  });

  const unbondingsQuery = useQuery({
    queryKey: ["tat-unbondings", address],
    queryFn: () => getUnbondings(address!),
    enabled: Boolean(address),
    refetchInterval: 15_000,
  });

  const balanceQuery = useQuery({
    queryKey: ["tat-balance", address],
    queryFn: () => getTatBalance(address!),
    enabled: Boolean(address),
    refetchInterval: 15_000,
  });

  /*
   * Data
   */
  const validators = validatorsQuery.data ?? [];
  const delegations = delegationsQuery.data ?? [];
  const rewards = rewardsQuery.data ?? [];
  const unbondings = unbondingsQuery.data ?? [];

  const delegatedUtat = sumUtat(delegations.map((item) => item.amountUtat));

  const rewardsUtat = sumUtat(rewards.map((item) => item.amountUtat));

  const unbondingUtat = sumUtat(unbondings.map((item) => item.balanceUtat));

  const hasError =
    validatorsQuery.isError ||
    delegationsQuery.isError ||
    rewardsQuery.isError ||
    unbondingsQuery.isError ||
    balanceQuery.isError;

  const loading =
    validatorsQuery.isLoading ||
    delegationsQuery.isLoading ||
    rewardsQuery.isLoading ||
    unbondingsQuery.isLoading ||
    balanceQuery.isLoading;

  /*
   * Claim rewards
   */
  async function handleClaimRewards(validatorAddress: string) {
    if (!address || !signer) {
      return;
    }

    try {
      setClaimingValidator(validatorAddress);
      setClaimError("");
      setClaimSuccess("");
      setClaimTxHash("");

      const result = await claimRewards({
        signer,
        delegatorAddress: address,
        validatorAddress,
      });

      setClaimSuccess("Rewards claimed");

      setClaimTxHash(result.transactionHash);

      await Promise.all([
        rewardsQuery.refetch(),
        delegationsQuery.refetch(),
        balanceQuery.refetch(),
      ]);
    } catch (claimErr) {
      setClaimError(
        claimErr instanceof Error
          ? claimErr.message
          : "Unable to claim rewards",
      );
    } finally {
      setClaimingValidator(null);
    }
  }

  /*
   * Delegate fee
   */
  async function handleEstimateFee(
    validatorAddress: string,
    amountValue: string,
  ) {
    if (!address || !signer) {
      return;
    }

    if (!validatorAddress || !amountValue.trim()) {
      setEstimatedFee(null);
      return;
    }

    try {
      setEstimatingFee(true);
      setError("");

      const amountUtat = tatToUtat(amountValue);

      if (BigInt(amountUtat) <= 0n) {
        throw new Error("Amount must be greater than zero");
      }

      const result = await estimateDelegateFee({
        signer,
        delegatorAddress: address,
        validatorAddress,
        amountUtat,
      });

      setEstimatedFee(formatUtat(result.feeUtat));
    } catch (estimateErr) {
      setEstimatedFee(null);

      setError(
        estimateErr instanceof Error
          ? estimateErr.message
          : "Failed to estimate delegation fee",
      );
    } finally {
      setEstimatingFee(false);
    }
  }

  /*
   * Delegate MAX
   */
  async function handleDelegateMax(validatorAddress: string) {
    if (!address || !signer || balanceQuery.data === undefined) {
      return;
    }

    try {
      setEstimatingFee(true);
      setError("");

      /*
       * Simulate the smallest possible delegation.
       * MsgDelegate gas is not meaningfully dependent
       * on the amount being delegated.
       */
      const estimate = await estimateDelegateFee({
        signer,
        delegatorAddress: address,
        validatorAddress,
        amountUtat: "1",
      });

      const balanceUtat = BigInt(balanceQuery.data);

      const feeUtat = BigInt(estimate.feeUtat);

      if (balanceUtat <= feeUtat) {
        throw new Error("Balance is too low to cover the network fee");
      }

      const maxUtat = balanceUtat - feeUtat;

      setAmount(formatUtat(maxUtat.toString()));

      setEstimatedFee(formatUtat(feeUtat.toString()));
    } catch (maxErr) {
      setError(
        maxErr instanceof Error
          ? maxErr.message
          : "Unable to calculate maximum delegation",
      );
    } finally {
      setEstimatingFee(false);
    }
  }

  /*
   * Delegate review
   */
  async function handleReview() {
    if (!address || !signer) {
      return;
    }

    if (!selectedValidator) {
      setError("Select a validator");
      return;
    }

    try {
      setError("");
      setTxHash("");
      setHeight(null);

      const amountUtat = tatToUtat(amount);

      if (BigInt(amountUtat) <= 0n) {
        throw new Error("Amount must be greater than zero");
      }

      if (balanceQuery.data !== undefined) {
        const balanceUtat = BigInt(balanceQuery.data);

        if (BigInt(amountUtat) >= balanceUtat) {
          throw new Error("Leave enough balance to cover the network fee");
        }
      }

      setEstimatingFee(true);

      const result = await estimateDelegateFee({
        signer,
        delegatorAddress: address,
        validatorAddress: selectedValidator,
        amountUtat,
      });

      if (balanceQuery.data !== undefined) {
        const balanceUtat = BigInt(balanceQuery.data);

        const totalUtat = BigInt(amountUtat) + BigInt(result.feeUtat);

        if (totalUtat > balanceUtat) {
          throw new Error(
            "Insufficient balance to cover amount and network fee",
          );
        }
      }

      setEstimatedFee(formatUtat(result.feeUtat));

      setConfirming(true);
    } catch (reviewErr) {
      setError(
        reviewErr instanceof Error
          ? reviewErr.message
          : "Unable to review delegation",
      );
    } finally {
      setEstimatingFee(false);
    }
  }

  /*
   * Confirm delegate
   */
  async function handleConfirmDelegate() {
    if (!address || !signer || !selectedValidator) {
      return;
    }

    try {
      setDelegating(true);
      setError("");
      setTxHash("");
      setHeight(null);

      const amountUtat = tatToUtat(amount);

      const result = await delegateTat({
        signer,
        delegatorAddress: address,
        validatorAddress: selectedValidator,
        amountUtat,
      });

      setTxHash(result.transactionHash);

      setHeight(result.height);

      setConfirming(false);

      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: ["tat-delegations", address],
        }),
        queryClient.invalidateQueries({
          queryKey: ["tat-rewards", address],
        }),
        queryClient.invalidateQueries({
          queryKey: ["tat-balance", address],
        }),
      ]);

      setAmount("");
      setEstimatedFee(null);
      setSelectedValidator("");
    } catch (delegateErr) {
      setError(
        delegateErr instanceof Error
          ? delegateErr.message
          : "Delegation failed",
      );
    } finally {
      setDelegating(false);
    }
  }

  /*
   * Review undelegate
   */
  async function handleReviewUndelegate(validatorAddress: string) {
    if (!address || !signer) {
      return;
    }

    const amountValue = undelegateAmount.trim();

    if (!amountValue) {
      setUndelegateError("Enter an amount");
      return;
    }

    let amountUtat: string;

    try {
      amountUtat = tatToUtat(amountValue);
    } catch {
      setUndelegateError("Enter a valid amount");
      return;
    }

    if (BigInt(amountUtat) <= 0n) {
      setUndelegateError("Enter a valid amount");
      return;
    }

    const delegation = delegations.find(
      (item) => item.validatorAddress === validatorAddress,
    );

    if (
      delegation &&
      BigInt(amountUtat) > normalizeUtat(delegation.amountUtat)
    ) {
      setUndelegateError("Amount exceeds delegated balance");
      return;
    }

    try {
      setUndelegateError("");

      const result = await estimateUndelegateFee({
        signer,
        delegatorAddress: address,
        validatorAddress,
        amountUtat,
      });

      setUndelegateFee(result.feeUtat);

      setUndelegateValidator(validatorAddress);

      setUndelegateReview(true);
    } catch (undelegateErr) {
      setUndelegateError(
        undelegateErr instanceof Error
          ? undelegateErr.message
          : "Unable to review undelegation",
      );
    }
  }

  /*
   * Confirm undelegate
   */
  async function handleConfirmUndelegate() {
    if (!address || !signer || !undelegateValidator || !undelegateAmount) {
      return;
    }

    let amountUtat: string;

    try {
      amountUtat = tatToUtat(undelegateAmount);
    } catch {
      setUndelegateError("Enter a valid amount");
      return;
    }

    if (BigInt(amountUtat) <= 0n) {
      setUndelegateError("Enter a valid amount");
      return;
    }

    try {
      setUndelegating(true);
      setUndelegateError("");
      setUndelegateSuccess("");
      setUndelegateTxHash("");

      const result = await undelegateTat({
        signer,
        delegatorAddress: address,
        validatorAddress: undelegateValidator,
        amountUtat,
      });

      setUndelegateSuccess("Undelegation submitted");

      setUndelegateTxHash(result.transactionHash);

      setUndelegateReview(false);
      setUndelegateAmount("");
      setUndelegateFee(null);
      setUndelegateValidator("");

      await Promise.all([
        delegationsQuery.refetch(),
        rewardsQuery.refetch(),
        unbondingsQuery.refetch(),
        balanceQuery.refetch(),
      ]);
    } catch (undelegateErr) {
      setUndelegateError(
        undelegateErr instanceof Error
          ? undelegateErr.message
          : "Unable to undelegate",
      );
    } finally {
      setUndelegating(false);
    }
  }

  /*
   * No active wallet
   */

  if (!address) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold text-white">Staking</h1>

          <p className="mt-1 text-sm text-slate-500">
            Delegate TAT and earn staking rewards.
          </p>
        </div>

        <div className="max-w-4xl rounded-3xl border border-amber-400/20 bg-amber-400/[0.05] p-6 text-sm text-amber-200">
          Create or import a wallet to view staking information.
        </div>
      </div>
    );
  }

  if (walletLocked) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold text-white">Staking</h1>

          <p className="mt-1 text-sm text-slate-500">
            Delegate TAT and earn staking rewards.
          </p>
        </div>

        <div className="max-w-4xl rounded-3xl border border-amber-400/20 bg-amber-400/[0.05] p-6">
          <div className="text-lg font-semibold text-amber-300">
            Wallet locked
          </div>

          <p className="mt-2 text-sm leading-6 text-slate-400">
            Unlock your wallet to delegate, undelegate, or claim staking
            rewards.
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

  /*
   * Delegate confirmation screen
   */
  if (confirming) {
    const validator = validators.find(
      (item) => item.operatorAddress === selectedValidator,
    );

    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold text-white">
            Review delegation
          </h1>

          <p className="mt-1 text-sm text-slate-500">
            Check the delegation details before signing.
          </p>
        </div>

        <div className="max-w-2xl rounded-3xl border border-white/10 bg-white/[0.03] p-6">
          <div className="space-y-5">
            <div>
              <div className="text-xs uppercase tracking-wider text-slate-500">
                Delegator
              </div>

              <div className="mt-2 break-all font-mono text-sm text-slate-300">
                {address}
              </div>
            </div>

            <div className="border-t border-white/10 pt-5">
              <div className="text-xs uppercase tracking-wider text-slate-500">
                Validator
              </div>

              <div className="mt-2 font-medium text-white">
                {validator?.moniker ?? "Validator"}
              </div>

              <div className="mt-2 break-all font-mono text-xs text-slate-500">
                {selectedValidator}
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
                  ~{estimatedFee ?? "0.000000"} TAT
                </span>
              </div>
            </div>
          </div>

          <div className="mt-7 grid gap-3 sm:grid-cols-2">
            <button
              type="button"
              disabled={delegating}
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
              disabled={delegating}
              onClick={() => {
                void handleConfirmDelegate();
              }}
              className="rounded-xl bg-cyan-400 px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-cyan-300 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {delegating ? "Signing & broadcasting..." : "Confirm & Delegate"}
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
        <h1 className="text-2xl font-semibold text-white">Staking</h1>

        <p className="mt-1 text-sm text-slate-500">TatCoin staking overview.</p>
      </div>

      {loading && (
        <div className="max-w-6xl rounded-3xl border border-white/10 bg-white/[0.03] p-6 text-sm text-slate-400">
          Loading staking data...
        </div>
      )}

      {hasError && (
        <div className="max-w-6xl rounded-3xl border border-red-400/20 bg-red-400/[0.05] p-6">
          <div className="flex items-center gap-2 text-red-300">
            <RiErrorWarningLine className="text-xl" />
            Unable to load staking data.
          </div>
        </div>
      )}

      {!loading && !hasError && (
        <>
          <div className="grid max-w-6xl gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-5">
              <RiStackLine className="text-2xl text-cyan-300" />

              <div className="mt-4 text-xs uppercase tracking-wider text-slate-500">
                Delegated
              </div>

              <div className="mt-2 text-2xl font-semibold text-white">
                {formatUtat(delegatedUtat)} TAT
              </div>
            </div>

            <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-5">
              <RiCoinsLine className="text-2xl text-emerald-300" />

              <div className="mt-4 text-xs uppercase tracking-wider text-slate-500">
                Rewards
              </div>

              <div className="mt-2 text-2xl font-semibold text-white">
                {formatUtat(rewardsUtat)} TAT
              </div>
            </div>

            <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-5">
              <RiCoinsLine className="text-2xl text-amber-300" />

              <div className="mt-4 text-xs uppercase tracking-wider text-slate-500">
                Unbonding
              </div>

              <div className="mt-2 text-2xl font-semibold text-white">
                {formatUtat(unbondingUtat)} TAT
              </div>
            </div>

            <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-5">
              <RiShieldCheckLine className="text-2xl text-violet-300" />

              <div className="mt-4 text-xs uppercase tracking-wider text-slate-500">
                Validators
              </div>

              <div className="mt-2 text-2xl font-semibold text-white">
                {validators.length}
              </div>
            </div>
          </div>

          {claimError && (
            <div className="max-w-6xl rounded-2xl border border-red-400/20 bg-red-400/[0.05] p-4 text-sm text-red-300">
              {claimError}
            </div>
          )}

          {claimSuccess && (
            <div className="max-w-6xl rounded-2xl border border-emerald-400/20 bg-emerald-400/[0.05] p-4 text-sm text-emerald-300">
              <div className="font-medium">{claimSuccess}</div>

              {claimTxHash && (
                <div className="mt-2">
                  <Link
                    to={`/explorer?tx=${encodeURIComponent(claimTxHash)}`}
                    className="font-medium underline decoration-emerald-400/30 underline-offset-4 transition hover:text-emerald-200"
                  >
                    View transaction →
                  </Link>
                </div>
              )}
            </div>
          )}

          {txHash && (
            <div className="max-w-6xl rounded-3xl border border-emerald-400/20 bg-emerald-400/[0.05] p-6">
              <div className="text-sm font-medium text-emerald-200">
                Delegation confirmed
              </div>

              {height !== null && (
                <div className="mt-2 text-xs text-slate-400">
                  Height: {height}
                </div>
              )}

              <div className="mt-2 text-xs">
                <Link
                  to={`/explorer?tx=${encodeURIComponent(txHash)}`}
                  className="break-all font-mono text-emerald-300 underline decoration-emerald-400/30 underline-offset-4 transition hover:text-emerald-200"
                >
                  {txHash}
                </Link>
              </div>
            </div>
          )}

          <div className="max-w-6xl rounded-3xl border border-white/10 bg-white/[0.03] p-6">
            <div className="text-xs uppercase tracking-wider text-slate-500">
              Validators
            </div>

            <div className="mt-2 text-lg font-semibold text-white">
              TatCoin Mainnet
            </div>

            {undelegateSuccess && (
              <div className="mt-4 rounded-2xl border border-emerald-400/20 bg-emerald-400/[0.05] p-4 text-sm text-emerald-300">
                <div className="font-medium">{undelegateSuccess}</div>

                {undelegateTxHash && (
                  <div className="mt-2">
                    <Link
                      to={`/explorer?tx=${encodeURIComponent(
                        undelegateTxHash,
                      )}`}
                      className="font-medium underline decoration-emerald-400/30 underline-offset-4 transition hover:text-emerald-200"
                    >
                      View transaction →
                    </Link>
                  </div>
                )}
              </div>
            )}

            {undelegateError && !undelegateValidator && (
              <div className="mt-4 rounded-2xl border border-red-400/20 bg-red-400/[0.05] p-4 text-sm text-red-300">
                {undelegateError}
              </div>
            )}

            {validators.length === 0 ? (
              <div className="mt-6 text-sm text-slate-500">
                No bonded validators found.
              </div>
            ) : (
              <div className="mt-6 space-y-3">
                {validators.map((validator) => {
                  const delegation = delegations.find(
                    (item) =>
                      item.validatorAddress === validator.operatorAddress,
                  );

                  const reward = rewards.find(
                    (item) =>
                      item.validatorAddress === validator.operatorAddress,
                  );

                  const validatorUnbondings = unbondings.filter(
                    (item) =>
                      item.validatorAddress === validator.operatorAddress,
                  );

                  const selected =
                    selectedValidator === validator.operatorAddress;

                  const undelegateSelected =
                    undelegateValidator === validator.operatorAddress;

                  return (
                    <div
                      key={validator.operatorAddress}
                      className="rounded-2xl border border-white/10 bg-black/10 p-4"
                    >
                      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-white">
                              {validator.moniker}
                            </span>

                            <span className="rounded-lg bg-emerald-400/10 px-2 py-1 text-xs text-emerald-300">
                              Bonded
                            </span>
                          </div>

                          <div className="mt-2 break-all font-mono text-xs text-slate-500">
                            {validator.operatorAddress}
                          </div>
                        </div>

                        <div className="grid gap-3 text-right sm:min-w-48">
                          <div>
                            <div className="text-xs text-slate-500">
                              Delegated
                            </div>

                            <div className="mt-1 font-medium text-white">
                              {formatUtat(delegation?.amountUtat ?? "0")} TAT
                            </div>
                          </div>

                          <div>
                            <div className="text-xs text-slate-500">
                              Rewards
                            </div>

                            <div className="mt-1 font-medium text-emerald-300">
                              {formatUtat(reward?.amountUtat ?? "0")} TAT
                            </div>

                            {reward &&
                              normalizeUtat(reward.amountUtat) > 0n && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    void handleClaimRewards(
                                      validator.operatorAddress,
                                    );
                                  }}
                                  disabled={
                                    claimingValidator ===
                                    validator.operatorAddress
                                  }
                                  className="mt-3 rounded-xl bg-emerald-400 px-4 py-2 text-sm font-medium text-black transition hover:bg-emerald-300 disabled:cursor-not-allowed disabled:opacity-50"
                                >
                                  {claimingValidator ===
                                  validator.operatorAddress
                                    ? "Claiming..."
                                    : "Claim rewards"}
                                </button>
                              )}
                          </div>

                          {validatorUnbondings.length > 0 && (
                            <div>
                              <div className="text-xs text-slate-500">
                                Unbonding
                              </div>

                              <div className="mt-1 space-y-3">
                                {validatorUnbondings.map((item) => (
                                  <div key={item.unbondingId}>
                                    <div className="font-medium text-amber-300">
                                      {formatUtat(item.balanceUtat)} TAT
                                    </div>

                                    {item.completionTime && (
                                      <>
                                        <div className="mt-1 text-xs text-slate-500">
                                          Available{" "}
                                          {new Date(
                                            item.completionTime,
                                          ).toLocaleString()}
                                        </div>

                                        <div className="mt-1 text-xs text-amber-300">
                                          {formatRemainingTime(
                                            item.completionTime,
                                          )}
                                        </div>
                                      </>
                                    )}
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="mt-5 border-t border-white/10 pt-4">
                        <div className="flex flex-wrap gap-3">
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedValidator(
                                selected ? "" : validator.operatorAddress,
                              );

                              setUndelegateValidator("");

                              setUndelegateReview(false);

                              setAmount("");
                              setEstimatedFee(null);
                              setError("");
                            }}
                            className="rounded-xl bg-cyan-400 px-4 py-2.5 text-sm font-semibold text-slate-950 transition hover:bg-cyan-300"
                          >
                            {selected ? "Cancel" : "Delegate"}
                          </button>

                          {delegation &&
                            normalizeUtat(delegation.amountUtat) > 0n && (
                              <button
                                type="button"
                                onClick={() => {
                                  if (undelegateSelected) {
                                    setUndelegateValidator("");

                                    setUndelegateReview(false);

                                    setUndelegateAmount("");

                                    setUndelegateFee(null);

                                    setUndelegateError("");

                                    return;
                                  }

                                  setSelectedValidator("");

                                  setUndelegateValidator(
                                    validator.operatorAddress,
                                  );

                                  setUndelegateAmount("");

                                  setUndelegateFee(null);

                                  setUndelegateReview(false);

                                  setUndelegateError("");
                                }}
                                className="rounded-xl border border-white/10 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-white/5"
                              >
                                {undelegateSelected ? "Cancel" : "Undelegate"}
                              </button>
                            )}
                        </div>

                        {undelegateSelected && (
                          <div className="mt-4 rounded-2xl border border-white/10 bg-black/20 p-4">
                            {!undelegateReview ? (
                              <>
                                <div className="flex items-center justify-between">
                                  <label className="text-sm font-medium text-slate-300">
                                    Amount
                                  </label>

                                  <div className="text-xs text-slate-500">
                                    Delegated:{" "}
                                    <span className="text-slate-300">
                                      {formatUtat(
                                        delegation?.amountUtat ?? "0",
                                      )}{" "}
                                      TAT
                                    </span>
                                  </div>
                                </div>

                                <div className="relative mt-2">
                                  <input
                                    value={undelegateAmount}
                                    onChange={(event) => {
                                      setUndelegateAmount(event.target.value);

                                      setUndelegateFee(null);

                                      setUndelegateError("");
                                    }}
                                    placeholder="0.100000"
                                    inputMode="decimal"
                                    className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 pr-28 text-white outline-none transition placeholder:text-slate-700 focus:border-violet-400/40"
                                  />

                                  <div className="absolute inset-y-0 right-3 flex items-center gap-2">
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setUndelegateAmount(
                                          formatUtat(
                                            delegation?.amountUtat ?? "0",
                                          ),
                                        );

                                        setUndelegateFee(null);

                                        setUndelegateError("");
                                      }}
                                      className="rounded-lg bg-white/5 px-2 py-1 text-xs font-semibold text-cyan-300 transition hover:bg-white/10"
                                    >
                                      MAX
                                    </button>

                                    <span className="text-sm font-medium text-cyan-300">
                                      TAT
                                    </span>
                                  </div>
                                </div>

                                <div className="mt-3 flex justify-between text-sm">
                                  <span className="text-slate-500">
                                    Network fee
                                  </span>

                                  <span className="text-white">
                                    {undelegateFee
                                      ? `~${formatUtat(undelegateFee)} TAT`
                                      : "—"}
                                  </span>
                                </div>

                                <div className="mt-4 rounded-xl border border-amber-400/20 bg-amber-400/[0.05] p-3 text-sm text-amber-200">
                                  Unbonding period: 21 days. Your TAT will not
                                  be transferable until the unbonding period
                                  completes.
                                </div>

                                {undelegateError && (
                                  <div className="mt-4 rounded-xl border border-red-400/20 bg-red-400/[0.05] p-3 text-sm text-red-300">
                                    {undelegateError}
                                  </div>
                                )}

                                <button
                                  type="button"
                                  disabled={!undelegateAmount.trim()}
                                  onClick={() => {
                                    void handleReviewUndelegate(
                                      validator.operatorAddress,
                                    );
                                  }}
                                  className="mt-4 w-full rounded-xl bg-violet-400 px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-violet-300 disabled:cursor-not-allowed disabled:opacity-50"
                                >
                                  Review undelegation
                                </button>
                              </>
                            ) : (
                              <div>
                                <div className="text-lg font-semibold text-white">
                                  Review undelegation
                                </div>

                                <div className="mt-4 space-y-3 text-sm">
                                  <div className="flex justify-between gap-4">
                                    <span className="text-slate-500">
                                      Amount
                                    </span>

                                    <span className="text-white">
                                      {undelegateAmount} TAT
                                    </span>
                                  </div>

                                  <div className="flex justify-between gap-4">
                                    <span className="text-slate-500">
                                      Network fee
                                    </span>

                                    <span className="text-white">
                                      ~{formatUtat(undelegateFee ?? "0")} TAT
                                    </span>
                                  </div>

                                  <div className="flex justify-between gap-4">
                                    <span className="text-slate-500">
                                      Unbonding
                                    </span>

                                    <span className="text-amber-200">
                                      21 days
                                    </span>
                                  </div>
                                </div>

                                {undelegateError && (
                                  <div className="mt-4 rounded-xl border border-red-400/20 bg-red-400/[0.05] p-3 text-sm text-red-300">
                                    {undelegateError}
                                  </div>
                                )}

                                <div className="mt-5 grid gap-3 sm:grid-cols-2">
                                  <button
                                    type="button"
                                    disabled={undelegating}
                                    onClick={() => {
                                      setUndelegateReview(false);

                                      setUndelegateError("");
                                    }}
                                    className="rounded-xl border border-white/10 bg-white/5 px-5 py-3 text-sm font-semibold text-white transition hover:bg-white/10 disabled:opacity-50"
                                  >
                                    Back
                                  </button>

                                  <button
                                    type="button"
                                    disabled={undelegating}
                                    onClick={() => {
                                      void handleConfirmUndelegate();
                                    }}
                                    className="rounded-xl bg-violet-400 px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-violet-300 disabled:cursor-not-allowed disabled:opacity-50"
                                  >
                                    {undelegating
                                      ? "Signing & broadcasting..."
                                      : "Confirm & Undelegate"}
                                  </button>
                                </div>
                              </div>
                            )}
                          </div>
                        )}

                        {selected && (
                          <div className="mt-4">
                            <div className="flex items-center justify-between">
                              <label className="text-sm font-medium text-slate-300">
                                Amount
                              </label>

                              <div className="text-xs text-slate-500">
                                Available:{" "}
                                <span className="text-slate-300">
                                  {balanceQuery.data !== undefined
                                    ? `${formatUtat(balanceQuery.data)} TAT`
                                    : "—"}
                                </span>
                              </div>
                            </div>

                            <div className="relative mt-2">
                              <input
                                value={amount}
                                onChange={(event) => {
                                  setAmount(event.target.value);

                                  setEstimatedFee(null);

                                  setError("");
                                }}
                                onBlur={() => {
                                  void handleEstimateFee(
                                    validator.operatorAddress,
                                    amount,
                                  );
                                }}
                                placeholder="1.000000"
                                inputMode="decimal"
                                className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 pr-28 text-white outline-none transition placeholder:text-slate-700 focus:border-cyan-400/40"
                              />

                              <div className="absolute inset-y-0 right-3 flex items-center gap-2">
                                <button
                                  type="button"
                                  onClick={() => {
                                    void handleDelegateMax(
                                      validator.operatorAddress,
                                    );
                                  }}
                                  disabled={estimatingFee}
                                  className="rounded-lg bg-white/5 px-2 py-1 text-xs font-semibold text-cyan-300 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50"
                                >
                                  MAX
                                </button>

                                <span className="text-sm font-medium text-cyan-300">
                                  TAT
                                </span>
                              </div>
                            </div>

                            <div className="mt-3 flex items-center justify-between text-sm">
                              <span className="text-slate-500">
                                Network fee
                              </span>

                              <span className="text-slate-300">
                                {estimatingFee
                                  ? "Estimating..."
                                  : estimatedFee
                                    ? `~${estimatedFee} TAT`
                                    : "—"}
                              </span>
                            </div>

                            {error && (
                              <div className="mt-4 rounded-xl border border-red-400/20 bg-red-400/[0.05] p-3 text-sm text-red-300">
                                {error}
                              </div>
                            )}

                            <button
                              type="button"
                              disabled={!amount.trim() || estimatingFee}
                              onClick={() => {
                                void handleReview();
                              }}
                              className="mt-4 w-full rounded-xl bg-cyan-400 px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-cyan-300 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                              Review delegation
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
