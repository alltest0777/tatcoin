import {
  formatUsdtBalance,
  getUsdtBalance,
  USDT_CONTRACT_ADDRESS,
} from "../src/services/usdt";

const address =
  "0xb6bC801Aa2876Ccb65EbC7415F0a077EA2beef21";

async function main() {
  const balance = await getUsdtBalance(address);

  console.log("USDT ERC-20 balance test");
  console.log("------------------------");
  console.log(`Contract: ${USDT_CONTRACT_ADDRESS}`);
  console.log(`Address: ${address}`);
  console.log(`Raw balance: ${balance.toString()}`);
  console.log(`Formatted: ${formatUsdtBalance(balance)} USDT`);
  console.log("");
  console.log("✅ USDT BALANCE TEST PASSED");
  console.log("Read-only eth_call. No transaction was signed or broadcast.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
