import type { OfflineDirectSigner } from "@cosmjs/proto-signing";
import {
  GasPrice,
  SigningStargateClient,
  calculateFee,
} from "@cosmjs/stargate";

export const RPC_URL =
  `${window.location.protocol}//${window.location.host}/rpc/`;

export const BASE_DENOM = "utat";
export const GAS_PRICE = "0.025utat";
export const GAS_ADJUSTMENT = 1.4;

export interface SendTatParams {
  signer: OfflineDirectSigner;
  fromAddress: string;
  toAddress: string;
  amountUtat: string;
}

export interface SendFeeEstimate {
  simulatedGas: number;
  gasLimit: number;
  feeUtat: string;
}

export interface SendTatResult {
  transactionHash: string;
  height: number;
  gasUsed: bigint;
  gasWanted: bigint;
}

function createSendMessage(
  fromAddress: string,
  toAddress: string,
  amountUtat: string,
) {
  return {
    typeUrl: "/cosmos.bank.v1beta1.MsgSend",
    value: {
      fromAddress,
      toAddress,
      amount: [
        {
          denom: BASE_DENOM,
          amount: amountUtat,
        },
      ],
    },
  };
}

export async function estimateSendFee({
  signer,
  fromAddress,
  toAddress,
  amountUtat,
}: SendTatParams): Promise<SendFeeEstimate> {
  const client = await SigningStargateClient.connectWithSigner(
    RPC_URL,
    signer,
    {
      gasPrice: GasPrice.fromString(GAS_PRICE),
    },
  );

  try {
    const message = createSendMessage(
      fromAddress,
      toAddress,
      amountUtat,
    );

    const simulatedGas = await client.simulate(
      fromAddress,
      [message],
      "",
    );

    const gasLimit = Math.ceil(
      simulatedGas * GAS_ADJUSTMENT,
    );

    const fee = calculateFee(
      gasLimit,
      GasPrice.fromString(GAS_PRICE),
    );

    const feeCoin = fee.amount.find(
      (coin) => coin.denom === BASE_DENOM,
    );

    return {
      simulatedGas,
      gasLimit,
      feeUtat: feeCoin?.amount ?? "0",
    };
  } finally {
    client.disconnect();
  }
}

export async function sendTat({
  signer,
  fromAddress,
  toAddress,
  amountUtat,
}: SendTatParams): Promise<SendTatResult> {
  const client = await SigningStargateClient.connectWithSigner(
    RPC_URL,
    signer,
    {
      gasPrice: GasPrice.fromString(GAS_PRICE),
    },
  );

  try {
    const message = createSendMessage(
      fromAddress,
      toAddress,
      amountUtat,
    );

    const simulatedGas = await client.simulate(
      fromAddress,
      [message],
      "",
    );

    const gasLimit = Math.ceil(
      simulatedGas * GAS_ADJUSTMENT,
    );

    const fee = calculateFee(
      gasLimit,
      GasPrice.fromString(GAS_PRICE),
    );

    const result = await client.signAndBroadcast(
      fromAddress,
      [message],
      fee,
      "",
    );

    if (result.code !== 0) {
      throw new Error(
        `Transaction failed: code=${result.code} log=${result.rawLog}`,
      );
    }

    return {
      transactionHash: result.transactionHash,
      height: result.height,
      gasUsed: result.gasUsed,
      gasWanted: result.gasWanted,
    };
  } finally {
    client.disconnect();
  }
}
