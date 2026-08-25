const ETHEREUM_RPC_URL =
  "https://ethereum-rpc.publicnode.com";

interface EthereumRpcResponse {
  jsonrpc: "2.0";
  id: number;
  result?: string;
  error?: {
    code: number;
    message: string;
  };
}

export async function getEthereumBalance(
  address: string,
): Promise<string> {
  if (!/^0x[a-fA-F0-9]{40}$/.test(address)) {
    throw new Error("Invalid Ethereum address");
  }

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
        method: "eth_getBalance",
        params: [
          address,
          "latest",
        ],
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

  if (!data.result) {
    throw new Error(
      "Ethereum RPC returned no balance",
    );
  }

  return BigInt(data.result).toString();
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
