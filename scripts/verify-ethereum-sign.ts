import { Transaction } from "ethers";

const expectedSender =
  "0x7e5f4552091a69125d5dfcb7b8c2659029395bdf";

const expectedTo =
  "0x7e5f4552091a69125d5dfcb7b8c2659029395bdf";

const rawTx =
  "0x02f86a0180843b9aca008477359400825208947e5f4552091a69125d5dfcb7b8c2659029395bdf0180c001a0fe0ae0853c4a0d7716379706c51e4edd2f40cb97661bf68d008e7c9f8aed2905a05e0900da15233ac6d56dffde9e985783f8b4ef6c095c390e06cb452f081906f2";

const expectedTxid =
  "0xba48c89daf88aa06272d835dcbdff293121fbb55a901cbc84f77d16f5969f54a";

function assertEqual(
  name: string,
  actual: unknown,
  expected: unknown,
) {
  if (actual !== expected) {
    throw new Error(
      `${name} mismatch: expected ${String(
        expected,
      )}, got ${String(actual)}`,
    );
  }
}

function main() {
  const tx =
    Transaction.from(rawTx);

  console.log(
    "Independent Ethereum TX verification",
  );
  console.log(
    "------------------------------------",
  );

  console.log("Type:", tx.type);
  console.log(
    "Chain ID:",
    tx.chainId.toString(),
  );
  console.log("Nonce:", tx.nonce);
  console.log("From:", tx.from);
  console.log("To:", tx.to);
  console.log(
    "Value:",
    tx.value.toString(),
    "wei",
  );
  console.log(
    "Gas limit:",
    tx.gasLimit.toString(),
  );
  console.log(
    "Priority fee:",
    tx.maxPriorityFeePerGas?.toString(),
    "wei",
  );
  console.log(
    "Max fee:",
    tx.maxFeePerGas?.toString(),
    "wei",
  );
  console.log("Data:", tx.data);
  console.log("Hash:", tx.hash);

  assertEqual(
    "type",
    tx.type,
    2,
  );

  assertEqual(
    "chainId",
    tx.chainId,
    1n,
  );

  assertEqual(
    "nonce",
    tx.nonce,
    0,
  );

  assertEqual(
    "sender",
    tx.from?.toLowerCase(),
    expectedSender.toLowerCase(),
  );

  assertEqual(
    "recipient",
    tx.to?.toLowerCase(),
    expectedTo.toLowerCase(),
  );

  assertEqual(
    "value",
    tx.value,
    1n,
  );

  assertEqual(
    "gasLimit",
    tx.gasLimit,
    21000n,
  );

  assertEqual(
    "maxPriorityFeePerGas",
    tx.maxPriorityFeePerGas,
    1_000_000_000n,
  );

  assertEqual(
    "maxFeePerGas",
    tx.maxFeePerGas,
    2_000_000_000n,
  );

  assertEqual(
    "data",
    tx.data,
    "0x",
  );

  assertEqual(
    "txid",
    tx.hash,
    expectedTxid,
  );

  console.log("");
  console.log(
    "✅ INDEPENDENT ETHEREUM TX VERIFICATION PASSED",
  );
  console.log(
    "Signature recovered the expected sender.",
  );
  console.log(
    "No transaction was broadcast.",
  );
}

main();
