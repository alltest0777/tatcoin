export type ChainId = "tatcoin" | "bitcoin" | "ethereum";

export type ChainFamily = "cosmos" | "bitcoin" | "evm";

export interface ChainConfig {
  id: ChainId;
  name: string;
  symbol: string;
  family: ChainFamily;

  decimals: number;

  addressPrefix: string;

  enabled: boolean;
  mainnet: boolean;
}

export const CHAINS: Record<ChainId, ChainConfig> = {
  tatcoin: {
    id: "tatcoin",
    name: "TatCoin",
    symbol: "TAT",
    family: "cosmos",

    decimals: 6,

    addressPrefix: "tat",

    enabled: true,
    mainnet: true,
  },

  bitcoin: {
    id: "bitcoin",
    name: "Bitcoin",
    symbol: "BTC",
    family: "bitcoin",

    decimals: 8,

    addressPrefix: "bc1",

    enabled: false,
    mainnet: true,
  },

  ethereum: {
    id: "ethereum",
    name: "Ethereum",
    symbol: "ETH",
    family: "evm",

    decimals: 18,

    addressPrefix: "0x",

    enabled: false,
    mainnet: true,
  },
};

export const SUPPORTED_CHAINS = Object.values(CHAINS);

export function getChainConfig(
  chainId: ChainId,
): ChainConfig {
  return CHAINS[chainId];
}
