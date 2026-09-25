import type { OfflineDirectSigner } from '@cosmjs/proto-signing';
import { create } from 'zustand';
import { importWallet } from '../lib/wallet-core';
import { deriveMultichainAddresses } from '../lib/multichain-wallet';
import { decryptMnemonic, encryptMnemonic } from '../lib/wallet-vault';
import { signEthereumTransaction, type SignEthereumTransactionParams } from '../lib/ethereum-wallet';
import { signBitcoinTransaction } from '../lib/bitcoin-wallet';

export const VAULT_KEY = 'tatcoin.encryptedVault.v1';
const KEYS = ['tatcoin.activeAddress', 'tatcoin.btcAddress', 'tatcoin.ethAddress'];
const LOCK_KEY = 'tatcoin.lockEvent';
let secret: string | null = null;
let activeSigner: OfflineDirectSigner | null = null;
let generation = 0;
let timer: ReturnType<typeof setTimeout> | undefined;
const SESSION_MS = 15 * 60 * 1000;
let expiresAt = 0;
function read(key: string) { try { return localStorage.getItem(key); } catch { return null; } }
function snapshot() {
  return { address: read(KEYS[0]), btcAddress: read(KEYS[1]), ethAddress: read(KEYS[2]), hasVault: read(VAULT_KEY) !== null };
}
interface WalletState {
  address: string | null;
  btcAddress: string | null;
  ethAddress: string | null;
  signer: OfflineDirectSigner | null;
  hasVault: boolean;
  sessionRevision: number;
  unlockWithPassword: (password: string) => Promise<void>;
  saveWithPassword: (mnemonic: string, password: string) => Promise<void>;
  lockWallet: () => void;
  removeWallet: () => void;
  clearWallet: () => void;
}
function invalidate() {
  generation++;
  secret = null;
  activeSigner = null;
  expiresAt = 0;
  clearTimeout(timer);
}
function assertCurrent(id: number) {
  if (id !== generation || !secret || Date.now() >= expiresAt) {
    throw new Error('Wallet locked. Unlock it before signing.');
  }
}
function guardedSigner(id: number): OfflineDirectSigner {
  return {
    getAccounts: async () => { assertCurrent(id); return activeSigner!.getAccounts(); },
    signDirect: async (address, doc) => {
      assertCurrent(id);
      const result = await activeSigner!.signDirect(address, doc);
      assertCurrent(id);
      return result;
    },
  };
}
export function assertWalletSession() { assertCurrent(generation); }
export function cancelPendingUnlock() {
  if (!secret) invalidate();
}
async function activate(mnemonic: string, password?: string) {
  // Every operation revokes previous signers and cancels pending unlocks.
  useWalletStore.getState().lockWallet();
  const id = generation;
  const storedVault = read(VAULT_KEY);
  const expected = snapshot();
  const wallet = await importWallet(mnemonic);
  const addresses = await deriveMultichainAddresses(wallet.mnemonic);
  const mismatchedNetworks: string[] = [];
  if (expected.address && expected.address !== addresses.tat) {
    mismatchedNetworks.push("TAT");
  }
  if (expected.btcAddress && expected.btcAddress !== addresses.btc) {
    mismatchedNetworks.push("BTC");
  }
  if (expected.ethAddress &&
      expected.ethAddress.toLowerCase() !== addresses.eth.toLowerCase()) {
    mismatchedNetworks.push("ETH");
  }
  if (mismatchedNetworks.length > 0) {
    throw new Error(
      `Recovery phrase does not match the saved wallet addresses: ${mismatchedNetworks.join(", ")}. Check your recovery backup. No saved wallet data was replaced.`,
    );
  }
  const encrypted = password === undefined ? undefined : await encryptMnemonic(wallet.mnemonic, password);
  if (id !== generation || read(VAULT_KEY) !== storedVault) throw new Error('Wallet operation cancelled');
  // Persist public metadata first and ciphertext last. Never claim success on a storage failure.
  if (encrypted !== undefined) {
    localStorage.setItem(KEYS[0], addresses.tat);
    localStorage.setItem(KEYS[1], addresses.btc);
    localStorage.setItem(KEYS[2], addresses.eth);
    localStorage.setItem(VAULT_KEY, encrypted);
  }
  secret = wallet.mnemonic;
  expiresAt = Date.now() + SESSION_MS;
  activeSigner = wallet.signer;
  const signer = guardedSigner(id);
  useWalletStore.setState({ address: addresses.tat, btcAddress: addresses.btc, ethAddress: addresses.eth,
    signer, hasVault: true, sessionRevision: id });
  timer = setTimeout(() => useWalletStore.getState().lockWallet(), SESSION_MS);
}
export const useWalletStore = create<WalletState>(() => ({
  ...snapshot(), signer: null, sessionRevision: 0,
  unlockWithPassword: async (password) => {
    useWalletStore.getState().lockWallet();
    const id = generation;
    const raw = read(VAULT_KEY);
    if (!raw) throw new Error('Set up a local password using your recovery phrase first');
    const mnemonic = await decryptMnemonic(raw, password);
    if (id !== generation || raw !== read(VAULT_KEY)) throw new Error('Wallet operation cancelled');
    await activate(mnemonic);
  },
  saveWithPassword: (mnemonic, password) => activate(mnemonic, password),
  lockWallet: () => {
    invalidate();
    useWalletStore.setState({ signer: null, sessionRevision: generation });
    try { localStorage.setItem(LOCK_KEY, crypto.randomUUID()); } catch { /* Local revocation still works. */ }
  },
  removeWallet: () => {
    useWalletStore.getState().lockWallet();
    localStorage.removeItem(VAULT_KEY);
    for (const key of KEYS) localStorage.removeItem(key);
    useWalletStore.setState({ ...snapshot(), signer: null });
  },
  clearWallet: () => useWalletStore.getState().removeWallet(),
}));
export function signSessionEthereum(params: Omit<SignEthereumTransactionParams, 'mnemonic'>) {
  assertCurrent(generation);
  return signEthereumTransaction({ ...params, mnemonic: secret! });
}
export function signSessionBitcoin(params: Omit<Parameters<typeof signBitcoinTransaction>[0], 'mnemonic'>) {
  assertCurrent(generation);
  return signBitcoinTransaction({ ...params, mnemonic: secret! });
}
if (typeof window !== 'undefined') {
  window.addEventListener('storage', (event) => {
    if (event.key === null || [VAULT_KEY, LOCK_KEY, ...KEYS].includes(event.key)) {
      invalidate();
      useWalletStore.setState({ ...snapshot(), signer: null, sessionRevision: generation });
    }
  });
  window.addEventListener('pagehide', () => useWalletStore.getState().lockWallet());
  document.addEventListener('visibilitychange', () => {
    if (secret && Date.now() >= expiresAt) useWalletStore.getState().lockWallet();
  });
}
