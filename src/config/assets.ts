import {
  CHAINS,
  type ChainId,
} from "./chains";

export interface AssetConfig {
  id: string;
  chainId: ChainId;

  symbol: string;
  name: string;

  decimals: number;

  enabled: boolean;
  native: boolean;
}

export const ASSETS: AssetConfig[] = [
  {
    id: "tat",
    chainId: "tatcoin",
    symbol: "TAT",
    name: "TatCoin",
    decimals: CHAINS.tatcoin.decimals,
    enabled: true,
    native: true,
  },

  {
    id: "btc",
    chainId: "bitcoin",
    symbol: "BTC",
    name: "Bitcoin",
    decimals: CHAINS.bitcoin.decimals,
    enabled: false,
    native: true,
  },

  {
    id: "eth",
    chainId: "ethereum",
    symbol: "ETH",
    name: "Ethereum",
    decimals: CHAINS.ethereum.decimals,
    enabled: false,
    native: true,
  },
];

export function getAssetConfig(
  assetId: string,
): AssetConfig | undefined {
  return ASSETS.find(
    (asset) => asset.id === assetId,
  );
}
