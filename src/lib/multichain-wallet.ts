import { HDKey } from "@scure/bip32";
import { bech32 } from "@scure/base";
import { mnemonicToSeedSync } from "@scure/bip39";

import { secp256k1 } from "@noble/curves/secp256k1.js";
import { sha256 } from "@noble/hashes/sha2.js";
import { ripemd160 } from "@noble/hashes/legacy.js";
import { keccak_256 } from "@noble/hashes/sha3.js";
import { bytesToHex } from "@noble/hashes/utils.js";

import { importWallet } from "./wallet-core";

export interface MultichainAddresses {
  tat: string;
  btc: string;
  eth: string;
}

const BTC_DERIVATION_PATH = "m/84'/0'/0'/0/0";
const ETH_DERIVATION_PATH = "m/44'/60'/0'/0/0";

function normalizeMnemonic(
  mnemonic: string,
): string {
  const normalized = mnemonic
    .trim()
    .replace(/\s+/g, " ");

  if (!normalized) {
    throw new Error("Mnemonic cannot be empty");
  }

  return normalized;
}

function hash160(
  value: Uint8Array,
): Uint8Array {
  return ripemd160(
    sha256(value),
  );
}

function deriveBitcoinAddress(
  seed: Uint8Array,
): string {
  const root =
    HDKey.fromMasterSeed(seed);

  const account =
    root.derive(BTC_DERIVATION_PATH);

  if (!account.publicKey) {
    throw new Error(
      "Failed to derive Bitcoin public key",
    );
  }

  /*
   * BIP84 native SegWit P2WPKH:
   *
   * witness version = 0
   * witness program = HASH160(compressed public key)
   */
  const witnessProgram =
    hash160(account.publicKey);

  return bech32.encode(
    "bc",
    [
      0,
      ...bech32.toWords(
        witnessProgram,
      ),
    ],
  );
}

function toChecksumEthereumAddress(
  addressBytes: Uint8Array,
): string {
  const lower =
    bytesToHex(addressBytes);

  const hash =
    bytesToHex(
      keccak_256(
        new TextEncoder().encode(
          lower,
        ),
      ),
    );

  let result = "0x";

  for (
    let index = 0;
    index < lower.length;
    index += 1
  ) {
    const character = lower[index];

    if (
      character >= "a" &&
      character <= "f" &&
      Number.parseInt(
        hash[index] ?? "0",
        16,
      ) >= 8
    ) {
      result += character.toUpperCase();
    } else {
      result += character;
    }
  }

  return result;
}

function deriveEthereumAddress(
  seed: Uint8Array,
): string {
  const root =
    HDKey.fromMasterSeed(seed);

  const account =
    root.derive(ETH_DERIVATION_PATH);

  if (!account.privateKey) {
    throw new Error(
      "Failed to derive Ethereum private key",
    );
  }

  /*
   * Ethereum address:
   * last 20 bytes of
   * keccak256(uncompressed public key without 0x04 prefix)
   */
  const publicKey =
    secp256k1.getPublicKey(
      account.privateKey,
      false,
    );

  const publicKeyBody =
    publicKey.slice(1);

  const hash =
    keccak_256(publicKeyBody);

  const addressBytes =
    hash.slice(-20);

  return toChecksumEthereumAddress(
    addressBytes,
  );
}

export async function deriveMultichainAddresses(
  mnemonic: string,
): Promise<MultichainAddresses> {
  const normalizedMnemonic =
    normalizeMnemonic(mnemonic);

  /*
   * IMPORTANT:
   *
   * TAT continues to use the existing wallet-core
   * derivation exactly as before.
   *
   * Do not replace this with a new HD path.
   */
  const tatWallet =
    await importWallet(
      normalizedMnemonic,
    );

  const seed =
    mnemonicToSeedSync(
      normalizedMnemonic,
    );

  return {
    tat: tatWallet.address,
    btc: deriveBitcoinAddress(
      seed,
    ),
    eth: deriveEthereumAddress(
      seed,
    ),
  };
}
