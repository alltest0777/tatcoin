import type { OfflineDirectSigner } from "@cosmjs/proto-signing";
import { create } from "zustand";

const ACTIVE_ADDRESS_KEY = "tatcoin.activeAddress";
const BTC_ADDRESS_KEY = "tatcoin.btcAddress";
const ETH_ADDRESS_KEY = "tatcoin.ethAddress";

function loadStoredAddress(): string | null {
  try {
    const value = localStorage.getItem(ACTIVE_ADDRESS_KEY);

    if (!value) {
      return null;
    }

    const address = value.trim();

    if (!/^tat1[a-z0-9]+$/.test(address)) {
      localStorage.removeItem(ACTIVE_ADDRESS_KEY);

      return null;
    }

    return address;
  } catch {
    return null;
  }
}

function loadStoredBitcoinAddress(): string | null {
  try {
    const value = localStorage.getItem(BTC_ADDRESS_KEY);

    if (!value) {
      return null;
    }

    const address = value.trim();

    if (!/^bc1[a-z0-9]+$/i.test(address)) {
      localStorage.removeItem(BTC_ADDRESS_KEY);

      return null;
    }

    return address;
  } catch {
    return null;
  }
}

function loadStoredEthereumAddress(): string | null {
  try {
    const value = localStorage.getItem(ETH_ADDRESS_KEY);

    if (!value) {
      return null;
    }

    const address = value.trim();

    if (!/^0x[a-fA-F0-9]{40}$/.test(address)) {
      localStorage.removeItem(ETH_ADDRESS_KEY);

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
  btcAddress: string | null;
  ethAddress: string | null;

  setWallet: (address: string, signer: OfflineDirectSigner) => void;

  setMultichainAddresses: (btcAddress: string, ethAddress: string) => void;

  lockWallet: () => void;
  removeWallet: () => void;

  clearWallet: () => void;
}

export const useWalletStore = create<WalletState>((set) => ({
  address: loadStoredAddress(),
  btcAddress: loadStoredBitcoinAddress(),
  ethAddress: loadStoredEthereumAddress(),
  signer: null,

  setWallet: (address, signer) => {
    try {
      localStorage.setItem(ACTIVE_ADDRESS_KEY, address);
    } catch {
      // Wallet can still work for the current session.
    }

    set({
      address,
      signer,
    });
  },

  setMultichainAddresses: (btcAddress, ethAddress) => {
    try {
      localStorage.setItem(BTC_ADDRESS_KEY, btcAddress);

      localStorage.setItem(ETH_ADDRESS_KEY, ethAddress);
    } catch {
      // Public addresses can still work for the current session.
    }

    set({
      btcAddress,
      ethAddress,
    });
  },

  lockWallet: () => {
    set({
      signer: null,
    });
  },

  removeWallet: () => {
    try {
      localStorage.removeItem(ACTIVE_ADDRESS_KEY);
      localStorage.removeItem(BTC_ADDRESS_KEY);

      localStorage.removeItem(ETH_ADDRESS_KEY);
    } catch {
      // Ignore storage errors.
    }

    set({
      address: null,
      btcAddress: null,
      ethAddress: null,
      signer: null,
    });
  },

  clearWallet: () => {
    try {
      localStorage.removeItem(ACTIVE_ADDRESS_KEY);
      localStorage.removeItem(BTC_ADDRESS_KEY);

      localStorage.removeItem(ETH_ADDRESS_KEY);
    } catch {
      // Ignore storage errors.
    }

    set({
      address: null,
      btcAddress: null,
      ethAddress: null,
      signer: null,
    });
  },
}));
