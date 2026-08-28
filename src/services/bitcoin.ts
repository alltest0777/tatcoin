export interface BitcoinAddressStats {
  funded_txo_sum: number;
  spent_txo_sum: number;
}

export interface BitcoinAddressResponse {
  chain_stats: BitcoinAddressStats;
  mempool_stats: BitcoinAddressStats;
}

const BITCOIN_API_URL =
  "https://blockstream.info/api";

export async function getBitcoinBalance(
  address: string,
): Promise<string> {
  if (!/^bc1[a-z0-9]+$/i.test(address)) {
    throw new Error("Invalid Bitcoin address");
  }

  const response = await fetch(
    `${BITCOIN_API_URL}/address/${encodeURIComponent(address)}`,
  );

  if (!response.ok) {
    throw new Error(
      `Bitcoin API error: ${response.status}`,
    );
  }

  const data =
    (await response.json()) as BitcoinAddressResponse;

  const confirmed =
    BigInt(data.chain_stats.funded_txo_sum) -
    BigInt(data.chain_stats.spent_txo_sum);

  const mempool =
    BigInt(data.mempool_stats.funded_txo_sum) -
    BigInt(data.mempool_stats.spent_txo_sum);

  return (confirmed + mempool).toString();
}

export function formatBitcoinBalance(
  satoshis: string,
): string {
  const value = BigInt(satoshis);

  const whole = value / 100_000_000n;
  const fraction = value % 100_000_000n;

  return `${whole}.${fraction
    .toString()
    .padStart(8, "0")}`;
}

export interface BitcoinUtxoStatus {
  confirmed: boolean;
  block_height?: number;
  block_hash?: string;
  block_time?: number;
}

export interface BitcoinUtxo {
  txid: string;
  vout: number;
  value: number;
  status: BitcoinUtxoStatus;
}

export interface BitcoinFeeRates {
  fast: number;
  normal: number;
  economy: number;
}

export async function getBitcoinUtxos(
  address: string,
): Promise<BitcoinUtxo[]> {
  if (!/^bc1[a-z0-9]+$/i.test(address)) {
    throw new Error("Invalid Bitcoin address");
  }

  const response = await fetch(
    `${BITCOIN_API_URL}/address/${encodeURIComponent(address)}/utxo`,
  );

  if (!response.ok) {
    throw new Error(
      `Bitcoin UTXO API error: ${response.status}`,
    );
  }

  return (await response.json()) as BitcoinUtxo[];
}

export async function getBitcoinFeeRates():
Promise<BitcoinFeeRates> {
  const response = await fetch(
    `${BITCOIN_API_URL}/fee-estimates`,
  );

  if (!response.ok) {
    throw new Error(
      `Bitcoin fee API error: ${response.status}`,
    );
  }

  const estimates =
    (await response.json()) as Record<string, number>;

  function getRate(
    target: number,
  ): number {
    const exact = estimates[String(target)];

    if (
      exact !== undefined &&
      Number.isFinite(exact) &&
      exact > 0
    ) {
      return exact;
    }

    const available = Object.entries(estimates)
      .map(([blocks, rate]) => ({
        blocks: Number(blocks),
        rate,
      }))
      .filter(
        (item) =>
          Number.isFinite(item.blocks) &&
          Number.isFinite(item.rate) &&
          item.rate > 0,
      )
      .sort(
        (a, b) =>
          Math.abs(a.blocks - target) -
          Math.abs(b.blocks - target),
      );

    if (!available[0]) {
      throw new Error(
        "Bitcoin fee API returned no usable estimates",
      );
    }

    return available[0].rate;
  }

  return {
    fast: getRate(1),
    normal: getRate(6),
    economy: getRate(144),
  };
}

export async function broadcastBitcoinTransaction(
  rawTxHex: string,
): Promise<string> {
  const response = await fetch(
    "https://blockstream.info/api/tx",
    {
      method: "POST",
      headers: {
        "Content-Type": "text/plain",
      },
      body: rawTxHex.trim(),
    },
  );

  const text = await response.text();

  if (!response.ok) {
    throw new Error(
      text || "Failed to broadcast Bitcoin transaction",
    );
  }

  return text.trim();
}
