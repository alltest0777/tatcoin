function requirePositiveBigInt(value, name) {
  if (typeof value !== "bigint" || value <= 0n) {
    throw new Error(`${name} must be a positive bigint`);
  }
}

// Candidates must already be validated quotes for the same trade.
// buyAmount: output token base units.
// gas: estimated gas units.
// gasPriceWei: one common gas price for both candidates.
// usdtPerEth: USDT base units per 1 ETH, from one common reference rate.
export function selectSwapRoute({
  defaultRoute,
  alternativeRoute,
  buyToken,
  gasPriceWei,
  usdtPerEth,
}) {
  if (buyToken !== "ETH" && buyToken !== "USDT") {
    throw new Error("Unsupported buy token");
  }

  requirePositiveBigInt(gasPriceWei, "gasPriceWei");

  if (buyToken === "USDT") {
    requirePositiveBigInt(usdtPerEth, "usdtPerEth");
  }

  const scale = 10n ** 18n;

  function score(route) {
    if (!route || typeof route !== "object") {
      throw new Error("Missing route");
    }

    requirePositiveBigInt(route.buyAmount, "buyAmount");
    requirePositiveBigInt(route.gas, "gas");

    const networkFeeWei = route.gas * gasPriceWei;

    if (buyToken === "ETH") {
      return route.buyAmount - networkFeeWei;
    }

    // Keep fractional USDT base units during comparison.
    return route.buyAmount * scale - networkFeeWei * usdtPerEth;
  }

  const defaultScore = score(defaultRoute);
  const alternativeScore = score(alternativeRoute);

  // Keep the default route when scores are equal.
  return alternativeScore > defaultScore ? "alternative" : "default";
}
