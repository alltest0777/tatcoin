import {
  estimateUsdtTransferGas,
  parseUsdtAmount,
} from "../src/services/usdt";

const from =
  "0x47ac0Fb4F2D84898e4d9E7b4DaB3C24507a6D503";

const recipient =
  "0xb6bC801Aa2876Ccb65EbC7415F0a077EA2beef21";

async function main() {
  const amount = parseUsdtAmount("1");

  const gas = await estimateUsdtTransferGas(
    from,
    recipient,
    amount,
  );

  console.log("USDT ERC-20 gas estimation test");
  console.log("-------------------------------");
  console.log(`From: ${from}`);
  console.log(`Recipient: ${recipient}`);
  console.log(`Amount: 1 USDT`);
  console.log(`Estimated gas: ${gas.toString()}`);
  console.log("");
  console.log("✅ USDT GAS ESTIMATION TEST PASSED");
  console.log(
    "Read-only eth_estimateGas. No transaction was signed or broadcast.",
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
