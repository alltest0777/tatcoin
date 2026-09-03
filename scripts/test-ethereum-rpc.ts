import {
  getEthereumTransactionFee,
} from "../src/services/ethereum";

const address =
  "0xb6bC801Aa2876Ccb65EbC7415F0a077EA2beef21";

function weiToGwei(
  value: bigint,
): string {
  const divisor =
    1_000_000_000n;

  const whole =
    value / divisor;

  const fraction =
    value % divisor;

  return `${whole}.${fraction
    .toString()
    .padStart(9, "0")}`;
}

function weiToEth(
  value: bigint,
): string {
  const divisor =
    1_000_000_000_000_000_000n;

  const whole =
    value / divisor;

  const fraction =
    value % divisor;

  return `${whole}.${fraction
    .toString()
    .padStart(18, "0")}`;
}

async function main() {
  const fee =
    await getEthereumTransactionFee({
      from: address,
      to: address,
      value: 0n,
    });

  console.log("Ethereum EIP-1559 fee test");
  console.log("-------------------------");

  console.log(
    "Chain ID:",
    fee.chainId.toString(),
  );

  console.log(
    "Nonce:",
    fee.nonce.toString(),
  );

  console.log(
    "Gas limit:",
    fee.gasLimit.toString(),
  );

  console.log(
    "Base fee:",
    weiToGwei(
      fee.baseFeePerGas,
    ),
    "Gwei",
  );

  console.log(
    "Priority fee:",
    weiToGwei(
      fee.maxPriorityFeePerGas,
    ),
    "Gwei",
  );

  console.log(
    "Max fee per gas:",
    weiToGwei(
      fee.maxFeePerGas,
    ),
    "Gwei",
  );

  console.log(
    "Maximum transaction fee:",
    weiToEth(
      fee.estimatedFee,
    ),
    "ETH",
  );

  console.log("");
  console.log(
    "✅ EIP-1559 FEE TEST PASSED",
  );
  console.log(
    "No transaction was signed or broadcast.",
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
