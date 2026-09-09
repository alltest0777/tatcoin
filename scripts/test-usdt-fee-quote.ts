import {
  getUsdtTransferFeeQuote,
  parseUsdtAmount,
} from "../src/services/usdt";

const from =
  "0x47ac0Fb4F2D84898e4d9E7b4DaB3C24507a6D503";

const recipient =
  "0xb6bC801Aa2876Ccb65EbC7415F0a077EA2beef21";

function weiToEth(value: bigint): string {
  const divisor = 10n ** 18n;
  const whole = value / divisor;
  const fraction = value % divisor;

  return `${whole}.${fraction
    .toString()
    .padStart(18, "0")}`;
}

function weiToGwei(value: bigint): string {
  const divisor = 10n ** 9n;
  const whole = value / divisor;
  const fraction = value % divisor;

  return `${whole}.${fraction
    .toString()
    .padStart(9, "0")}`;
}

async function main() {
  const amount = parseUsdtAmount("1");

  const quote = await getUsdtTransferFeeQuote(
    from,
    recipient,
    amount,
  );

  console.log("USDT ERC-20 fee quote test");
  console.log("--------------------------");
  console.log(`Nonce: ${quote.nonce.toString()}`);
  console.log(`Gas limit: ${quote.gasLimit.toString()}`);
  console.log(
    `Base fee: ${weiToGwei(quote.baseFeePerGas)} Gwei`,
  );
  console.log(
    `Priority fee: ${weiToGwei(
      quote.maxPriorityFeePerGas,
    )} Gwei`,
  );
  console.log(
    `Max fee per gas: ${weiToGwei(
      quote.maxFeePerGas,
    )} Gwei`,
  );
  console.log(
    `Maximum network fee: ${weiToEth(
      quote.maximumNetworkFee,
    )} ETH`,
  );

  console.log("");
  console.log("✅ USDT FEE QUOTE TEST PASSED");
  console.log(
    "Read-only RPC calls only. No transaction was signed or broadcast.",
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
