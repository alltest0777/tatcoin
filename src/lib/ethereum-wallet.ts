import { secp256k1 } from "@noble/curves/secp256k1.js";
import { keccak_256 } from "@noble/hashes/sha3.js";
import { bytesToHex } from "@noble/hashes/utils.js";

import {
  buildEthereumTransaction,
  type BuildEthereumTransactionParams,
  type BuiltEthereumTransaction,
} from "./ethereum-transaction";

import {
  deriveEthereumPrivateKey,
} from "./multichain-wallet";

export interface SignEthereumTransactionParams {
  mnemonic: string;
  expectedFromAddress: string;
  chainId: bigint;
  nonce: bigint;
  to: string;
  value: bigint;
  gasLimit: bigint;
  maxPriorityFeePerGas: bigint;
  maxFeePerGas: bigint;
  data?: string;
}

function deriveEthereumAddressFromPrivateKey(
  privateKey: Uint8Array,
): string {
  const publicKey =
    secp256k1.getPublicKey(
      privateKey,
      false,
    );

  const hash =
    keccak_256(
      publicKey.slice(1),
    );

  return `0x${bytesToHex(
    hash.slice(-20),
  )}`;
}

export function signEthereumTransaction(
  params: SignEthereumTransactionParams,
): BuiltEthereumTransaction {
  const {
    mnemonic,
    expectedFromAddress,
    chainId,
    nonce,
    to,
    value,
    gasLimit,
    maxPriorityFeePerGas,
    maxFeePerGas,
    data,
  } = params;

  const normalizedMnemonic =
    mnemonic
      .trim()
      .replace(/\s+/g, " ");

  if (!normalizedMnemonic) {
    throw new Error(
      "Recovery phrase cannot be empty",
    );
  }

  if (
    !/^0x[a-fA-F0-9]{40}$/.test(
      expectedFromAddress,
    )
  ) {
    throw new Error(
      "Invalid expected Ethereum sender address",
    );
  }

  const privateKey =
    deriveEthereumPrivateKey(
      normalizedMnemonic,
    );

  try {
    const derivedAddress =
      deriveEthereumAddressFromPrivateKey(
        privateKey,
      );

    if (
      derivedAddress.toLowerCase() !==
      expectedFromAddress.toLowerCase()
    ) {
      throw new Error(
        "Recovery phrase does not match the current Ethereum wallet",
      );
    }

    const transactionParams: BuildEthereumTransactionParams = {
      privateKey,
      chainId,
      nonce,
      to,
      value,
      gasLimit,
      maxPriorityFeePerGas,
      maxFeePerGas,
      data,
    };

    return buildEthereumTransaction(
      transactionParams,
    );
  } finally {
    /*
     * Best-effort cleanup of our private-key buffer.
     *
     * JavaScript cannot guarantee that every internal
     * runtime copy is erased, but we should not retain
     * our own key bytes longer than necessary.
     */
    privateKey.fill(0);
  }
}
