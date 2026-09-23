import test from "node:test";
import assert from "node:assert/strict";
import { fetchComparedSwapRoute } from "./swap-route-provider.mjs";

const USDT = "0xdac17f958d2ee523a2206206994597c13d831ec7";
const ETH = "0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee";

function baselineQuote() {
  return {
    liquidityAvailable: true,
    sellToken: USDT,
    buyToken: ETH,
    sellAmount: "1000000",
    buyAmount: "350000000000000",
    minBuyAmount: "346500000000000",
    gas: "300000",
    totalNetworkFee: "30000000000000",
    fees: {
      integratorFee: {
        amount: "2500",
        token: USDT,
        type: "volume",
      },
      zeroExFee: {
        amount: "1500",
        token: USDT,
        type: "volume",
      },
    },
    issues: {
      allowance: null,
      balance: null,
      simulationIncomplete: false,
      invalidSourcesPassed: [],
    },
  };
}

function runComparison() {
  return fetchComparedSwapRoute({
    providerUrl: new URL("https://api.0x.org/swap/allowance-holder/price"),
    headers: {},
    signal: AbortSignal.timeout(1000),
    validation: {
      sellSymbol: "USDT",
      buySymbol: "ETH",
      sellAmount: "1000000",
      providerMethod: "price",
    },
  });
}

test("alternative request failure preserves the baseline", async (t) => {
  const baseline = baselineQuote();
  let calls = 0;

  t.mock.method(globalThis, "fetch", async () => {
    calls += 1;

    if (calls === 1) return Response.json(baseline);
    if (calls === 2) {
      return Response.json({ sources: ["Uniswap_V3", "Curve"] });
    }

    throw new Error("Simulated provider failure");
  });

  const result = await runComparison();

  assert.equal(calls, 3);
  assert.equal(result.response.status, 200);
  assert.deepEqual(result.body, baseline);
});

test("mismatched alternative sell amount preserves the baseline", async (t) => {
  const baseline = baselineQuote();
  let calls = 0;

  t.mock.method(globalThis, "fetch", async () => {
    calls += 1;

    if (calls === 1) return Response.json(baseline);
    if (calls === 2) {
      return Response.json({ sources: ["Uniswap_V3", "Curve"] });
    }

    return Response.json({
      ...baseline,
      sellAmount: "2000000",
    });
  });

  const result = await runComparison();

  assert.equal(calls, 3);
  assert.deepEqual(result.body, baseline);
});

test("valid alternative wins when its net ETH output is higher", async (t) => {
  const baseline = baselineQuote();
  const alternative = {
    ...baseline,
    buyAmount: "345000000000000",
    minBuyAmount: "341550000000000",
    gas: "200000",
    totalNetworkFee: "20000000000000",
    route: {
      fills: [{ source: "Uniswap_V3" }],
    },
  };
  let calls = 0;

  t.mock.method(globalThis, "fetch", async (url) => {
    calls += 1;

    if (calls === 1) return Response.json(baseline);
    if (calls === 2) {
      return Response.json({ sources: ["Uniswap_V3", "Curve"] });
    }

    assert.equal(new URL(url).searchParams.get("excludedSources"), "Curve");
    return Response.json(alternative);
  });

  const result = await runComparison();

  assert.equal(calls, 3);
  assert.deepEqual(result.body, alternative);
});

const HOLDER = "0x0000000000001ff3684f28c67538d4d072c22734";

function executableQuote(gas, buyAmount, data) {
  return {
    ...baselineQuote(),
    buyAmount,
    minBuyAmount: ((BigInt(buyAmount) * 99n) / 100n).toString(),
    allowanceTarget: HOLDER,
    totalNetworkFee: (BigInt(gas) * 100_000_000n).toString(),
    transaction: {
      to: HOLDER,
      value: "0",
      data,
      gas,
      gasPrice: "100000000",
    },
    route: {
      fills: [{ source: "Uniswap_V3" }],
    },
  };
}

function runQuoteComparison() {
  return fetchComparedSwapRoute({
    providerUrl: new URL("https://api.0x.org/swap/allowance-holder/quote"),
    headers: {},
    signal: AbortSignal.timeout(1000),
    validation: {
      sellSymbol: "USDT",
      buySymbol: "ETH",
      sellAmount: "1000000",
      providerMethod: "quote",
    },
  });
}

test("quote: selects the complete alternative transaction", async (t) => {
  const baseline = executableQuote("300000", "350000000000000", "0x1234");
  const alternative = executableQuote("200000", "345000000000000", "0xabcd");
  let calls = 0;

  t.mock.method(globalThis, "fetch", async () => {
    calls += 1;
    if (calls === 1) return Response.json(baseline);
    if (calls === 2) {
      return Response.json({ sources: ["Uniswap_V3", "Curve"] });
    }
    return Response.json(alternative);
  });

  const result = await runQuoteComparison();

  assert.equal(calls, 3);
  assert.deepEqual(result.body, alternative);
  assert.equal(result.body.transaction.data, "0xabcd");
});

test("quote: unexpected alternative target preserves baseline", async (t) => {
  const baseline = executableQuote("300000", "350000000000000", "0x1234");
  const alternative = executableQuote("200000", "345000000000000", "0xabcd");
  alternative.transaction.to = "0x1111111111111111111111111111111111111111";
  let calls = 0;

  t.mock.method(globalThis, "fetch", async () => {
    calls += 1;
    if (calls === 1) return Response.json(baseline);
    if (calls === 2) {
      return Response.json({ sources: ["Uniswap_V3", "Curve"] });
    }
    return Response.json(alternative);
  });

  const result = await runQuoteComparison();

  assert.equal(calls, 3);
  assert.deepEqual(result.body, baseline);
});

function ethToUsdtQuote(gas, buyAmount, integratorAmount, providerAmount) {
  return {
    ...baselineQuote(),
    sellToken: ETH,
    buyToken: USDT,
    sellAmount: "1000000000000000",
    buyAmount,
    minBuyAmount: ((BigInt(buyAmount) * 99n) / 100n).toString(),
    allowanceTarget: HOLDER,
    totalNetworkFee: (BigInt(gas) * 1_000_000_000n).toString(),
    fees: {
      integratorFee: {
        amount: integratorAmount,
        token: USDT,
        type: "volume",
      },
      zeroExFee: {
        amount: providerAmount,
        token: USDT,
        type: "volume",
      },
    },
    transaction: {
      to: HOLDER,
      value: "1000000000000000",
      data: "0x1234",
      gas,
      gasPrice: "1000000000",
    },
    route: {
      fills: [{ source: "Uniswap_V3" }],
    },
  };
}

function runEthToUsdtComparison() {
  return fetchComparedSwapRoute({
    providerUrl: new URL("https://api.0x.org/swap/allowance-holder/quote"),
    headers: {},
    signal: AbortSignal.timeout(1000),
    validation: {
      sellSymbol: "ETH",
      buySymbol: "USDT",
      sellAmount: "1000000000000000",
      providerMethod: "quote",
    },
  });
}

test("ETH to USDT: lower gas wins despite lower output and different fees", async (t) => {
  const baseline = ethToUsdtQuote("900000", "3000000", "7530", "4518");
  const alternative = ethToUsdtQuote("300000", "2950000", "7404", "4442");
  let calls = 0;

  t.mock.method(globalThis, "fetch", async () => {
    calls += 1;
    if (calls === 1) return Response.json(baseline);
    if (calls === 2) {
      return Response.json({ sources: ["Uniswap_V3", "Curve"] });
    }
    return Response.json(alternative);
  });

  const result = await runEthToUsdtComparison();

  assert.equal(calls, 3);
  assert.deepEqual(result.body, alternative);
});

test("ETH to USDT: higher output can outweigh extra gas", async (t) => {
  const baseline = ethToUsdtQuote("400000", "3000000", "7530", "4518");
  const alternative = ethToUsdtQuote("300000", "2500000", "6275", "3765");
  let calls = 0;

  t.mock.method(globalThis, "fetch", async () => {
    calls += 1;
    if (calls === 1) return Response.json(baseline);
    if (calls === 2) {
      return Response.json({ sources: ["Uniswap_V3", "Curve"] });
    }
    return Response.json(alternative);
  });

  const result = await runEthToUsdtComparison();

  assert.equal(calls, 3);
  assert.deepEqual(result.body, baseline);
});

test("ETH to USDT: wrong alternative ETH value preserves baseline", async (t) => {
  const baseline = ethToUsdtQuote("900000", "3000000", "7530", "4518");
  const alternative = ethToUsdtQuote("300000", "2950000", "7404", "4442");
  alternative.transaction.value = "2000000000000000";
  let calls = 0;

  t.mock.method(globalThis, "fetch", async () => {
    calls += 1;
    if (calls === 1) return Response.json(baseline);
    if (calls === 2) {
      return Response.json({ sources: ["Uniswap_V3", "Curve"] });
    }
    return Response.json(alternative);
  });

  const result = await runEthToUsdtComparison();

  assert.equal(calls, 3);
  assert.deepEqual(result.body, baseline);
});
