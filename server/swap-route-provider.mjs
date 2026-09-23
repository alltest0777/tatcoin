import { selectSwapRoute } from "./swap-route-selection.mjs";
import { validateSwapQuote } from "./swap-quote-validation.mjs";

export async function fetchComparedSwapRoute({
  providerUrl,
  headers,
  signal,
  validation,
}) {
  async function load(url) {
    const response = await fetch(url, { headers, signal });
    const body = await response.json();
    return { response, body };
  }

  const baseline = await load(providerUrl);

  if (!baseline.response.ok) return baseline;

  validateSwapQuote(baseline.body, validation);

  function isEligible(body) {
    return (
      body.liquidityAvailable === true &&
      body.issues.balance === null &&
      body.issues.simulationIncomplete === false &&
      (validation.providerMethod === "price" || body.issues.allowance === null)
    );
  }

  if (!isEligible(baseline.body)) return baseline;

  try {
    const listing = await load("https://api.0x.org/sources?chainId=1");
    const sources = listing.body?.sources;

    if (
      !listing.response.ok ||
      !Array.isArray(sources) ||
      !sources.every(
        (source) =>
          typeof source === "string" && /^[A-Za-z0-9_]+$/.test(source),
      ) ||
      !sources.includes("Uniswap_V3")
    ) {
      return baseline;
    }

    const alternativeUrl = new URL(providerUrl);
    const excluded = sources.filter((source) => source !== "Uniswap_V3");

    if (excluded.length > 0) {
      alternativeUrl.searchParams.set("excludedSources", excluded.join(","));
    }

    const alternative = await load(alternativeUrl);

    if (!alternative.response.ok) return baseline;

    validateSwapQuote(alternative.body, validation);

    if (!isEligible(alternative.body)) return baseline;

    const fills = alternative.body.route?.fills;

    if (
      !Array.isArray(fills) ||
      fills.length === 0 ||
      !fills.every((fill) => fill?.source === "Uniswap_V3")
    ) {
      return baseline;
    }

    // Compare fee presence, token and type.
    // Require equal amounts only when selling a fixed USDT amount.
    function feeKey(fee) {
      if (fee === null) return "none";

      if (
        !fee ||
        typeof fee.amount !== "string" ||
        !/^\d+$/.test(fee.amount) ||
        typeof fee.token !== "string" ||
        fee.type !== "volume"
      ) {
        throw new Error("Invalid fee data");
      }

      const token = fee.token.toLowerCase();

      if (
        validation.sellSymbol === "ETH" &&
        token !== "0xdac17f958d2ee523a2206206994597c13d831ec7"
      ) {
        throw new Error("Expected swap fees in USDT");
      }

      // USDT input is fixed: require equal fee amounts.
      // USDT output varies: require matching token and fee type.
      return validation.sellSymbol === "USDT"
        ? `${token}:${BigInt(fee.amount)}:${fee.type}`
        : `${token}:${fee.type}`;
    }

    for (const name of ["integratorFee", "zeroExFee"]) {
      if (
        feeKey(baseline.body.fees?.[name]) !==
        feeKey(alternative.body.fees?.[name])
      ) {
        return baseline;
      }
    }

    function positiveInteger(value) {
      if (typeof value !== "string" || !/^[1-9][0-9]*$/.test(value)) {
        throw new Error("Missing route cost estimate");
      }
      return BigInt(value);
    }

    function costs(body) {
      const gas = positiveInteger(
        validation.providerMethod === "quote" ? body.transaction.gas : body.gas,
      );

      const networkFee = positiveInteger(body.totalNetworkFee);

      // Derive an estimated per-gas price, rounded upward.
      const gasPrice = (networkFee + gas - 1n) / gas;

      return { gas, gasPrice };
    }

    const first = costs(baseline.body);
    const second = costs(alternative.body);
    const commonGasPrice =
      first.gasPrice > second.gasPrice ? first.gasPrice : second.gasPrice;

    let usdtPerEth;

    if (validation.buySymbol === "USDT") {
      const sellWei = positiveInteger(baseline.body.sellAmount);
      const buyUsdtUnits = positiveInteger(baseline.body.buyAmount);

      // Common effective reference rate from the baseline quote.
      // USDT base units per 1 ETH, rounded upward.
      usdtPerEth = (buyUsdtUnits * 10n ** 18n + sellWei - 1n) / sellWei;
    }

    const selected = selectSwapRoute({
      buyToken: validation.buySymbol,
      usdtPerEth,
      gasPriceWei: commonGasPrice,
      defaultRoute: {
        buyAmount: BigInt(baseline.body.buyAmount),
        gas: first.gas,
      },
      alternativeRoute: {
        buyAmount: BigInt(alternative.body.buyAmount),
        gas: second.gas,
      },
    });

    console.info("[swap-route]", {
      selected,
      commonGasPriceWei: commonGasPrice.toString(),
      defaultBuyAmount: baseline.body.buyAmount,
      defaultGas: first.gas.toString(),
      alternativeBuyAmount: alternative.body.buyAmount,
      alternativeGas: second.gas.toString(),
      buyToken: validation.buySymbol,
      referenceUsdtPerEth: usdtPerEth?.toString() ?? null,
    });

    return selected === "alternative" ? alternative : baseline;
  } catch {
    console.warn("[swap-route] comparison failed; using baseline");
    return baseline;
  }
}
