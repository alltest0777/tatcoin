import {
  estimateEthereumGas,
  getEthereumBaseFee,
  getEthereumChainId,
  getEthereumNonce,
  getEthereumPriorityFee,
} from "./ethereum";

const ETHEREUM_RPC_URL = "https://ethereum-rpc.publicnode.com";

export const USDT_CONTRACT_ADDRESS =
  "0xdAC17F958D2ee523a2206206994597C13D831ec7";

export const USDT_DECIMALS = 6;

interface EthereumRpcResponse<T> {
  jsonrpc: string;
  id: number;
  result?: T;
  error?: {
    code: number;
    message: string;
  };
}

async function ethereumRpc<T>(method: string, params: unknown[]): Promise<T> {
  const response = await fetch(ETHEREUM_RPC_URL, {
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
  });

  if (!response.ok) {
    throw new Error(`Ethereum RPC HTTP error: ${response.status}`);
  }

  const data = (await response.json()) as EthereumRpcResponse<T>;

  if (data.error) {
    throw new Error(
      `Ethereum RPC error ${data.error.code}: ${data.error.message}`,
    );
  }

  if (data.result === undefined) {
    throw new Error("Ethereum RPC returned no result");
  }

  return data.result;
}

function assertEthereumAddress(address: string): void {
  if (!/^0x[0-9a-fA-F]{40}$/.test(address)) {
    throw new Error("Invalid Ethereum address");
  }
}

function encodeBalanceOf(address: string): string {
  assertEthereumAddress(address);

  // balanceOf(address)
  // keccak256("balanceOf(address)") first 4 bytes:
  // 70a08231
  const selector = "70a08231";

  const encodedAddress = address.slice(2).toLowerCase().padStart(64, "0");

  return `0x${selector}${encodedAddress}`;
}

export async function getUsdtBalance(address: string): Promise<bigint> {
  assertEthereumAddress(address);

  const result = await ethereumRpc<string>("eth_call", [
    {
      to: USDT_CONTRACT_ADDRESS,
      data: encodeBalanceOf(address),
    },
    "latest",
  ]);

  if (!/^0x[0-9a-fA-F]+$/.test(result)) {
    throw new Error("Ethereum RPC returned an invalid USDT balance");
  }

  return BigInt(result);
}

export function formatUsdtBalance(balance: bigint): string {
  const divisor = 10n ** BigInt(USDT_DECIMALS);

  const whole = balance / divisor;
  const fraction = balance % divisor;

  return `${whole}.${fraction.toString().padStart(USDT_DECIMALS, "0")}`;
}

export function parseUsdtAmount(amount: string): bigint {
  const value = amount.trim();

  if (!/^\d+(\.\d{1,6})?$/.test(value)) {
    throw new Error("Invalid USDT amount. Maximum 6 decimal places.");
  }

  const [whole, fraction = ""] = value.split(".");

  const units =
    BigInt(whole) * 10n ** BigInt(USDT_DECIMALS) +
    BigInt(fraction.padEnd(USDT_DECIMALS, "0"));

  if (units <= 0n) {
    throw new Error("USDT amount must be greater than zero");
  }

  return units;
}

export function encodeUsdtTransfer(recipient: string, amount: bigint): string {
  assertEthereumAddress(recipient);

  if (amount <= 0n) {
    throw new Error("USDT transfer amount must be greater than zero");
  }

  // transfer(address,uint256)
  // keccak256("transfer(address,uint256)") first 4 bytes:
  // a9059cbb
  const selector = "a9059cbb";

  const encodedRecipient = recipient.slice(2).toLowerCase().padStart(64, "0");

  const encodedAmount = amount.toString(16).padStart(64, "0");

  return `0x${selector}${encodedRecipient}${encodedAmount}`;
}

export async function estimateUsdtTransferGas(
  from: string,
  recipient: string,
  amount: bigint,
): Promise<bigint> {
  assertEthereumAddress(from);
  assertEthereumAddress(recipient);

  const data = encodeUsdtTransfer(recipient, amount);

  return estimateEthereumGas({
    from,
    to: USDT_CONTRACT_ADDRESS,
    value: 0n,
    data,
  });
}

export interface UsdtTransferFeeQuote {
  chainId: bigint;
  nonce: bigint;
  gasLimit: bigint;
  baseFeePerGas: bigint;
  maxPriorityFeePerGas: bigint;
  maxFeePerGas: bigint;
  maximumNetworkFee: bigint;
}

export async function getUsdtTransferFeeQuote(
  from: string,
  recipient: string,
  amount: bigint,
): Promise<UsdtTransferFeeQuote> {
  assertEthereumAddress(from);
  assertEthereumAddress(recipient);

  const [chainId, nonce, gasLimit, baseFeePerGas, maxPriorityFeePerGas] =
    await Promise.all([
      getEthereumChainId(),
      getEthereumNonce(from),
      estimateUsdtTransferGas(from, recipient, amount),
      getEthereumBaseFee(),
      getEthereumPriorityFee(),
    ]);

  if (chainId !== 1n) {
    throw new Error(`Unexpected Ethereum chain ID: ${chainId.toString()}`);
  }

  const maxFeePerGas = baseFeePerGas * 2n + maxPriorityFeePerGas;

  const maximumNetworkFee = gasLimit * maxFeePerGas;

  return {
    chainId,
    nonce,
    gasLimit,
    baseFeePerGas,
    maxPriorityFeePerGas,
    maxFeePerGas,
    maximumNetworkFee,
  };
}
