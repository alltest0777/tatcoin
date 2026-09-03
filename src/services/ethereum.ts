const ETHEREUM_RPC_URL =
  "https://ethereum-rpc.publicnode.com";

interface EthereumRpcResponse {
  jsonrpc: "2.0";
  id: number;
  result?: unknown;
  error?: {
    code: number;
    message: string;
  };
}

async function ethereumRpc<T = string>(
  method: string,
  params: unknown[] = [],
): Promise<T> {
  const response = await fetch(
    ETHEREUM_RPC_URL,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method,
        params,
      }),
    },
  );

  if (!response.ok) {
    throw new Error(
      `Ethereum RPC error: HTTP ${response.status}`,
    );
  }

  const data =
    (await response.json()) as EthereumRpcResponse;

  if (data.error) {
    throw new Error(
      `Ethereum RPC error: ${data.error.message}`,
    );
  }

  if (data.result === undefined) {
    throw new Error(
      `Ethereum RPC returned no result for ${method}`,
    );
  }

  return data.result as T;
}

function assertEthereumAddress(
  address: string,
  label = "address",
): void {
  if (!/^0x[a-fA-F0-9]{40}$/.test(address)) {
    throw new Error(
      `Invalid Ethereum ${label}`,
    );
  }
}

export async function getEthereumBalance(
  address: string,
): Promise<string> {
  assertEthereumAddress(address);

  const result = await ethereumRpc(
    "eth_getBalance",
    [
      address,
      "latest",
    ],
  );

  return BigInt(result).toString();
}

export function formatEthereumBalance(
  wei: string,
): string {
  const value = BigInt(wei);

  const divisor =
    1_000_000_000_000_000_000n;

  const whole =
    value / divisor;

  const fraction =
    value % divisor;

  return `${whole}.${fraction
    .toString()
    .padStart(18, "0")}`;
}

export interface EthereumFeeData {
  chainId: bigint;
  nonce: bigint;
  gasLimit: bigint;
  baseFeePerGas: bigint;
  maxPriorityFeePerGas: bigint;
  maxFeePerGas: bigint;
}

export async function getEthereumChainId(): Promise<bigint> {
  const result = await ethereumRpc(
    "eth_chainId",
  );

  return BigInt(result);
}

export async function getEthereumNonce(
  address: string,
): Promise<bigint> {
  assertEthereumAddress(
    address,
    "address",
  );

  const result = await ethereumRpc(
    "eth_getTransactionCount",
    [
      address,
      "pending",
    ],
  );

  return BigInt(result);
}

export async function getEthereumGasPrice(): Promise<bigint> {
  const result = await ethereumRpc(
    "eth_gasPrice",
  );

  return BigInt(result);
}

export async function getEthereumPriorityFee(): Promise<bigint> {
  const result = await ethereumRpc(
    "eth_maxPriorityFeePerGas",
  );

  return BigInt(result);
}

interface EthereumBlockResponse {
  baseFeePerGas?: string;
}

export async function getEthereumBaseFee(): Promise<bigint> {
  const block =
    await ethereumRpc<EthereumBlockResponse>(
      "eth_getBlockByNumber",
      [
        "latest",
        false,
      ],
    );

  if (!block.baseFeePerGas) {
    throw new Error(
      "Ethereum RPC returned no base fee",
    );
  }

  return BigInt(block.baseFeePerGas);
}

export interface EthereumEstimateGasParams {
  from: string;
  to: string;
  value?: bigint;
  data?: string;
}

export async function estimateEthereumGas(
  params: EthereumEstimateGasParams,
): Promise<bigint> {
  const {
    from,
    to,
    value,
    data,
  } = params;

  assertEthereumAddress(
    from,
    "sender address",
  );

  assertEthereumAddress(
    to,
    "recipient address",
  );

  const transaction: Record<string, string> = {
    from,
    to,
  };

  if (value !== undefined) {
    transaction.value =
      `0x${value.toString(16)}`;
  }

  if (data !== undefined) {
    transaction.data = data;
  }

  const result = await ethereumRpc(
    "eth_estimateGas",
    [
      transaction,
    ],
  );

  return BigInt(result);
}

export interface EthereumTransactionFeeParams {
  from: string;
  to: string;
  value?: bigint;
  data?: string;
}

export interface EthereumTransactionFee {
  chainId: bigint;
  nonce: bigint;
  gasLimit: bigint;
  baseFeePerGas: bigint;
  maxPriorityFeePerGas: bigint;
  maxFeePerGas: bigint;
  estimatedFee: bigint;
}

export async function getEthereumTransactionFee(
  params: EthereumTransactionFeeParams,
): Promise<EthereumTransactionFee> {
  const {
    from,
    to,
    value,
    data,
  } = params;

  const [
    chainId,
    nonce,
    gasLimit,
    baseFeePerGas,
    maxPriorityFeePerGas,
  ] = await Promise.all([
    getEthereumChainId(),
    getEthereumNonce(from),
    estimateEthereumGas({
      from,
      to,
      value,
      data,
    }),
    getEthereumBaseFee(),
    getEthereumPriorityFee(),
  ]);

  if (chainId !== 1n) {
    throw new Error(
      `Unexpected Ethereum chain ID: ${chainId}`,
    );
  }

  /*
   * EIP-1559:
   *
   * maxFeePerGas = 2 × baseFee + priorityFee
   *
   * Doubling the current base fee gives the transaction
   * room for base-fee increases before it is included.
   */
  const maxFeePerGas =
    baseFeePerGas * 2n +
    maxPriorityFeePerGas;

  /*
   * This is the maximum fee the transaction is allowed
   * to consume, not necessarily the amount actually paid.
   */
  const estimatedFee =
    gasLimit * maxFeePerGas;

  return {
    chainId,
    nonce,
    gasLimit,
    baseFeePerGas,
    maxPriorityFeePerGas,
    maxFeePerGas,
    estimatedFee,
  };
}

export async function broadcastEthereumTransaction(
  rawTxHex: string,
): Promise<string> {
  if (!/^0x[0-9a-fA-F]+$/.test(rawTxHex)) {
    throw new Error(
      "Invalid raw Ethereum transaction",
    );
  }

  const txid =
    await ethereumRpc<string>(
      "eth_sendRawTransaction",
      [rawTxHex],
    );

  if (!/^0x[0-9a-fA-F]{64}$/.test(txid)) {
    throw new Error(
      "Ethereum RPC returned an invalid transaction hash",
    );
  }

  return txid;
}

export interface EthereumTransactionReceipt {
  transactionHash: string;
  blockHash: string;
  blockNumber: string;
  status: string;
  gasUsed: string;
  effectiveGasPrice: string;
  from: string;
  to: string | null;
}

export async function getEthereumTransactionReceipt(
  txid: string,
): Promise<EthereumTransactionReceipt | null> {
  if (!/^0x[0-9a-fA-F]{64}$/.test(txid)) {
    throw new Error(
      "Invalid Ethereum transaction hash",
    );
  }

  return ethereumRpc<EthereumTransactionReceipt | null>(
    "eth_getTransactionReceipt",
    [txid],
  );
}
