import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  RiCheckboxCircleLine,
  RiErrorWarningLine,
  RiPulseLine,
  RiSearchLine,
  RiTimeLine,
} from "react-icons/ri";

import {
  getTatCoinAddress,
  getTatCoinAddressTransactions,
  getTatCoinBlock,
  getTatCoinNetworkStatus,
  getTatCoinTransaction,
  type TatCoinAddress,
  type TatCoinAddressTransaction,
  type TatCoinBlock,
  type TatCoinTransaction,
} from "../../services/explorer/tatcoin";

function formatBlockTime(value: string): string {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleString();
}

function formatUtat(value: string | null): string {
  if (!value) {
    return "—";
  }

  const amount = BigInt(value);
  const whole = amount / 1_000_000n;
  const fraction = amount % 1_000_000n;

  return `${whole}.${fraction.toString().padStart(6, "0")} TAT`;
}

export default function Explorer() {
  const [searchValue, setSearchValue] = useState("");
  const [transaction, setTransaction] =
    useState<TatCoinTransaction | null>(null);
  const [block, setBlock] =
    useState<TatCoinBlock | null>(null);
  const [account, setAccount] =
    useState<TatCoinAddress | null>(null);
  const [accountTransactions, setAccountTransactions] =
    useState<TatCoinAddressTransaction[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState("");

  const statusQuery = useQuery({
    queryKey: ["tatcoin-network-status"],
    queryFn: getTatCoinNetworkStatus,
    refetchInterval: 5000,
  });

  const status = statusQuery.data;

  async function openTransaction(hash: string) {
    try {
      setSearching(true);
      setSearchError("");

      setTransaction(null);
      setBlock(null);
      setAccount(null);
      setAccountTransactions([]);

      const result = await getTatCoinTransaction(hash);
  
      setTransaction(result);
      } catch (err) {
      setSearchError(
        err instanceof Error
          ? err.message
          : "Unable to load transaction",
      );
    } finally {
      setSearching(false);
    }  
  }

  async function openBlock(height: string) {
    try {
      setSearching(true);
      setSearchError("");

      setTransaction(null);
      setBlock(null);
      setAccount(null);
      setAccountTransactions([]);

      const result = await getTatCoinBlock(height);

      setSearchValue(height);
      setBlock(result);
    } catch (err) {
      setSearchError(
        err instanceof Error
          ? err.message
          : "Unable to load block",
      );
    } finally {
      setSearching(false);
    }
  }

  async function openAddress(addressValue: string) {
    try {
      setSearching(true);
      setSearchError("");

      setTransaction(null);
      setBlock(null);
      setAccount(null);
      setAccountTransactions([]);

      const [accountResult, transactionsResult] =
        await Promise.all([
          getTatCoinAddress(addressValue),
          getTatCoinAddressTransactions(addressValue),
        ]);

      setSearchValue(addressValue);
      setAccount(accountResult);
      setAccountTransactions(transactionsResult);
    } catch (err) {
      setSearchError(
        err instanceof Error
          ? err.message
          : "Unable to load address",
      );
    } finally {
      setSearching(false);
    }
  }

  async function handleSearch() {
    const value = searchValue.trim();

    if (!value) {
      return;
    }

    try {
      setSearching(true);
      setSearchError("");
      setTransaction(null);
      setBlock(null);
      setAccount(null);
      setAccountTransactions([]);

      if (/^\d+$/.test(value)) {
        const result = await getTatCoinBlock(value);
        setBlock(result);
        return;
      }

      if (/^[A-Fa-f0-9]{64}$/.test(value)) {
        const result = await getTatCoinTransaction(value);
        setTransaction(result);
        return;
      }

      if (/^tat1[a-z0-9]+$/.test(value)) {
	  const [accountResult, transactionsResult] =
	    await Promise.all([
	      getTatCoinAddress(value),
	      getTatCoinAddressTransactions(value),
	    ]);

	  setAccount(accountResult);
	  setAccountTransactions(transactionsResult);

	  return;
      }

      throw new Error(
        "Enter a transaction hash, block height or TatCoin address",
      );
    } catch (err) {
        setSearchError(
        err instanceof Error
          ? err.message
          : "Unable to search",
      );
    } finally {
      setSearching(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-white">
          Explorer
        </h1>

        <p className="mt-1 text-sm text-slate-500">
          Explore the TatCoin network.
        </p>
      </div>

      <div className="max-w-4xl rounded-3xl border border-white/10 bg-white/[0.03] p-5">
        <div className="flex flex-col gap-3 sm:flex-row">
          <div className="relative flex-1">
            <RiSearchLine className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-lg text-slate-600" />

            <input
              value={searchValue}
              onChange={(event) => {
                setSearchValue(event.target.value);
                setSearchError("");
              }}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  void handleSearch();
                }
              }}
	      placeholder="TX hash, block height or tat1... address"
              spellCheck={false}
              autoComplete="off"
              className="w-full rounded-2xl border border-white/10 bg-black/20 py-3 pl-11 pr-4 font-mono text-sm text-white outline-none transition placeholder:text-slate-700 focus:border-cyan-400/40"
            />
          </div>

          <button
            type="button"
            onClick={() => {
              void handleSearch();
            }}
            disabled={!searchValue.trim() || searching}
            className="rounded-2xl bg-cyan-400 px-6 py-3 text-sm font-semibold text-slate-950 transition hover:bg-cyan-300 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {searching ? "Searching..." : "Search"}
          </button>
        </div>

        {searchError && (
          <div className="mt-4 rounded-xl border border-red-400/20 bg-red-400/[0.05] p-3 text-sm text-red-300">
            {searchError}
          </div>
        )}
      </div>

      {transaction && (
        <div className="max-w-4xl rounded-3xl border border-white/10 bg-white/[0.03] p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="text-xs uppercase tracking-wider text-slate-500">
                Transaction
              </div>

              <div className="mt-2 text-lg font-semibold text-white">
                Details
              </div>
            </div>

            {transaction.code === 0 ? (
              <div className="flex items-center gap-2 rounded-xl bg-emerald-400/10 px-3 py-2 text-sm text-emerald-300">
                <RiCheckboxCircleLine />
                Success
              </div>
            ) : (
              <div className="flex items-center gap-2 rounded-xl bg-red-400/10 px-3 py-2 text-sm text-red-300">
                <RiErrorWarningLine />
                Failed
              </div>
            )}
          </div>

          <div className="mt-6 space-y-5">
            <div>
              <div className="text-xs uppercase tracking-wider text-slate-500">
                TX Hash
              </div>

              <div className="mt-2 break-all font-mono text-sm text-cyan-300">
                {transaction.hash}
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="rounded-2xl border border-white/10 bg-black/10 p-4">
                <div className="text-xs uppercase tracking-wider text-slate-500">
                  Height
                </div>

		<button
		  type="button"
		  onClick={() => {
		    void openBlock(transaction.height);
		  }}
		  className="mt-2 font-medium text-cyan-300 transition hover:text-cyan-200"
		>
		  #{transaction.height}
		</button>

              </div>

              <div className="rounded-2xl border border-white/10 bg-black/10 p-4">
                <div className="text-xs uppercase tracking-wider text-slate-500">
                  Amount
                </div>

                <div className="mt-2 font-medium text-white">
                  {formatUtat(transaction.amountUtat)}
                </div>
              </div>
            </div>

            <div>
              <div className="text-xs uppercase tracking-wider text-slate-500">
                From
              </div>

	      {transaction.fromAddress ? (
		  <button
		    type="button"
		    onClick={() => {
		      void openAddress(transaction.fromAddress!);
		    }}
		    className="mt-2 w-full break-all rounded-2xl border border-white/10 bg-black/10 p-4 text-left font-mono text-sm text-cyan-300 transition hover:border-cyan-400/30 hover:text-cyan-200"
		  >
		    {transaction.fromAddress}
		  </button>
		) : (
		  <div className="mt-2 rounded-2xl border border-white/10 bg-black/10 p-4 text-sm text-slate-500">
		    —
		  </div>
	      )}

            </div>

            <div>
              <div className="text-xs uppercase tracking-wider text-slate-500">
                To
              </div>

	      {transaction.toAddress ? (
		  <button
		    type="button"
		    onClick={() => {
		      void openAddress(transaction.toAddress!);
		    }}
		    className="mt-2 w-full break-all rounded-2xl border border-white/10 bg-black/10 p-4 text-left font-mono text-sm text-cyan-300 transition hover:border-cyan-400/30 hover:text-cyan-200"
		  >
		    {transaction.toAddress}
		  </button>
		) : (
		  <div className="mt-2 rounded-2xl border border-white/10 bg-black/10 p-4 text-sm text-slate-500">
		    —
		  </div>
	      )}

            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="rounded-2xl border border-white/10 bg-black/10 p-4">
                <div className="text-xs uppercase tracking-wider text-slate-500">
                  Network fee
                </div>

                <div className="mt-2 font-medium text-white">
                  {formatUtat(transaction.feeUtat)}
                </div>
              </div>

              <div className="rounded-2xl border border-white/10 bg-black/10 p-4">
                <div className="text-xs uppercase tracking-wider text-slate-500">
                  Time
                </div>

                <div className="mt-2 text-sm text-white">
                  {transaction.timestamp
                    ? formatBlockTime(transaction.timestamp)
                    : "—"}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

            {block && (
        <div className="max-w-4xl rounded-3xl border border-white/10 bg-white/[0.03] p-6">
          <div>
            <div className="text-xs uppercase tracking-wider text-slate-500">
              Block
            </div>

            <div className="mt-2 text-lg font-semibold text-white">
              #{block.height}
            </div>
          </div>

          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            <div className="rounded-2xl border border-white/10 bg-black/10 p-4">
              <div className="text-xs uppercase tracking-wider text-slate-500">
                Transactions
              </div>

              <div className="mt-2 text-lg font-semibold text-white">
                {block.txCount}
              </div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-black/10 p-4">
              <div className="text-xs uppercase tracking-wider text-slate-500">
                Time
              </div>

              <div className="mt-2 text-sm text-white">
                {formatBlockTime(block.time)}
              </div>
            </div>
          </div>

          <div className="mt-5">
            <div className="text-xs uppercase tracking-wider text-slate-500">
              Block hash
            </div>

            <div className="mt-2 break-all rounded-2xl border border-white/10 bg-black/10 p-4 font-mono text-sm text-cyan-300">
              {block.hash}
            </div>
          </div>

          <div className="mt-5">
            <div className="text-xs uppercase tracking-wider text-slate-500">
              Proposer
            </div>

            <div className="mt-2 break-all rounded-2xl border border-white/10 bg-black/10 p-4 font-mono text-sm text-slate-300">
              {block.proposerAddress}
            </div>
          </div>
        </div>
      )}

      {account && (
	  <div className="max-w-4xl rounded-3xl border border-white/10 bg-white/[0.03] p-6">
	    <div>
	      <div className="text-xs uppercase tracking-wider text-slate-500">
	        Address
	      </div>

	      <div className="mt-2 text-lg font-semibold text-white">
	        Details
	      </div>
	    </div>

	    <div className="mt-6">
	      <div className="text-xs uppercase tracking-wider text-slate-500">
	        TatCoin address
	      </div>

	      <div className="mt-2 break-all rounded-2xl border border-white/10 bg-black/10 p-4 font-mono text-sm text-cyan-300">
	        {account.address}
	      </div>
	    </div>

	    <div className="mt-5 grid gap-4 sm:grid-cols-2">
	      <div className="rounded-2xl border border-white/10 bg-black/10 p-4">
	        <div className="text-xs uppercase tracking-wider text-slate-500">
	          Balance
	        </div>

	        <div className="mt-2 text-lg font-semibold text-white">
	          {formatUtat(account.balanceUtat)}
	        </div>
	      </div>

	      <div className="rounded-2xl border border-white/10 bg-black/10 p-4">
	        <div className="text-xs uppercase tracking-wider text-slate-500">
	          Network
	        </div>

	        <div className="mt-2 font-medium text-white">
	          TatCoin Mainnet
	        </div>

	        <div className="mt-1 font-mono text-xs text-cyan-300">
	          tat-1
	        </div>
	      </div>
	    </div>
	  </div>
      )}

      {account && (
	  <div className="max-w-4xl rounded-3xl border border-white/10 bg-white/[0.03] p-6">
	    <div className="text-xs uppercase tracking-wider text-slate-500">
	      Recent transactions
	    </div>

	    <div className="mt-2 text-lg font-semibold text-white">
	      Transaction history
	    </div>

	    {accountTransactions.length === 0 ? (
	      <div className="mt-6 rounded-2xl border border-white/10 bg-black/10 p-4 text-sm text-slate-400">
	        No transactions found.
	      </div>
	    ) : (
	      <div className="mt-6 space-y-3">
	        {accountTransactions.map((tx) => {
	          const sent = tx.direction === "sent";

	          return (
	            <div
	              key={tx.hash}
	              className="rounded-2xl border border-white/10 bg-black/10 p-4"
	            >
	              <div className="flex items-start justify-between gap-4">
	                <div>
	                  <div
	                    className={
	                      sent
	                        ? "font-medium text-amber-300"
	                        : "font-medium text-emerald-300"
	                    }
	                  >
	                    {sent ? "↑ Sent" : "↓ Received"}
	                  </div>

	                  <div className="mt-2 text-xs text-slate-500">
	                    Block #{tx.height}
	                  </div>

	                  {tx.timestamp && (
	                    <div className="mt-1 text-xs text-slate-500">
	                      {formatBlockTime(tx.timestamp)}
	                    </div>
	                  )}
	                </div>

	                <div
	                  className={
	                    sent
	                      ? "text-right font-semibold text-white"
	                      : "text-right font-semibold text-emerald-300"
	                  }
	                >
	                  {sent ? "-" : "+"}
	                  {formatUtat(tx.amountUtat)}
	                </div>
	              </div>
	
	              <button
	                type="button"
	                onClick={() => {
	                  setSearchValue(tx.hash);
	                  void openTransaction(tx.hash);
	                }}
	                className="mt-4 max-w-full break-all font-mono text-left text-xs text-cyan-300 transition hover:text-cyan-200"
	              >
	                {tx.hash}
	              </button>
	            </div>
	          );
	        })}
	      </div>
	    )}
	  </div>
      )}

      {statusQuery.isLoading && (
        <div className="max-w-4xl rounded-3xl border border-white/10 bg-white/[0.03] p-6 text-sm text-slate-400">
          Loading network status...
        </div>
      )}

      {statusQuery.isError && (
        <div className="max-w-4xl rounded-3xl border border-red-400/20 bg-red-400/[0.05] p-6">
          <div className="flex items-center gap-2 text-red-300">
            <RiErrorWarningLine className="text-xl" />
            Unable to load TatCoin network status.
          </div>
        </div>
      )}

      {status && (
        <>
          <div className="grid max-w-4xl gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-5">
              <div className="text-xs uppercase tracking-wider text-slate-500">
                Latest block
              </div>

              <div className="mt-3 text-2xl font-semibold text-white">
                #{status.latestBlockHeight}
              </div>

              <div className="mt-2 flex items-center gap-2 text-xs text-slate-500">
                <RiTimeLine />
                {formatBlockTime(status.latestBlockTime)}
              </div>
            </div>

            <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-5">
              <div className="text-xs uppercase tracking-wider text-slate-500">
                Network
              </div>

              <div className="mt-3 text-lg font-semibold text-white">
                TatCoin Mainnet
              </div>

              <div className="mt-2 font-mono text-sm text-cyan-300">
                {status.chainId}
              </div>
            </div>

            <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-5">
              <div className="text-xs uppercase tracking-wider text-slate-500">
                Node status
              </div>

              <div className="mt-3 flex items-center gap-2">
                {status.catchingUp ? (
                  <>
                    <RiPulseLine className="text-xl text-amber-300" />
                    <span className="font-medium text-amber-200">
                      Syncing
                    </span>
                  </>
                ) : (
                  <>
                    <RiCheckboxCircleLine className="text-xl text-emerald-300" />
                    <span className="font-medium text-emerald-200">
                      Synced
                    </span>
                  </>
                )}
              </div>

              <div className="mt-2 text-xs text-slate-500">
                Node: {status.moniker}
              </div>
            </div>
          </div>

          <div className="max-w-4xl rounded-3xl border border-white/10 bg-white/[0.03] p-5">
            <div className="text-xs uppercase tracking-wider text-slate-500">
              Latest block hash
            </div>

            <div className="mt-3 break-all font-mono text-sm text-slate-300">
              {status.latestBlockHash}
            </div>

            <div className="mt-4 border-t border-white/10 pt-4">
              <span className="text-xs text-slate-500">
                CometBFT {status.nodeVersion}
              </span>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
