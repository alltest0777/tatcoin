import type { OfflineDirectSigner } from "@cosmjs/proto-signing";
import { create } from "zustand";

interface WalletState {
  address: string | null;
  signer: OfflineDirectSigner | null;

  setWallet: (
    address: string,
    signer: OfflineDirectSigner,
  ) => void;

  clearWallet: () => void;
}

export const useWalletStore = create<WalletState>((set) => ({
  address: null,
  signer: null,

  setWallet: (address, signer) => {
    set({
      address,
      signer,
    });
  },

  clearWallet: () => {
    set({
      address: null,
      signer: null,
    });
  },
}));
