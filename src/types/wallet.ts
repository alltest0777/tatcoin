import type {
  ChainFamily,
  ChainId,
} from "../config/chains";

export interface WalletAsset {
  chainId: ChainId;
  family: ChainFamily;

  symbol: string;
  name: string;

  address: string | null;

  balance: string | null;

  enabled: boolean;
}

export interface WalletAccount {
  id: string;

  assets: WalletAsset[];
}
