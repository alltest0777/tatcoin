import { Transaction } from "ethers";

const rawTx =
  "0x02f86f0180830186a084056d83e282520894b6bc801aa2876ccb65ebc7415f0a077ea2beef218609184e72a00080c080a050f1db829d931b9ae7c85f676f92423260fc31dbc746ed19d5419d2c74771eb5a04267dd5dceafbcd9112ff0d4aaef995895c7e10fa8bc5511a00e861475d3636f";

const expectedAddress =
  "0xb6bC801Aa2876Ccb65EbC7415F0a077EA2beef21";

const expectedTxid =
  "0xabac3e78d13d679c8dc67213afd930ba5341d3cc29f31281a5962a0531e1867a";

const tx = Transaction.from(rawTx);

console.log("");
console.log("TatCoin Wallet ETH UI transaction verification");
console.log("----------------------------------------------");
console.log("Type:", tx.type);
console.log("Chain ID:", tx.chainId.toString());
console.log("Nonce:", tx.nonce);
console.log("From:", tx.from);
console.log("To:", tx.to);
console.log("Value:", tx.value.toString(), "wei");
console.log("Gas limit:", tx.gasLimit.toString());
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

if (tx.type !== 2) {
  throw new Error("Expected EIP-1559 type 2 transaction");
}

if (tx.chainId !== 1n) {
  throw new Error("Expected Ethereum Mainnet chain ID 1");
}

if (tx.nonce !== 0) {
  throw new Error("Unexpected nonce");
}

if (
  tx.from?.toLowerCase() !==
  expectedAddress.toLowerCase()
) {
  throw new Error("Recovered sender does not match wallet");
}

if (
  tx.to?.toLowerCase() !==
  expectedAddress.toLowerCase()
) {
  throw new Error("Recipient does not match expected address");
}

if (tx.value !== 10_000_000_000_000n) {
  throw new Error("Expected value 0.00001 ETH");
}

if (tx.gasLimit !== 21_000n) {
  throw new Error("Expected gas limit 21000");
}

if (tx.data !== "0x") {
  throw new Error("Expected empty transaction data");
}

if (
  tx.hash?.toLowerCase() !==
  expectedTxid.toLowerCase()
) {
  throw new Error("TXID does not match TatCoin Wallet");
}

console.log("");
console.log("✅ ETH UI TRANSACTION VERIFIED");
console.log("Signature recovered the expected wallet.");
console.log("TXID matches TatCoin Wallet.");
console.log("No transaction was broadcast.");
