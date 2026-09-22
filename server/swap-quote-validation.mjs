const ALLOWANCE_HOLDER = "0x0000000000001ff3684f28c67538d4d072c22734";

const TOKENS = {
  ETH: "0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee",
  USDT: "0xdac17f958d2ee523a2206206994597c13d831ec7",
};

function isAddress(value) {
  return typeof value === "string" && /^0x[a-fA-F0-9]{40}$/.test(value);
}

function isUint(value) {
  return typeof value === "string" && /^\d+$/.test(value);
}

function isPositiveUint(value) {
  return isUint(value) && BigInt(value) > 0n;
}

export function validateSwapQuote(
  body,
  { sellSymbol, buySymbol, sellAmount, providerMethod },
) {
  if (
    !Object.hasOwn(TOKENS, sellSymbol) ||
    !Object.hasOwn(TOKENS, buySymbol) ||
    sellSymbol === buySymbol ||
    !["price", "quote"].includes(providerMethod)
  ) {
    throw new Error("Invalid quote validation parameters");
  }

  if (!body || typeof body.liquidityAvailable !== "boolean") {
    throw new Error("Invalid liquidity response");
  }

  if (!body.liquidityAvailable) return;

  if (
    typeof body.sellToken !== "string" ||
    body.sellToken.toLowerCase() !== TOKENS[sellSymbol] ||
    typeof body.buyToken !== "string" ||
    body.buyToken.toLowerCase() !== TOKENS[buySymbol] ||
    body.sellAmount !== sellAmount ||
    !isPositiveUint(body.buyAmount) ||
    !isUint(body.minBuyAmount) ||
    BigInt(body.minBuyAmount) > BigInt(body.buyAmount)
  ) {
    throw new Error("Mismatched tokens or invalid quote amounts");
  }

  const issues = body.issues;

  if (
    !issues ||
    typeof issues.simulationIncomplete !== "boolean" ||
    !Array.isArray(issues.invalidSourcesPassed) ||
    issues.invalidSourcesPassed.length > 0
  ) {
    throw new Error("Invalid quote issues or unsupported liquidity sources");
  }

  if (
    issues.allowance !== null &&
    (!issues.allowance ||
      !isUint(issues.allowance.actual) ||
      !isAddress(issues.allowance.spender) ||
      issues.allowance.spender.toLowerCase() !== ALLOWANCE_HOLDER)
  ) {
    throw new Error("Unexpected allowance data");
  }

  if (
    issues.balance !== null &&
    (!issues.balance ||
      !isAddress(issues.balance.token) ||
      !isUint(issues.balance.actual) ||
      !isUint(issues.balance.expected))
  ) {
    throw new Error("Invalid balance issue");
  }

  if (
    body.allowanceTarget != null &&
    (!isAddress(body.allowanceTarget) ||
      body.allowanceTarget.toLowerCase() !== ALLOWANCE_HOLDER)
  ) {
    throw new Error("Unexpected allowance target");
  }

  if (providerMethod === "price") {
    if (!isPositiveUint(body.gas)) {
      throw new Error("Invalid price gas estimate");
    }
    return;
  }

  const tx = body.transaction;
  const expectedValue = sellSymbol === "ETH" ? sellAmount : "0";

  if (
    !tx ||
    !isAddress(tx.to) ||
    typeof tx.data !== "string" ||
    !/^0x(?:[a-fA-F0-9]{2})+$/.test(tx.data) ||
    tx.value !== expectedValue ||
    !isPositiveUint(tx.gas) ||
    !isPositiveUint(tx.gasPrice)
  ) {
    throw new Error("Invalid swap transaction");
  }

  if (sellSymbol === "USDT" && tx.to.toLowerCase() !== ALLOWANCE_HOLDER) {
    throw new Error("Unexpected USDT transaction target");
  }
}
