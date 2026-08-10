export const BASE_DENOM = "utat";
export const DISPLAY_DENOM = "TAT";
export const DISPLAY_EXPONENT = 6;

const REST_BASE_URL = "/cosmos";

interface Coin {
  denom: string;
  amount: string;
}

interface BalancesResponse {
  balances: Coin[];
}

export async function getTatBalance(address: string): Promise<string> {
  const response = await fetch(
    `${REST_BASE_URL}/bank/v1beta1/balances/${address}`,
  );

  if (!response.ok) {
    throw new Error(
      `Failed to load balance: HTTP ${response.status}`,
    );
  }

  const data = (await response.json()) as BalancesResponse;

  const coin = data.balances.find(
    (item) => item.denom === BASE_DENOM,
  );

  return coin?.amount ?? "0";
}

export function formatTatBalance(amount: string): string {
  const value = BigInt(amount);
  const divisor = 10n ** BigInt(DISPLAY_EXPONENT);

  const whole = value / divisor;
  const fraction = value % divisor;

  return `${whole}.${fraction.toString().padStart(DISPLAY_EXPONENT, "0")}`;
}
