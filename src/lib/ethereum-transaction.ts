import { secp256k1 } from "@noble/curves/secp256k1.js";
import { keccak_256 } from "@noble/hashes/sha3.js";
import { bytesToHex, hexToBytes } from "@noble/hashes/utils.js";

export interface BuildEthereumTransactionParams {
  privateKey: Uint8Array;
  chainId: bigint;
  nonce: bigint;
  to: string;
  value: bigint;
  gasLimit: bigint;
  maxPriorityFeePerGas: bigint;
  maxFeePerGas: bigint;
  data?: string;
}

export interface BuiltEthereumTransaction {
  rawTxHex: string;
  txid: string;
}

function bigintToBytes(value: bigint): Uint8Array {
  if (value < 0n) {
    throw new Error("Ethereum integer cannot be negative");
  }

  if (value === 0n) {
    return new Uint8Array();
  }

  let hex = value.toString(16);

  if (hex.length % 2 !== 0) {
    hex = `0${hex}`;
  }

  return hexToBytes(hex);
}

function concatBytes(...arrays: Uint8Array[]): Uint8Array {
  const length = arrays.reduce((sum, item) => sum + item.length, 0);

  const result = new Uint8Array(length);

  let offset = 0;

  for (const array of arrays) {
    result.set(array, offset);

    offset += array.length;
  }

  return result;
}

function encodeLength(length: number, offset: number): Uint8Array {
  if (length < 56) {
    return Uint8Array.of(offset + length);
  }

  const lengthBytes = bigintToBytes(BigInt(length));

  return concatBytes(
    Uint8Array.of(offset + 55 + lengthBytes.length),
    lengthBytes,
  );
}

function rlpEncodeBytes(value: Uint8Array): Uint8Array {
  if (value.length === 1 && value[0] !== undefined && value[0] < 0x80) {
    return value;
  }

  return concatBytes(encodeLength(value.length, 0x80), value);
}

function rlpEncodeList(values: Uint8Array[]): Uint8Array {
  const encoded = values.map(rlpEncodeBytes);

  const payload = concatBytes(...encoded);

  return concatBytes(encodeLength(payload.length, 0xc0), payload);
}

function addressToBytes(address: string): Uint8Array {
  if (!/^0x[a-fA-F0-9]{40}$/.test(address)) {
    throw new Error("Invalid Ethereum recipient address");
  }

  return hexToBytes(address.slice(2));
}

function dataToBytes(data?: string): Uint8Array {
  if (data === undefined || data === "0x" || data === "") {
    return new Uint8Array();
  }

  if (!/^0x[0-9a-fA-F]*$/.test(data)) {
    throw new Error("Invalid Ethereum transaction data");
  }

  const hex = data.slice(2);

  if (hex.length % 2 !== 0) {
    throw new Error("Ethereum transaction data must contain complete bytes");
  }

  return hexToBytes(hex);
}

export function buildEthereumTransaction(
  params: BuildEthereumTransactionParams,
): BuiltEthereumTransaction {
  const {
    privateKey,
    chainId,
    nonce,
    to,
    value,
    gasLimit,
    maxPriorityFeePerGas,
    maxFeePerGas,
    data,
  } = params;

  if (privateKey.length !== 32) {
    throw new Error("Invalid Ethereum private key");
  }

  if (chainId <= 0n) {
    throw new Error("Invalid Ethereum chain ID");
  }

  if (value < 0n) {
    throw new Error("Ethereum value cannot be negative");
  }

  if (gasLimit <= 0n || maxPriorityFeePerGas < 0n || maxFeePerGas <= 0n) {
    throw new Error("Invalid Ethereum gas parameters");
  }

  if (maxFeePerGas < maxPriorityFeePerGas) {
    throw new Error("maxFeePerGas cannot be lower than maxPriorityFeePerGas");
  }

  const toBytes = addressToBytes(to);

  const transactionData = dataToBytes(data);

  /*
   * EIP-1559 transaction:
   *
   * 0x02 ||
   * rlp([
   *   chainId,
   *   nonce,
   *   maxPriorityFeePerGas,
   *   maxFeePerGas,
   *   gasLimit,
   *   destination,
   *   amount,
   *   data,
   *   accessList
   * ])
   */

  const unsignedPayload = rlpEncodeList([
    bigintToBytes(chainId),
    bigintToBytes(nonce),
    bigintToBytes(maxPriorityFeePerGas),
    bigintToBytes(maxFeePerGas),
    bigintToBytes(gasLimit),
    toBytes,
    bigintToBytes(value),
    transactionData,

    /*
     * Empty access list.
     *
     * RLP encoding of [] is 0xc0.
     * Because this field itself is a list,
     * it is appended separately below.
     */
  ]);

  /*
   * Our generic rlpEncodeList above expects
   * byte-string elements only, while accessList
   * is itself an RLP list.
   *
   * Build the correct unsigned payload explicitly.
   */

  const fieldsWithoutAccessList = [
    rlpEncodeBytes(bigintToBytes(chainId)),
    rlpEncodeBytes(bigintToBytes(nonce)),
    rlpEncodeBytes(bigintToBytes(maxPriorityFeePerGas)),
    rlpEncodeBytes(bigintToBytes(maxFeePerGas)),
    rlpEncodeBytes(bigintToBytes(gasLimit)),
    rlpEncodeBytes(toBytes),
    rlpEncodeBytes(bigintToBytes(value)),
    rlpEncodeBytes(transactionData),

    /*
     * Empty access list.
     */
    Uint8Array.of(0xc0),
  ];

  const unsignedBody = concatBytes(...fieldsWithoutAccessList);

  const unsignedRlp = concatBytes(
    encodeLength(unsignedBody.length, 0xc0),
    unsignedBody,
  );

  /*
   * Silence the intentionally unused helper-built
   * payload while keeping the generic list encoder
   * available for future ERC-20/access-list work.
   */
  void unsignedPayload;

  const signingPayload = concatBytes(Uint8Array.of(0x02), unsignedRlp);

  const signingHash = keccak_256(signingPayload);

  /*
   * noble-curves signs the 32-byte digest directly.
   * prehash:false is important because Ethereum
   * already uses keccak256 above.
   */

  const signature = secp256k1.sign(signingHash, privateKey, {
    prehash: false,
    lowS: true,
    format: "recovered",
  });

  /*
   * noble-curves recovered format:
   *
   * byte 0     = recovery id
   * bytes 1-32 = r
   * bytes 33-64 = s
   */
  if (signature.length !== 65) {
    throw new Error("Invalid Ethereum signature length");
  }

  const recovery = signature[0];

  const r = signature.slice(1, 33);

  const s = signature.slice(33, 65);

  if (recovery !== 0 && recovery !== 1) {
    throw new Error("Invalid Ethereum signature recovery bit");
  }

  const signedFields = [
    ...fieldsWithoutAccessList,
    rlpEncodeBytes(bigintToBytes(BigInt(recovery))),
    rlpEncodeBytes(r),
    rlpEncodeBytes(s),
  ];

  const signedBody = concatBytes(...signedFields);

  const signedRlp = concatBytes(
    encodeLength(signedBody.length, 0xc0),
    signedBody,
  );

  const rawTx = concatBytes(Uint8Array.of(0x02), signedRlp);

  const txHash = keccak_256(rawTx);

  return {
    rawTxHex: `0x${bytesToHex(rawTx)}`,
    txid: `0x${bytesToHex(txHash)}`,
  };
}
