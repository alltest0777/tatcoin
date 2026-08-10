import { DirectSecp256k1HdWallet } from "@cosmjs/proto-signing";

export const TATCOIN_PREFIX = "tat";

export interface WalletSession {
  mnemonic: string;
  address: string;
  signer: DirectSecp256k1HdWallet;
}

export async function createWallet(): Promise<WalletSession> {
  const signer = await DirectSecp256k1HdWallet.generate(24, {
    prefix: TATCOIN_PREFIX,
  });

  const [account] = await signer.getAccounts();

  if (!account) {
    throw new Error("Failed to derive TatCoin account");
  }

  return {
    mnemonic: signer.mnemonic,
    address: account.address,
    signer,
  };
}

export async function importWallet(
  mnemonic: string,
): Promise<WalletSession> {
  const normalizedMnemonic = mnemonic.trim().replace(/\s+/g, " ");

  if (!normalizedMnemonic) {
    throw new Error("Mnemonic cannot be empty");
  }

  const signer = await DirectSecp256k1HdWallet.fromMnemonic(
    normalizedMnemonic,
    {
      prefix: TATCOIN_PREFIX,
    },
  );

  const [account] = await signer.getAccounts();

  if (!account) {
    throw new Error("Failed to derive TatCoin account");
  }

  return {
    mnemonic: normalizedMnemonic,
    address: account.address,
    signer,
  };
}

export async function getWalletAddress(
  signer: DirectSecp256k1HdWallet,
): Promise<string> {
  const [account] = await signer.getAccounts();

  if (!account) {
    throw new Error("Failed to derive TatCoin account");
  }

  return account.address;
}
