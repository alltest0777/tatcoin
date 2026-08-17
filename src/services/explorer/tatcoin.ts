const RPC_BASE_URL = "/rpc";

interface StatusResponse {
  result: {
    node_info: {
      network: string;
      moniker: string;
      version: string;
    };
    sync_info: {
      latest_block_hash: string;
      latest_block_height: string;
      latest_block_time: string;
      catching_up: boolean;
    };
  };
}

export interface TatCoinNetworkStatus {
  chainId: string;
  moniker: string;
  nodeVersion: string;
  latestBlockHash: string;
  latestBlockHeight: string;
  latestBlockTime: string;
  catchingUp: boolean;
}

export async function getTatCoinNetworkStatus(): Promise<TatCoinNetworkStatus> {
  const response = await fetch(`${RPC_BASE_URL}/status`);

  if (!response.ok) {
    throw new Error(
      `Failed to load network status: HTTP ${response.status}`,
    );
  }

  const data = (await response.json()) as StatusResponse;

  return {
    chainId: data.result.node_info.network,
    moniker: data.result.node_info.moniker,
    nodeVersion: data.result.node_info.version,
    latestBlockHash: data.result.sync_info.latest_block_hash,
    latestBlockHeight: data.result.sync_info.latest_block_height,
    latestBlockTime: data.result.sync_info.latest_block_time,
    catchingUp: data.result.sync_info.catching_up,
  };
}

export interface TatCoinTransaction {
  hash: string;
  height: string;
  code: number;
  timestamp: string | null;
  fromAddress: string | null;
  toAddress: string | null;
  amountUtat: string | null;
  feeUtat: string | null;
}

export async function getTatCoinTransaction(
  hash: string,
): Promise<TatCoinTransaction> {
  const normalizedHash = hash.trim().toUpperCase();

  const response = await fetch(
  `/cosmos/tx/v1beta1/txs/${encodeURIComponent(normalizedHash)}`,
  );

  if (!response.ok) {
    if (response.status === 404) {
      throw new Error("Transaction not found");
    }

    throw new Error(
      `Failed to load transaction: HTTP ${response.status}`,
    );
  }

  const data = await response.json();

  const txResponse = data.tx_response;
  const tx = data.tx;

  const message = tx?.body?.messages?.[0];

  const amountCoin =
    Array.isArray(message?.amount)
      ? message.amount.find(
          (coin: { denom?: string }) =>
            coin.denom === "utat",
        )
      : null;

  const feeCoin =
    Array.isArray(tx?.auth_info?.fee?.amount)
      ? tx.auth_info.fee.amount.find(
          (coin: { denom?: string }) =>
            coin.denom === "utat",
        )
      : null;

  return {
    hash: txResponse?.txhash ?? normalizedHash,
    height: txResponse?.height ?? "",
    code: Number(txResponse?.code ?? 0),
    timestamp: txResponse?.timestamp ?? null,

    fromAddress:
      message?.from_address ?? null,

    toAddress:
      message?.to_address ?? null,

    amountUtat:
      amountCoin?.amount ?? null,

    feeUtat:
      feeCoin?.amount ?? null,
  };
}

export interface TatCoinBlock {
  height: string;
  hash: string;
  time: string;
  proposerAddress: string;
  txCount: number;
}

interface BlockResponse {
  result: {
    block_id: {
      hash: string;
    };
    block: {
      header: {
        height: string;
        time: string;
        proposer_address: string;
      };
      data: {
        txs?: string[];
      };
    };
  };
}

export async function getTatCoinBlock(
  height: string,
): Promise<TatCoinBlock> {
  const normalizedHeight = height.trim();

  if (!/^\d+$/.test(normalizedHeight)) {
    throw new Error("Invalid block height");
  }

  const response = await fetch(
    `/rpc/block?height=${encodeURIComponent(normalizedHeight)}`,
  );

  if (!response.ok) {
    throw new Error(
      `Failed to load block: HTTP ${response.status}`,
    );
  }

  const data = (await response.json()) as BlockResponse;

  return {
    height: data.result.block.header.height,
    hash: data.result.block_id.hash,
    time: data.result.block.header.time,
    proposerAddress:
      data.result.block.header.proposer_address,
    txCount:
      data.result.block.data.txs?.length ?? 0,
  };
}

export interface TatCoinAddress {
  address: string;
  balanceUtat: string;
}

interface BalanceResponse {
  balance?: {
    denom?: string;
    amount?: string;
  };
}

export async function getTatCoinAddress(
  address: string,
): Promise<TatCoinAddress> {
  const normalizedAddress = address.trim();

  if (!/^tat1[a-z0-9]+$/.test(normalizedAddress)) {
    throw new Error("Invalid TatCoin address");
  }

  const response = await fetch(
    `/cosmos/bank/v1beta1/balances/${encodeURIComponent(
      normalizedAddress,
    )}/by_denom?denom=utat`,
  );

  if (!response.ok) {
    throw new Error(
      `Failed to load address: HTTP ${response.status}`,
    );
  }

  const data = (await response.json()) as BalanceResponse;

  return {
    address: normalizedAddress,
    balanceUtat:
      data.balance?.denom === "utat"
        ? data.balance.amount ?? "0"
        : "0",
  };
}

export interface TatCoinAddressTransaction {
  hash: string;
  height: string;
  timestamp: string;
  fromAddress: string;
  toAddress: string;
  amountUtat: string;
  feeUtat: string;
  direction: "sent" | "received";
}

interface TxSearchResponse {
  txs?: Array<{
    body?: {
      messages?: Array<{
        "@type"?: string;
        from_address?: string;
        to_address?: string;
        amount?: Array<{
          denom?: string;
          amount?: string;
        }>;
      }>;
    };
    auth_info?: {
      fee?: {
        amount?: Array<{
          denom?: string;
          amount?: string;
        }>;
      };
    };
  }>;

  tx_responses?: Array<{
    height?: string;
    txhash?: string;
    timestamp?: string;
    code?: number;
  }>;
}

async function searchAddressTransactions(
  address: string,
  event: string,
): Promise<TatCoinAddressTransaction[]> {
  const params = new URLSearchParams();

  params.set(
    "query",
    `${event}='${address}'`,
  );
  params.set("limit", "50");
  params.set("order_by", "ORDER_BY_DESC");

  const response = await fetch(
    `/cosmos/tx/v1beta1/txs?${params.toString()}`,
  );

  if (!response.ok) {
    throw new Error(
      `Failed to load transaction history: HTTP ${response.status}`,
    );
  }

  const data = (await response.json()) as TxSearchResponse;

  const txs = data.txs ?? [];
  const responses = data.tx_responses ?? [];

  return txs.flatMap((tx, index) => {
    const txResponse = responses[index];

    if (!txResponse || txResponse.code !== 0) {
      return [];
    }

    const message = tx.body?.messages?.find(
      (item) =>
        item["@type"] === "/cosmos.bank.v1beta1.MsgSend",
    );

    if (!message) {
      return [];
    }

    const fromAddress = message.from_address ?? "";
    const toAddress = message.to_address ?? "";

    const amountUtat =
      message.amount?.find((coin) => coin.denom === "utat")
        ?.amount ?? "0";

    const feeUtat =
      tx.auth_info?.fee?.amount?.find(
        (coin) => coin.denom === "utat",
      )?.amount ?? "0";

    return [
      {
        hash: txResponse.txhash ?? "",
        height: txResponse.height ?? "",
        timestamp: txResponse.timestamp ?? "",
        fromAddress,
        toAddress,
        amountUtat,
        feeUtat,
        direction:
          fromAddress === address
            ? ("sent" as const)
            : ("received" as const),
      },
    ];
  });
}

export async function getTatCoinAddressTransactions(
  address: string,
): Promise<TatCoinAddressTransaction[]> {
  const normalizedAddress = address.trim();

  if (!/^tat1[a-z0-9]+$/.test(normalizedAddress)) {
    throw new Error("Invalid TatCoin address");
  }

  const [sent, received] = await Promise.all([
    searchAddressTransactions(
      normalizedAddress,
      "message.sender",
    ),
    searchAddressTransactions(
      normalizedAddress,
      "transfer.recipient",
    ),
  ]);

  const uniqueTransactions = new Map<
    string,
    TatCoinAddressTransaction
  >();

  for (const transaction of [...sent, ...received]) {
    if (transaction.hash) {
      uniqueTransactions.set(
        transaction.hash,
        transaction,
      );
    }
  }

  return Array.from(uniqueTransactions.values())
    .sort((a, b) => {
      const aTime = Date.parse(a.timestamp);
      const bTime = Date.parse(b.timestamp);

      if (
        Number.isFinite(aTime) &&
        Number.isFinite(bTime)
      ) {
        return bTime - aTime;
      }

      return Number(b.height) - Number(a.height);
    })
    .slice(0, 20);
}
