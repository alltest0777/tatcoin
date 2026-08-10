import { create } from "zustand";

interface WalletState {
  address: string | null;
  setAddress: (address: string) => void;
  clearWallet: () => void;
}

export const useWalletStore = create<WalletState>((set) => ({
  address: null,

  setAddress: (address) => {
    set({ address });
  },

  clearWallet: () => {
    set({ address: null });
  },
}));
