import test from "node:test";
import assert from "node:assert/strict";
import { selectSwapRoute } from "./swap-route-selection.mjs";

test("ETH: lower output can win through lower gas costs", () => {
  assert.equal(
    selectSwapRoute({
      buyToken: "ETH",
      gasPriceWei: 1_000_000_000n,
      defaultRoute: {
        buyAmount: 400_000_000_000_000n,
        gas: 300_000n,
      },
      alternativeRoute: {
        buyAmount: 390_000_000_000_000n,
        gas: 200_000n,
      },
    }),
    "alternative",
  );
});

test("USDT: compares output and gas using one common ETH rate", () => {
  assert.equal(
    selectSwapRoute({
      buyToken: "USDT",
      gasPriceWei: 1_000_000_000n,
      usdtPerEth: 3_000_000_000n,
      defaultRoute: { buyAmount: 3_000_000n, gas: 900_000n },
      alternativeRoute: { buyAmount: 2_950_000n, gas: 300_000n },
    }),
    "alternative",
  );
});

test("higher output wins when it outweighs extra gas costs", () => {
  assert.equal(
    selectSwapRoute({
      buyToken: "USDT",
      gasPriceWei: 1_000_000_000n,
      usdtPerEth: 3_000_000_000n,
      defaultRoute: { buyAmount: 4_000_000n, gas: 400_000n },
      alternativeRoute: { buyAmount: 3_000_000n, gas: 300_000n },
    }),
    "default",
  );
});

test("equal scores retain the default route", () => {
  assert.equal(
    selectSwapRoute({
      buyToken: "ETH",
      gasPriceWei: 1n,
      defaultRoute: { buyAmount: 100n, gas: 10n },
      alternativeRoute: { buyAmount: 110n, gas: 20n },
    }),
    "default",
  );
});

test("comparison preserves precision above Number.MAX_SAFE_INTEGER", () => {
  assert.equal(
    selectSwapRoute({
      buyToken: "ETH",
      gasPriceWei: 1n,
      defaultRoute: { buyAmount: 10n ** 20n, gas: 10n },
      alternativeRoute: { buyAmount: 10n ** 20n + 1n, gas: 10n },
    }),
    "alternative",
  );
});

test("missing conversion rate and invalid gas are rejected", () => {
  const params = {
    buyToken: "USDT",
    gasPriceWei: 1n,
    defaultRoute: { buyAmount: 100n, gas: 10n },
    alternativeRoute: { buyAmount: 100n, gas: 10n },
  };

  assert.throws(() => selectSwapRoute(params), /usdtPerEth/);

  assert.throws(
    () =>
      selectSwapRoute({
        ...params,
        usdtPerEth: 3_000_000_000n,
        alternativeRoute: { buyAmount: 100n, gas: 0n },
      }),
    /gas must/,
  );
});
