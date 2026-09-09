import { Transaction } from "ethers";

const rawTx = process.argv[2];

if (!rawTx) {
  throw new Error("Usage: npx tsx scripts/verify-usdt-sign.ts <rawTxHex>");
}

const tx = Transaction.from(rawTx);

console.log("USDT signed transaction verification");
console.log("-----------------------------------");
console.log("Hash:", tx.hash);
console.log("From:", tx.from);
console.log("To:", tx.to);
console.log("Chain ID:", tx.chainId?.toString());
console.log("Nonce:", tx.nonce);
console.log("Value:", tx.value.toString());
console.log("Gas limit:", tx.gasLimit.toString());
console.log("Max fee per gas:", tx.maxFeePerGas?.toString());
console.log("Max priority fee per gas:", tx.maxPriorityFeePerGas?.toString());
console.log("Data:", tx.data);

if (tx.chainId !== 1n) {
  throw new Error("Unexpected chain ID");
}

if (tx.to?.toLowerCase() !== "0xdac17f958d2ee523a2206206994597c13d831ec7") {
  throw new Error("Transaction is not addressed to USDT contract");
}

if (tx.value !== 0n) {
  throw new Error("USDT transfer must send 0 ETH");
}

if (!tx.data.startsWith("0xa9059cbb")) {
  throw new Error("Transaction data is not ERC-20 transfer()");
}

console.log("");
console.log("✅ USDT RAW TRANSACTION STRUCTURE PASSED");
console.log("No broadcast was performed.");
