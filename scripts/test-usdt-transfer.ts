import {
  encodeUsdtTransfer,
  parseUsdtAmount,
} from "../src/services/usdt";

const recipient =
  "0xb6bC801Aa2876Ccb65EbC7415F0a077EA2beef21";

const amount = parseUsdtAmount("1.000001");

const data = encodeUsdtTransfer(
  recipient,
  amount,
);

console.log("USDT ERC-20 transfer encoding test");
console.log("---------------------------------");
console.log(`Recipient: ${recipient}`);
console.log(`Amount units: ${amount.toString()}`);
console.log(`Calldata: ${data}`);

const byteLength = (data.length - 2) / 2;

console.log(`Calldata bytes: ${byteLength}`);

if (amount !== 1_000_001n) {
  throw new Error(
    `Unexpected USDT amount: ${amount.toString()}`,
  );
}

if (!data.startsWith("0xa9059cbb")) {
  throw new Error(
    "Invalid ERC-20 transfer selector",
  );
}

if (byteLength !== 68) {
  throw new Error(
    `Expected 68 bytes of calldata, got ${byteLength}`,
  );
}

console.log("");
console.log("✅ USDT TRANSFER ENCODING TEST PASSED");
console.log(
  "No RPC call, transaction signing, or broadcast was performed.",
);
