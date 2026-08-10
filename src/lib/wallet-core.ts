import { DirectSecp256k1HdWallet } from "@cosmjs/proto-signing";

export const TATCOIN_PREFIX = "tat";

export interface CreatedWallet {
  mnemonic: string;
  address: string;
}

export async function createWallet(): Promise<CreatedWallet> {
  const wallet = await DirectSecp256k1HdWallet.generate(24, {
    prefix: TATCOIN_PREFIX,
  });

  const [account] = await wallet.getAccounts();

  if (!account) {
    throw new Error("Failed to derive TatCoin account");
  }

  return {
    mnemonic: wallet.mnemonic,
    address: account.address,
  };
}

export async function importWallet(
  mnemonic: string,
): Promise<DirectSecp256k1HdWallet> {
  const normalizedMnemonic = mnemonic.trim().replace(/\s+/g, " ");

  if (!normalizedMnemonic) {
    throw new Error("Mnemonic cannot be empty");
  }

  return DirectSecp256k1HdWallet.fromMnemonic(normalizedMnemonic, {
    prefix: TATCOIN_PREFIX,
  });
}

export async function getWalletAddress(
  wallet: DirectSecp256k1HdWallet,
): Promise<string> {
  const [account] = await wallet.getAccounts();

  if (!account) {
    throw new Error("Failed to derive TatCoin account");
  }

  return account.address;
}
