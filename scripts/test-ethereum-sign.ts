import { secp256k1 } from "@noble/curves/secp256k1.js";
import { keccak_256 } from "@noble/hashes/sha3.js";
import { bytesToHex } from "@noble/hashes/utils.js";

import {
  buildEthereumTransaction,
} from "../src/lib/ethereum-transaction";

const privateKey =
  new Uint8Array(32);

privateKey[31] = 1;

const publicKey =
  secp256k1.getPublicKey(
    privateKey,
    false,
  );

const addressHash =
  keccak_256(
    publicKey.slice(1),
  );

const sender =
  `0x${bytesToHex(
    addressHash.slice(-20),
  )}`;

const tx =
  buildEthereumTransaction({
    privateKey,
    chainId: 1n,
    nonce: 0n,
    to: sender,
    value: 1n,
    gasLimit: 21000n,
    maxPriorityFeePerGas:
      1_000_000_000n,
    maxFeePerGas:
      2_000_000_000n,
    data: "0x",
  });

console.log(
  "Ethereum EIP-1559 signing test",
);

console.log(
  "------------------------------",
);

console.log(
  "Sender:",
  sender,
);

console.log(
  "Raw TX:",
  tx.rawTxHex,
);

console.log(
  "TXID:",
  tx.txid,
);

if (
  !tx.rawTxHex.startsWith(
    "0x02",
  )
) {
  throw new Error(
    "Transaction is not EIP-1559 type 0x02",
  );
}

if (
  !/^0x[0-9a-f]{64}$/i.test(
    tx.txid,
  )
) {
  throw new Error(
    "Invalid Ethereum transaction hash",
  );
}

console.log("");
console.log(
  "✅ ETHEREUM SIGNING TEST PASSED",
);
console.log(
  "No transaction was broadcast.",
);
