import http from "node:http";

const HOST = "127.0.0.1";
const PORT = Number(process.env.SWAP_PROXY_PORT ?? "8787");
const ZEROX_API_KEY = process.env.ZEROX_API_KEY?.trim();
const ZEROX_ALLOWANCE_HOLDER = "0x0000000000001ff3684f28c67538d4d072c22734";

const TOKENS = {
  ETH: "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE",
  USDT: "0xdAC17F958D2ee523a2206206994597C13D831ec7",
};

function sendJson(response, status, body) {
  response.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
  });

  response.end(JSON.stringify(body));
}

function isEthereumAddress(value) {
  return /^0x[a-fA-F0-9]{40}$/.test(value);
}

const server = http.createServer(async (request, response) => {
  const url = new URL(request.url ?? "/", "http://localhost");

  if (request.method === "GET" && url.pathname === "/health") {
    sendJson(response, 200, {
      status: "ok",
      provider: "0x",
      apiKeyConfigured: Boolean(ZEROX_API_KEY),
    });
    return;
  }

  const providerMethod =
    url.pathname === "/price"
      ? "price"
      : url.pathname === "/quote"
        ? "quote"
        : null;

  if (request.method !== "GET" || !providerMethod) {
    sendJson(response, 404, { error: "Not found" });
    return;
  }

  if (!ZEROX_API_KEY) {
    sendJson(response, 503, { error: "Swap provider is not configured" });
    return;
  }

  const sellSymbol = url.searchParams.get("sellToken")?.toUpperCase();
  const buySymbol = url.searchParams.get("buyToken")?.toUpperCase();
  const sellAmount = url.searchParams.get("sellAmount");
  const taker = url.searchParams.get("taker");

  if (
    !sellSymbol ||
    !buySymbol ||
    !(sellSymbol in TOKENS) ||
    !(buySymbol in TOKENS) ||
    sellSymbol === buySymbol
  ) {
    sendJson(response, 400, {
      error: "Only ETH/USDT swap pairs are supported",
    });
    return;
  }

  if (!sellAmount || !/^[1-9][0-9]*$/.test(sellAmount)) {
    sendJson(response, 400, {
      error: "sellAmount must be a positive integer in base units",
    });
    return;
  }

  if (!taker || !isEthereumAddress(taker)) {
    sendJson(response, 400, {
      error: "Invalid Ethereum taker address",
    });
    return;
  }

  const providerUrl = new URL(
    `https://api.0x.org/swap/allowance-holder/${providerMethod}`,
  );

  providerUrl.searchParams.set("chainId", "1");
  providerUrl.searchParams.set("sellToken", TOKENS[sellSymbol]);
  providerUrl.searchParams.set("buyToken", TOKENS[buySymbol]);
  providerUrl.searchParams.set("sellAmount", sellAmount);
  providerUrl.searchParams.set("taker", taker);
  providerUrl.searchParams.set("slippageBps", "100");

  try {
    const providerResponse = await fetch(providerUrl, {
      headers: {
        "0x-api-key": ZEROX_API_KEY,
        "0x-version": "v2",
      },
      signal: AbortSignal.timeout(10_000),
    });

    const body = await providerResponse.json();

    const allowanceSpender = body?.issues?.allowance?.spender;
    const allowanceTarget = body?.allowanceTarget;

    if (
      (allowanceSpender !== null &&
        allowanceSpender !== undefined &&
        (typeof allowanceSpender !== "string" ||
          allowanceSpender.toLowerCase() !== ZEROX_ALLOWANCE_HOLDER)) ||
      (allowanceTarget !== null &&
        allowanceTarget !== undefined &&
        (typeof allowanceTarget !== "string" ||
          allowanceTarget.toLowerCase() !== ZEROX_ALLOWANCE_HOLDER))
    ) {
      sendJson(response, 502, {
        error: "Swap provider returned an unexpected allowance target",
      });
      return;
    }

    if (!providerResponse.ok) {
      sendJson(response, providerResponse.status, {
        error: "Swap provider rejected the request",
        provider: body,
      });
      return;
    }

    const expectedSellToken = TOKENS[sellSymbol].toLowerCase();
    const expectedBuyToken = TOKENS[buySymbol].toLowerCase();

    if (
      body.liquidityAvailable === true &&
      (typeof body.sellToken !== "string" ||
        body.sellToken.toLowerCase() !== expectedSellToken ||
        typeof body.buyToken !== "string" ||
        body.buyToken.toLowerCase() !== expectedBuyToken ||
        body.sellAmount !== sellAmount)
    ) {
      sendJson(response, 502, {
        error: "Swap provider returned mismatched token or amount data",
      });
      return;
    }

    if (providerMethod === "quote" && body.liquidityAvailable === true) {
      const transaction = body.transaction;
      const expectedValue = sellSymbol === "ETH" ? sellAmount : "0";

      const transactionIsInvalid =
        !transaction ||
        typeof transaction.to !== "string" ||
        !isEthereumAddress(transaction.to) ||
        typeof transaction.data !== "string" ||
        !/^0x(?:[a-fA-F0-9]{2})+$/.test(transaction.data) ||
        typeof transaction.value !== "string" ||
        transaction.value !== expectedValue ||
        typeof transaction.gas !== "string" ||
        !/^[1-9][0-9]*$/.test(transaction.gas) ||
        typeof transaction.gasPrice !== "string" ||
        !/^[1-9][0-9]*$/.test(transaction.gasPrice);

      const usdtTargetIsInvalid =
        sellSymbol === "USDT" &&
        typeof transaction?.to === "string" &&
        transaction.to.toLowerCase() !== ZEROX_ALLOWANCE_HOLDER;

      if (transactionIsInvalid || usdtTargetIsInvalid) {
        sendJson(response, 502, {
          error: "Swap provider returned an invalid transaction",
        });
        return;
      }
    }

    sendJson(response, 200, body);
  } catch (error) {
    sendJson(response, 502, {
      error:
        error instanceof Error
          ? `Swap provider unavailable: ${error.message}`
          : "Swap provider unavailable",
    });
  }
});

server.listen(PORT, HOST, () => {
  console.log(`Swap proxy listening on http://${HOST}:${PORT}`);
});
