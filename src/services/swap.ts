import {
  getEthereumTransactionFee,
  type EthereumTransactionFee,
} from "./ethereum";
import { USDT_CONTRACT_ADDRESS } from "./usdt";

export const ZEROX_ALLOWANCE_HOLDER =
  "0x0000000000001fF3684f28c67538d4D072C22734";

export type SwapToken = "ETH" | "USDT";

const SWAP_API_URL = "/api/swap";

export const SWAP_TOKEN_DECIMALS: Record<SwapToken, number> = {
  ETH: 18,
  USDT: 6,
};

export const SWAP_TOKEN_ADDRESSES: Record<SwapToken, string> = {
  ETH: "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE",
  USDT: USDT_CONTRACT_ADDRESS,
};

interface SwapFee {
  amount: string;
  token: string;
  type: string;
}

interface SwapIssues {
  allowance: {
    actual: string;
    spender: string;
  } | null;
  balance: {
    token: string;
    actual: string;
    expected: string;
  } | null;
  simulationIncomplete: boolean;
}

export interface SwapPrice {
  liquidityAvailable: boolean;
  buyAmount: string;
  minBuyAmount: string;
  gas: string;
  blockNumber?: string;
  fees: {
    integratorFee: SwapFee | null;
    zeroExFee: SwapFee | null;
    gasFee: SwapFee | null;
  };
  issues: SwapIssues;
}

export function parseSwapAmount(value: string, token: SwapToken): bigint {
  const normalized = value.trim().replace(",", ".");
  const decimals = SWAP_TOKEN_DECIMALS[token];

  if (!/^\d+(\.\d+)?$/.test(normalized)) {
    throw new Error(`Invalid ${token} amount`);
  }

  const [whole, fraction = ""] = normalized.split(".");

  if (fraction.length > decimals) {
    throw new Error(
      `${token} supports a maximum of ${decimals} decimal places`,
    );
  }

  const amount =
    BigInt(whole) * 10n ** BigInt(decimals) +
    BigInt(fraction.padEnd(decimals, "0"));

  if (amount <= 0n) {
    throw new Error("Swap amount must be greater than zero");
  }

  return amount;
}

export function formatSwapAmount(
  value: string | bigint,
  token: SwapToken,
): string {
  const amount = BigInt(value);
  const decimals = SWAP_TOKEN_DECIMALS[token];
  const divisor = 10n ** BigInt(decimals);
  const whole = amount / divisor;
  const fraction = amount % divisor;

  const trimmedFraction = fraction
    .toString()
    .padStart(decimals, "0")
    .replace(/0+$/, "");

  return trimmedFraction ? `${whole}.${trimmedFraction}` : whole.toString();
}

export async function getSwapPrice(params: {
  sellToken: SwapToken;
  buyToken: SwapToken;
  sellAmount: bigint;
  taker: string;
}): Promise<SwapPrice> {
  const { sellToken, buyToken, sellAmount, taker } = params;

  if (sellToken === buyToken) {
    throw new Error("Sell and buy tokens must be different");
  }

  if (!/^0x[a-fA-F0-9]{40}$/.test(taker)) {
    throw new Error("Invalid Ethereum taker address");
  }

  if (sellAmount <= 0n) {
    throw new Error("Swap amount must be greater than zero");
  }

  const query = new URLSearchParams({
    sellToken,
    buyToken,
    sellAmount: sellAmount.toString(),
    taker,
  });

  const response = await fetch(`${SWAP_API_URL}/price?${query.toString()}`, {
    method: "GET",
    headers: {
      Accept: "application/json",
    },
  });

  const body = (await response.json()) as SwapPrice & {
    error?: string;
  };

  if (!response.ok) {
    throw new Error(body.error ?? `Swap quote failed: HTTP ${response.status}`);
  }

  if (
    typeof body.liquidityAvailable !== "boolean" ||
    !/^\d+$/.test(body.buyAmount) ||
    !/^\d+$/.test(body.minBuyAmount) ||
    !/^\d+$/.test(body.gas)
  ) {
    throw new Error("Swap provider returned an invalid response");
  }

  return body;
}

export interface SwapQuote {
  liquidityAvailable: boolean;
  sellToken: string;
  buyToken: string;
  sellAmount: string;
  buyAmount: string;
  minBuyAmount: string;
  blockNumber?: string;
  fees: {
    integratorFee: SwapFee | null;
    zeroExFee: SwapFee | null;
    gasFee: SwapFee | null;
  };
  issues: SwapIssues;
  allowanceTarget: string;
  transaction: {
    to: string;
    data: string;
    value: string;
    gas: string;
    gasPrice: string;
  };
}

export async function getSwapQuote(params: {
  sellToken: SwapToken;
  buyToken: SwapToken;
  sellAmount: bigint;
  taker: string;
}): Promise<SwapQuote> {
  const { sellToken, buyToken, sellAmount, taker } = params;

  if (sellToken === buyToken) {
    throw new Error("Sell and buy tokens must be different");
  }

  if (!/^0x[a-fA-F0-9]{40}$/.test(taker)) {
    throw new Error("Invalid Ethereum taker address");
  }

  if (sellAmount <= 0n) {
    throw new Error("Swap amount must be greater than zero");
  }

  const query = new URLSearchParams({
    sellToken,
    buyToken,
    sellAmount: sellAmount.toString(),
    taker,
  });

  const response = await fetch(`${SWAP_API_URL}/quote?${query.toString()}`, {
    method: "GET",
    headers: {
      Accept: "application/json",
    },
  });

  const body = (await response.json()) as SwapQuote & {
    error?: string;
  };

  if (!response.ok) {
    throw new Error(
      body.error ?? `Final swap quote failed: HTTP ${response.status}`,
    );
  }

  if (
    typeof body.liquidityAvailable !== "boolean" ||
    !/^\d+$/.test(body.buyAmount) ||
    !/^\d+$/.test(body.minBuyAmount) ||
    !/^0x[a-fA-F0-9]{40}$/.test(body.allowanceTarget) ||
    body.allowanceTarget.toLowerCase() !==
      ZEROX_ALLOWANCE_HOLDER.toLowerCase() ||
    !/^0x[a-fA-F0-9]{40}$/.test(body.transaction?.to) ||
    !/^0x(?:[a-fA-F0-9]{2})+$/.test(body.transaction?.data) ||
    !/^\d+$/.test(body.transaction?.value) ||
    !/^\d+$/.test(body.transaction?.gas) ||
    !/^\d+$/.test(body.transaction?.gasPrice)
  ) {
    throw new Error("Swap provider returned an invalid final quote");
  }

  return body;
}

export interface SwapExecutionPlan {
  quote: SwapQuote;
  fee: EthereumTransactionFee;
  preparedAt: number;
}

export async function prepareSwapExecution(params: {
  sellToken: SwapToken;
  buyToken: SwapToken;
  sellAmount: bigint;
  taker: string;
}): Promise<SwapExecutionPlan> {
  const { sellToken, buyToken, sellAmount, taker } = params;

  const quote = await getSwapQuote(params);

  if (!quote.liquidityAvailable) {
    throw new Error("No swap liquidity is currently available");
  }

  if (
    quote.sellToken.toLowerCase() !==
      SWAP_TOKEN_ADDRESSES[sellToken].toLowerCase() ||
    quote.buyToken.toLowerCase() !==
      SWAP_TOKEN_ADDRESSES[buyToken].toLowerCase() ||
    quote.sellAmount !== sellAmount.toString()
  ) {
    throw new Error("Swap quote does not match the requested trade");
  }

  if (quote.issues.balance !== null) {
    throw new Error("Insufficient token balance for this swap");
  }

  if (quote.issues.allowance !== null) {
    throw new Error("Token approval is required before this swap");
  }

  if (quote.issues.simulationIncomplete) {
    throw new Error("Swap provider simulation is incomplete");
  }

  const transactionValue = BigInt(quote.transaction.value);
  const expectedValue = sellToken === "ETH" ? sellAmount : 0n;

  if (transactionValue !== expectedValue) {
    throw new Error("Swap transaction contains an unexpected ETH value");
  }

  if (
    sellToken === "USDT" &&
    (quote.allowanceTarget.toLowerCase() !==
      ZEROX_ALLOWANCE_HOLDER.toLowerCase() ||
      quote.transaction.to.toLowerCase() !==
        ZEROX_ALLOWANCE_HOLDER.toLowerCase())
  ) {
    throw new Error("Swap transaction contains an unexpected target");
  }

  const fee = await getEthereumTransactionFee({
    from: taker,
    to: quote.transaction.to,
    value: transactionValue,
    data: quote.transaction.data,
  });

  return {
    quote,
    fee,
    preparedAt: Date.now(),
  };
}

export function encodeUsdtApproval(amount: bigint): string {
  if (amount <= 0n) {
    throw new Error("USDT approval amount must be greater than zero");
  }

  // approve(address,uint256)
  // keccak256("approve(address,uint256)") first 4 bytes:
  // 095ea7b3
  const selector = "095ea7b3";

  const encodedSpender = ZEROX_ALLOWANCE_HOLDER.slice(2)
    .toLowerCase()
    .padStart(64, "0");

  const encodedAmount = amount.toString(16).padStart(64, "0");

  return `0x${selector}${encodedSpender}${encodedAmount}`;
}

export async function getUsdtApprovalFeeQuote(
  from: string,
  amount: bigint,
): Promise<EthereumTransactionFee> {
  const data = encodeUsdtApproval(amount);

  return getEthereumTransactionFee({
    from,
    to: USDT_CONTRACT_ADDRESS,
    value: 0n,
    data,
  });
}
