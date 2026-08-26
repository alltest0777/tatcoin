import {
  getBitcoinSigningAddress,
  signBitcoinTransaction,
} from "../src/lib/bitcoin-wallet";

import {
  planBitcoinTransaction,
} from "../src/lib/bitcoin-transaction";

import type {
  BitcoinUtxo,
} from "../src/services/bitcoin";

/*
 * Public BIP39 test vectors only.
 *
 * NEVER use these mnemonics for real funds.
 */
const SENDER_MNEMONIC =
  "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about";

const RECIPIENT_MNEMONIC =
  "legal winner thank year wave sausage worth useful legal winner thank yellow";

function assert(
  condition: boolean,
  message: string,
): void {
  if (!condition) {
    throw new Error(
      `TEST FAILED: ${message}`,
    );
  }
}

console.log(
  "=== Bitcoin local signing test ===",
);

const senderAddress =
  getBitcoinSigningAddress(
    SENDER_MNEMONIC,
  );

const recipientAddress =
  getBitcoinSigningAddress(
    RECIPIENT_MNEMONIC,
  );

console.log(
  "Sender:",
  senderAddress,
);

console.log(
  "Recipient:",
  recipientAddress,
);

assert(
  senderAddress.startsWith("bc1"),
  "Sender must be a Bitcoin bech32 address",
);

assert(
  recipientAddress.startsWith("bc1"),
  "Recipient must be a Bitcoin bech32 address",
);

assert(
  senderAddress !== recipientAddress,
  "Sender and recipient must be different",
);

/*
 * Artificial UTXO.
 *
 * This transaction does NOT exist on Bitcoin Mainnet.
 * It is used only to test transaction construction/signing.
 */
const fakeUtxos: BitcoinUtxo[] = [
  {
    txid: "11".repeat(32),
    vout: 0,
    value: 100_000,

    status: {
      confirmed: true,
      block_height: 1,
      block_hash: "22".repeat(32),
      block_time: 1,
    },
  },
];

const amountSats =
  50_000n;

const feeRate =
  2;

console.log("");
console.log(
  "Planning transaction...",
);

const plan =
  planBitcoinTransaction({
    fromAddress:
      senderAddress,

    toAddress:
      recipientAddress,

    amountSats,
    feeRate,

    utxos:
      fakeUtxos,
  });

console.log(
  "Input total:",
  plan.inputTotalSats.toString(),
  "sats",
);

console.log(
  "Amount:",
  plan.amountSats.toString(),
  "sats",
);

console.log(
  "Fee:",
  plan.feeSats.toString(),
  "sats",
);

console.log(
  "Change:",
  plan.changeSats.toString(),
  "sats",
);

console.log(
  "Estimated size:",
  plan.estimatedVBytes,
  "vB",
);

console.log(
  "Inputs:",
  plan.inputCount,
);

console.log(
  "Outputs:",
  plan.outputCount,
);

assert(
  plan.inputCount === 1,
  "Expected one input",
);

assert(
  plan.outputCount === 2,
  "Expected recipient + change outputs",
);

assert(
  plan.changeSats > 0n,
  "Expected positive change",
);

console.log("");
console.log(
  "Signing transaction locally...",
);

const signed =
  signBitcoinTransaction({
    mnemonic:
      SENDER_MNEMONIC,

    expectedFromAddress:
      senderAddress,

    toAddress:
      recipientAddress,

    amountSats,
    feeRate,

    utxos:
      fakeUtxos,
  });

console.log(
  "TXID:",
  signed.txid,
);

console.log(
  "Raw TX length:",
  signed.rawTxHex.length,
  "hex chars",
);

console.log(
  "Raw TX:",
  signed.rawTxHex,
);

assert(
  /^[a-f0-9]{64}$/i.test(
    signed.txid,
  ),
  "TXID must contain 64 hex characters",
);

assert(
  /^[a-f0-9]+$/i.test(
    signed.rawTxHex,
  ),
  "Raw transaction must be hexadecimal",
);

assert(
  signed.rawTxHex.length > 100,
  "Raw transaction is unexpectedly short",
);

assert(
  signed.feeSats ===
    plan.feeSats,
  "Signed transaction fee must match the plan",
);

assert(
  signed.changeSats ===
    plan.changeSats,
  "Signed transaction change must match the plan",
);

console.log("");
console.log(
  "✅ LOCAL BITCOIN SIGNING TEST PASSED",
);

console.log(
  "No transaction was broadcast.",
);
