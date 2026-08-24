import type { OfflineDirectSigner } from "@cosmjs/proto-signing";
import {
  GasPrice,
  SigningStargateClient,
  calculateFee,
} from "@cosmjs/stargate";

export const REST_URL =
  `${window.location.protocol}//${window.location.host}/cosmos`;

export const RPC_URL =
  `${window.location.protocol}//${window.location.host}/rpc/`;

export const BASE_DENOM = "utat";
export const GAS_PRICE = "0.025utat";
export const GAS_ADJUSTMENT = 1.4;

export interface TatValidator {
  operatorAddress: string;
  moniker: string;
  status: string;
  tokens: string;
  jailed: boolean;
}

export interface TatDelegation {
  validatorAddress: string;
  amountUtat: string;
}

export interface TatReward {
  validatorAddress: string;
  amountUtat: string;
}

export interface TatUnbonding {
  validatorAddress: string;
  balanceUtat: string;
  initialBalanceUtat: string;
  completionTime: string;
  creationHeight: string;
  unbondingId: string;
}

async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }

  return response.json() as Promise<T>;
}

export async function getValidators(): Promise<TatValidator[]> {
  const data = await fetchJson<{
    validators?: Array<{
      operator_address?: string;
      jailed?: boolean;
      status?: string;
      tokens?: string;
      description?: {
        moniker?: string;
      };
    }>;
  }>(
    `${REST_URL}/staking/v1beta1/validators?status=BOND_STATUS_BONDED`,
  );

  return (data.validators ?? []).map((validator) => ({
    operatorAddress: validator.operator_address ?? "",
    moniker: validator.description?.moniker ?? "Unknown validator",
    status: validator.status ?? "",
    tokens: validator.tokens ?? "0",
    jailed: validator.jailed ?? false,
  }));
}

export async function getDelegations(
  address: string,
): Promise<TatDelegation[]> {
  const data = await fetchJson<{
    delegation_responses?: Array<{
      delegation?: {
        validator_address?: string;
      };
      balance?: {
        denom?: string;
        amount?: string;
      };
    }>;
  }>(
    `${REST_URL}/staking/v1beta1/delegations/${encodeURIComponent(address)}`,
  );

  return (data.delegation_responses ?? [])
    .filter((item) => item.balance?.denom === "utat")
    .map((item) => ({
      validatorAddress:
        item.delegation?.validator_address ?? "",
      amountUtat: item.balance?.amount ?? "0",
    }));
}

export async function getUnbondings(
  address: string,
): Promise<TatUnbonding[]> {
  const data = await fetchJson<{
    unbonding_responses?: Array<{
      validator_address?: string;
      entries?: Array<{
        balance?: string;
        initial_balance?: string;
        completion_time?: string;
        creation_height?: string;
        unbonding_id?: string;
      }>;
    }>;
  }>(
    `${REST_URL}/staking/v1beta1/delegators/${encodeURIComponent(address)}/unbonding_delegations`,
  );

  return (data.unbonding_responses ?? []).flatMap(
    (item) =>
      (item.entries ?? []).map((entry) => ({
        validatorAddress:
          item.validator_address ?? "",
        balanceUtat:
          entry.balance ?? "0",
        initialBalanceUtat:
          entry.initial_balance ?? "0",
        completionTime:
          entry.completion_time ?? "",
        creationHeight:
          entry.creation_height ?? "0",
        unbondingId:
          entry.unbonding_id ?? "",
      })),
  );
}

export async function getRewards(
  address: string,
): Promise<TatReward[]> {
  const data = await fetchJson<{
    rewards?: Array<{
      validator_address?: string;
      reward?: Array<{
        denom?: string;
        amount?: string;
      }>;
    }>;
  }>(
    `${REST_URL}/distribution/v1beta1/delegators/${encodeURIComponent(address)}/rewards`,
  );

  return (data.rewards ?? []).map((item) => {
    const rewardCoin = item.reward?.find(
      (coin) => coin.denom === "utat",
    );

    return {
      validatorAddress:
        item.validator_address ?? "",
      amountUtat:
        rewardCoin?.amount ?? "0",
    };
  });
}

export interface DelegateTatParams {
  signer: OfflineDirectSigner;
  delegatorAddress: string;
  validatorAddress: string;
  amountUtat: string;
}

export interface DelegateFeeEstimate {
  simulatedGas: number;
  gasLimit: number;
  feeUtat: string;
}

export interface DelegateTatResult {
  transactionHash: string;
  height: number;
  gasUsed: bigint;
  gasWanted: bigint;
}

export interface ClaimRewardsParams {
  signer: OfflineDirectSigner;
  delegatorAddress: string;
  validatorAddress: string;
}

export interface ClaimRewardsResult {
  transactionHash: string;
  height: number;
  gasUsed: bigint;
  gasWanted: bigint;
}

export interface UndelegateTatParams {
  signer: OfflineDirectSigner;
  delegatorAddress: string;
  validatorAddress: string;
  amountUtat: string;
}

export interface UndelegateFeeEstimate {
  simulatedGas: number;
  gasLimit: number;
  feeUtat: string;
}

export interface UndelegateTatResult {
  transactionHash: string;
  height: number;
  gasUsed: bigint;
  gasWanted: bigint;
}

function createUndelegateMessage(
  delegatorAddress: string,
  validatorAddress: string,
  amountUtat: string,
) {
  return {
    typeUrl: "/cosmos.staking.v1beta1.MsgUndelegate",
    value: {
      delegatorAddress,
      validatorAddress,
      amount: {
        denom: BASE_DENOM,
        amount: amountUtat,
      },
    },
  };
}

function createWithdrawRewardMessage(
  delegatorAddress: string,
  validatorAddress: string,
) {
  return {
    typeUrl:
      "/cosmos.distribution.v1beta1.MsgWithdrawDelegatorReward",
    value: {
      delegatorAddress,
      validatorAddress,
    },
  };
}

function createDelegateMessage(
  delegatorAddress: string,
  validatorAddress: string,
  amountUtat: string,
) {
  return {
    typeUrl: "/cosmos.staking.v1beta1.MsgDelegate",
    value: {
      delegatorAddress,
      validatorAddress,
      amount: {
        denom: BASE_DENOM,
        amount: amountUtat,
      },
    },
  };
}

export async function estimateDelegateFee({
  signer,
  delegatorAddress,
  validatorAddress,
  amountUtat,
}: DelegateTatParams): Promise<DelegateFeeEstimate> {
  const client = await SigningStargateClient.connectWithSigner(
    RPC_URL,
    signer,
    {
      gasPrice: GasPrice.fromString(GAS_PRICE),
    },
  );

  try {
    const message = createDelegateMessage(
      delegatorAddress,
      validatorAddress,
      amountUtat,
    );

    const simulatedGas = await client.simulate(
      delegatorAddress,
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

export async function delegateTat({
  signer,
  delegatorAddress,
  validatorAddress,
  amountUtat,
}: DelegateTatParams): Promise<DelegateTatResult> {
  const client = await SigningStargateClient.connectWithSigner(
    RPC_URL,
    signer,
    {
      gasPrice: GasPrice.fromString(GAS_PRICE),
    },
  );

  try {
    const message = createDelegateMessage(
      delegatorAddress,
      validatorAddress,
      amountUtat,
    );

    const simulatedGas = await client.simulate(
      delegatorAddress,
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
      delegatorAddress,
      [message],
      fee,
      "",
    );

    if (result.code !== 0) {
      throw new Error(
        `Delegation failed: code=${result.code} log=${result.rawLog}`,
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

export async function claimRewards({
  signer,
  delegatorAddress,
  validatorAddress,
}: ClaimRewardsParams): Promise<ClaimRewardsResult> {
  const client = await SigningStargateClient.connectWithSigner(
    RPC_URL,
    signer,
    {
      gasPrice: GasPrice.fromString(GAS_PRICE),
    },
  );

  try {
    const message = createWithdrawRewardMessage(
      delegatorAddress,
      validatorAddress,
    );

    const simulatedGas = await client.simulate(
      delegatorAddress,
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
      delegatorAddress,
      [message],
      fee,
      "",
    );

    if (result.code !== 0) {
      throw new Error(
        `Claim rewards failed: code=${result.code} log=${result.rawLog}`,
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

export async function estimateUndelegateFee({
  signer,
  delegatorAddress,
  validatorAddress,
  amountUtat,
}: UndelegateTatParams): Promise<UndelegateFeeEstimate> {
  const client = await SigningStargateClient.connectWithSigner(
    RPC_URL,
    signer,
    {
      gasPrice: GasPrice.fromString(GAS_PRICE),
    },
  );

  try {
    const message = createUndelegateMessage(
      delegatorAddress,
      validatorAddress,
      amountUtat,
    );

    const simulatedGas = await client.simulate(
      delegatorAddress,
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

export async function undelegateTat({
  signer,
  delegatorAddress,
  validatorAddress,
  amountUtat,
}: UndelegateTatParams): Promise<UndelegateTatResult> {
  const client = await SigningStargateClient.connectWithSigner(
    RPC_URL,
    signer,
    {
      gasPrice: GasPrice.fromString(GAS_PRICE),
    },
  );

  try {
    const message = createUndelegateMessage(
      delegatorAddress,
      validatorAddress,
      amountUtat,
    );

    const simulatedGas = await client.simulate(
      delegatorAddress,
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
      delegatorAddress,
      [message],
      fee,
      "",
    );

    if (result.code !== 0) {
      throw new Error(
        `Undelegation failed: code=${result.code} log=${result.rawLog}`,
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
