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
