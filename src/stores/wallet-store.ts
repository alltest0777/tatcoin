import type { OfflineDirectSigner } from "@cosmjs/proto-signing";
import { create } from "zustand";

const ACTIVE_ADDRESS_KEY = "tatcoin.activeAddress";

function loadStoredAddress(): string | null {
  try {
    const value = localStorage.getItem(
      ACTIVE_ADDRESS_KEY,
    );

    if (!value) {
      return null;
    }

    const address = value.trim();

    if (!/^tat1[a-z0-9]+$/.test(address)) {
      localStorage.removeItem(
        ACTIVE_ADDRESS_KEY,
      );

      return null;
    }

    return address;
  } catch {
    return null;
  }
}

interface WalletState {
  address: string | null;
  signer: OfflineDirectSigner | null;

  setWallet: (
    address: string,
    signer: OfflineDirectSigner,
  ) => void;

  lockWallet: () => void;
  removeWallet: () => void;

  clearWallet: () => void;
}

export const useWalletStore =
  create<WalletState>((set) => ({
    address: loadStoredAddress(),
    signer: null,

    setWallet: (address, signer) => {
      try {
        localStorage.setItem(
          ACTIVE_ADDRESS_KEY,
          address,
        );
      } catch {
        // Wallet can still work for the current session.
      }

      set({
        address,
        signer,
      });
    },

    lockWallet: () => {
      set({
        signer: null,
      });
    },

    removeWallet: () => {
      try {
        localStorage.removeItem(
          ACTIVE_ADDRESS_KEY,
        );
      } catch {
        // Ignore storage errors.
      }

      set({
        address: null,
        signer: null,
      });
    },

    clearWallet: () => {
      try {
        localStorage.removeItem(
          ACTIVE_ADDRESS_KEY,
        );
      } catch {
        // Ignore storage errors.
      }

      set({
        address: null,
        signer: null,
      });
    },
  }));
