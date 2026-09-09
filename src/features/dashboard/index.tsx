import { formatUsdtBalance, getUsdtBalance } from "../../services/usdt";
import { ASSETS } from "../../config/assets";
import {
  getTatCoinAddressTransactions,
  type TatCoinAddressTransaction,
} from "../../services/explorer/tatcoin";
import {
  getDelegations,
  getRewards,
  getUnbondings,
} from "../../services/staking";
import {
  RiAddLine,
  RiArrowDownLine,
  RiArrowUpLine,
  RiGlobalLine,
  RiShieldCheckLine,
  RiWallet3Line,
} from "react-icons/ri";
import { Link } from "react-router-dom";
import { useWalletStore } from "../../stores/wallet-store";
import { useQuery } from "@tanstack/react-query";
import { formatTatBalance, getTatBalance } from "../../services/bank";
import {
  formatBitcoinBalance,
  getBitcoinBalance,
} from "../../services/bitcoin";
import {
  formatEthereumBalance,
  getEthereumBalance,
} from "../../services/ethereum";

export default function Dashboard() {
  const address = useWalletStore((state) => state.address);
  const btcAddress = useWalletStore((state) => state.btcAddress);
  const ethAddress = useWalletStore((state) => state.ethAddress);
  const hasWallet = Boolean(address);
  const balanceQuery = useQuery({
    queryKey: ["tat-balance", address],
    queryFn: () => getTatBalance(address!),
    enabled: Boolean(address),
    refetchInterval: 10_000,
  });

  const bitcoinBalanceQuery = useQuery({
    queryKey: ["bitcoin-balance", btcAddress],
    queryFn: () => getBitcoinBalance(btcAddress!),
    enabled: Boolean(btcAddress),
    refetchInterval: 30_000,
  });

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

  const delegationsQuery = useQuery({
    queryKey: ["tat-delegations", address],
    queryFn: () => getDelegations(address!),
    enabled: Boolean(address),
    refetchInterval: 10_000,
  });

  const rewardsQuery = useQuery({
    queryKey: ["tat-rewards", address],
    queryFn: () => getRewards(address!),
    enabled: Boolean(address),
    refetchInterval: 10_000,
  });

  const unbondingsQuery = useQuery({
    queryKey: ["tat-unbondings", address],
    queryFn: () => getUnbondings(address!),
    enabled: Boolean(address),
    refetchInterval: 10_000,
  });

  const activityQuery = useQuery({
    queryKey: ["tat-address-transactions", address],
    queryFn: () => getTatCoinAddressTransactions(address!),
    enabled: Boolean(address),
    refetchInterval: 10_000,
  });

  const formattedBalance =
    address && balanceQuery.data ? formatTatBalance(balanceQuery.data) : null;

  const formattedBitcoinBalance =
    btcAddress && bitcoinBalanceQuery.data !== undefined
      ? formatBitcoinBalance(bitcoinBalanceQuery.data.total)
      : null;

  const formattedEthereumBalance =
    ethAddress && ethereumBalanceQuery.data !== undefined
      ? formatEthereumBalance(ethereumBalanceQuery.data)
      : null;

  const formattedUsdtBalance =
    ethAddress && usdtBalanceQuery.data !== undefined
      ? formatUsdtBalance(usdtBalanceQuery.data)
      : null;

  const delegatedUtat = (delegationsQuery.data ?? [])
    .reduce((total, item) => total + BigInt(item.amountUtat), 0n)
    .toString();

  const rewardsUtat = (rewardsQuery.data ?? [])
    .reduce((total, item) => {
      const [whole = "0"] = item.amountUtat.split(".");
      return total + BigInt(whole || "0");
    }, 0n)
    .toString();

  const unbondingUtat = (unbondingsQuery.data ?? [])
    .reduce((total, item) => total + BigInt(item.balanceUtat), 0n)
    .toString();

  const recentActivity = (activityQuery.data ?? []).slice(0, 5);

  function activityLabel(tx: TatCoinAddressTransaction): string {
    switch (tx.direction) {
      case "sent":
        return "Sent";
      case "received":
        return "Received";
      case "delegate":
        return "Delegate";
      case "undelegate":
        return "Undelegate";
      case "claim_rewards":
        return "Claim rewards";
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-white">Dashboard</h1>
        <p className="mt-1 text-sm text-slate-500">
          Overview of your TatCoin wallet
        </p>
      </div>

      <section className="overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-cyan-400/15 via-slate-900 to-slate-950 p-6 shadow-2xl shadow-black/20">
        <div className="flex flex-col justify-between gap-8 sm:flex-row sm:items-start">
          <div>
            <div className="text-sm font-medium text-slate-400">
              Total Balance
            </div>

            <div className="mt-3 flex items-baseline gap-3">
              <span className="text-4xl font-semibold tracking-tight text-white sm:text-5xl">
                {!hasWallet
                  ? "—"
                  : balanceQuery.isLoading
                    ? "Loading..."
                    : balanceQuery.isError
                      ? "Error"
                      : (formattedBalance ?? "0.000000")}
              </span>

              <span className="text-lg font-medium text-cyan-300">TAT</span>
            </div>

            <div className="mt-3 text-sm text-slate-500">
              {!hasWallet
                ? "Create or import a wallet to get started"
                : balanceQuery.isError
                  ? "Unable to load balance"
                  : "Available balance"}
            </div>
          </div>

          <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-cyan-300/20 bg-cyan-400/10 text-cyan-300">
            <RiWallet3Line className="text-2xl" />
          </div>
        </div>

        <div className="mt-8 flex flex-wrap gap-3">
          {hasWallet ? (
            <>
              <Link
                to="/send"
                className="inline-flex items-center gap-2 rounded-xl bg-cyan-400 px-4 py-2.5 text-sm font-semibold text-slate-950 transition hover:bg-cyan-300"
              >
                <RiArrowUpLine />
                Send
              </Link>

              <Link
                to="/receive"
                className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-white/10"
              >
                <RiArrowDownLine />
                Receive
              </Link>
            </>
          ) : (
            <>
              <Link
                to="/wallet"
                className="inline-flex items-center gap-2 rounded-xl bg-cyan-400 px-4 py-2.5 text-sm font-semibold text-slate-950 transition hover:bg-cyan-300"
              >
                <RiAddLine />
                Create wallet
              </Link>

              <Link
                to="/wallet"
                className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-white/10"
              >
                Import wallet
              </Link>
            </>
          )}
        </div>
      </section>

      <section className="rounded-3xl border border-white/10 bg-white/[0.03] p-6">
        <div>
          <div className="text-xs uppercase tracking-wider text-slate-500">
            Assets
          </div>

          <div className="mt-2 text-lg font-semibold text-white">
            Your assets
          </div>
        </div>

        <div className="mt-6 grid gap-3">
          {ASSETS.map((asset) => {
            const isTat = asset.id === "tat";
            const isBtc = asset.id === "btc";
            const isEth = asset.id === "eth";
            const isUsdt = asset.id === "usdt";

            return (
              <div
                key={asset.id}
                className="flex flex-col justify-between gap-4 rounded-2xl border border-white/10 bg-black/10 p-4 sm:flex-row sm:items-center"
              >
                <div>
                  <div className="font-medium text-white">{asset.name}</div>

                  <div className="mt-1 text-xs text-slate-500">
                    {asset.symbol}
                  </div>
                </div>

                <div className="text-left sm:text-right">
                  {isTat ? (
                    <>
                      <div className="font-semibold text-white">
                        {hasWallet
                          ? balanceQuery.isLoading
                            ? "Loading..."
                            : balanceQuery.isError
                              ? "Error"
                              : `${formattedBalance ?? "0.000000"} TAT`
                          : "—"}
                      </div>

                      <div className="mt-1 text-xs text-emerald-300">
                        Active
                      </div>
                    </>
                  ) : isBtc ? (
                    <>
                      <div className="font-semibold text-white">
                        {!btcAddress
                          ? "—"
                          : bitcoinBalanceQuery.isLoading
                            ? "Loading..."
                            : bitcoinBalanceQuery.isError
                              ? "Unable to load"
                              : `${formattedBitcoinBalance ?? "0.00000000"} BTC`}
                      </div>

                      <div
                        className={
                          bitcoinBalanceQuery.isError
                            ? "mt-1 text-xs text-red-300"
                            : "mt-1 text-xs text-emerald-300"
                        }
                      >
                        {btcAddress
                          ? bitcoinBalanceQuery.isError
                            ? "Bitcoin API unavailable"
                            : "Bitcoin Mainnet"
                          : "Unlock wallet to derive address"}
                      </div>
                    </>
                  ) : isEth ? (
                    <>
                      <div className="font-semibold text-white">
                        {!ethAddress
                          ? "—"
                          : ethereumBalanceQuery.isLoading
                            ? "Loading..."
                            : ethereumBalanceQuery.isError
                              ? "Unable to load"
                              : `${formattedEthereumBalance ?? "0.000000000000000000"} ETH`}
                      </div>

                      <div
                        className={
                          ethereumBalanceQuery.isError
                            ? "mt-1 text-xs text-red-300"
                            : "mt-1 text-xs text-emerald-300"
                        }
                      >
                        {ethAddress
                          ? ethereumBalanceQuery.isError
                            ? "Ethereum RPC unavailable"
                            : "Ethereum Mainnet"
                          : "Unlock wallet to derive address"}
                      </div>
                    </>
                  ) : isUsdt ? (
                    <>
                      <div className="font-semibold text-white">
                        {!ethAddress
                          ? "—"
                          : usdtBalanceQuery.isLoading
                            ? "Loading..."
                            : usdtBalanceQuery.isError
                              ? "Unable to load"
                              : `${formattedUsdtBalance ?? "0.000000"} USDT`}
                      </div>

                      <div
                        className={
                          usdtBalanceQuery.isError
                            ? "mt-1 text-xs text-red-300"
                            : "mt-1 text-xs text-emerald-300"
                        }
                      >
                        {ethAddress
                          ? usdtBalanceQuery.isError
                            ? "Ethereum RPC unavailable"
                            : "Ethereum ERC-20"
                          : "Unlock wallet to derive address"}
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="font-semibold text-slate-400">—</div>

                      <div className="mt-1 text-xs text-amber-300">
                        Coming soon
                      </div>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
          <div className="flex items-start justify-between">
            <div>
              <div className="text-sm text-slate-500">Wallet Address</div>
              <div className="mt-3 font-medium text-white">
                {address ?? "No wallet"}
              </div>
            </div>

            <RiWallet3Line className="text-xl text-slate-500" />
          </div>

          <div className="mt-4 text-xs text-slate-600">
            {hasWallet ? "TatCoin account" : "Create or import a wallet"}
          </div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
          <div className="flex items-start justify-between">
            <div>
              <div className="text-sm text-slate-500">Network</div>
              <div className="mt-3 flex items-center gap-2 font-medium text-white">
                <span className="h-2 w-2 rounded-full bg-emerald-400" />
                TatCoin Mainnet
              </div>
            </div>

            <RiGlobalLine className="text-xl text-slate-500" />
          </div>

          <div className="mt-4 text-xs text-slate-600">Chain ID: tat-1</div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
          <div className="flex items-start justify-between">
            <div>
              <div className="text-sm text-slate-500">Staking</div>

              <div className="mt-3 font-medium text-white">
                {hasWallet ? `${formatTatBalance(delegatedUtat)} TAT` : "—"}
              </div>
            </div>

            <RiShieldCheckLine className="text-xl text-slate-500" />
          </div>

          <div className="mt-4 space-y-1 text-xs text-slate-600">
            <div>
              Rewards:{" "}
              <span className="text-emerald-300">
                {hasWallet ? `${formatTatBalance(rewardsUtat)} TAT` : "—"}
              </span>
            </div>

            <div>
              Unbonding:{" "}
              <span className="text-amber-300">
                {hasWallet ? `${formatTatBalance(unbondingUtat)} TAT` : "—"}
              </span>
            </div>
          </div>
        </div>
      </section>

      <section className="rounded-3xl border border-white/10 bg-white/[0.03] p-6">
        <div className="flex items-center justify-between gap-4">
          <div>
            <div className="text-xs uppercase tracking-wider text-slate-500">
              Recent activity
            </div>

            <div className="mt-2 text-lg font-semibold text-white">
              Latest transactions
            </div>
          </div>

          <Link
            to={
              address
                ? `/explorer?address=${encodeURIComponent(address)}`
                : "/explorer"
            }
            className="text-sm font-medium text-cyan-300 transition hover:text-cyan-200"
          >
            View all →
          </Link>
        </div>

        {!hasWallet ? (
          <div className="mt-6 text-sm text-slate-500">
            Create or import a wallet to view activity.
          </div>
        ) : activityQuery.isLoading ? (
          <div className="mt-6 text-sm text-slate-500">Loading activity...</div>
        ) : activityQuery.isError ? (
          <div className="mt-6 text-sm text-red-300">
            Unable to load recent activity.
          </div>
        ) : recentActivity.length === 0 ? (
          <div className="mt-6 text-sm text-slate-500">
            No transactions found.
          </div>
        ) : (
          <div className="mt-6 space-y-3">
            {recentActivity.map((tx) => (
              <Link
                key={tx.hash}
                to={`/explorer?tx=${encodeURIComponent(tx.hash)}`}
                className="flex items-center justify-between gap-4 rounded-2xl border border-white/10 bg-black/10 p-4 transition hover:border-cyan-400/20 hover:bg-white/[0.03]"
              >
                <div>
                  <div className="font-medium text-white">
                    {activityLabel(tx)}
                  </div>

                  <div className="mt-1 text-xs text-slate-500">
                    Block #{tx.height}
                  </div>
                </div>

                <div className="text-right font-medium text-slate-200">
                  {tx.direction === "sent" && "-"}
                  {(tx.direction === "received" ||
                    tx.direction === "claim_rewards") &&
                    "+"}
                  {formatTatBalance(tx.amountUtat)} TAT
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
