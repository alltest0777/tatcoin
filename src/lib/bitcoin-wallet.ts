import { HDKey } from "@scure/bip32";
import { mnemonicToSeedSync } from "@scure/bip39";
import * as btc from "@scure/btc-signer";
import { pubECDSA } from "@scure/btc-signer/utils.js";

const BTC_DERIVATION_PATH = "m/84'/0'/0'/0/0";

function normalizeMnemonic(
  mnemonic: string,
): string {
  const normalized = mnemonic
    .trim()
    .replace(/\s+/g, " ");

  if (!normalized) {
    throw new Error(
      "Mnemonic cannot be empty",
    );
  }

  return normalized;
}

export function deriveBitcoinPrivateKey(
  mnemonic: string,
): Uint8Array {
  const normalized =
    normalizeMnemonic(mnemonic);

  const seed =
    mnemonicToSeedSync(normalized);

  const root =
    HDKey.fromMasterSeed(seed);

  const account =
    root.derive(BTC_DERIVATION_PATH);

  if (!account.privateKey) {
    throw new Error(
      "Failed to derive Bitcoin private key",
    );
  }

  return account.privateKey;
}

export function getBitcoinSigningAddress(
  mnemonic: string,
): string {
  const privateKey =
    deriveBitcoinPrivateKey(mnemonic);

  const publicKey =
    pubECDSA(privateKey);

  const payment =
    btc.p2wpkh(publicKey);

  if (!payment.address) {
    throw new Error(
      "Failed to derive Bitcoin address",
    );
  }

  return payment.address;
}

export function verifyBitcoinSigningAddress(
  mnemonic: string,
  expectedAddress: string,
): boolean {
  const derivedAddress =
    getBitcoinSigningAddress(mnemonic);

  return (
    derivedAddress ===
    expectedAddress.trim()
  );
}
