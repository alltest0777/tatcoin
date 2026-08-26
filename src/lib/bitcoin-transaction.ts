import { bytesToHex } from "@noble/hashes/utils.js";
import * as btc from "@scure/btc-signer";
import { pubECDSA } from "@scure/btc-signer/utils.js";

import type { BitcoinUtxo } from "../services/bitcoin";

export interface PlanBitcoinTransactionParams {
  fromAddress: string;
  toAddress: string;

  amountSats: bigint;
  feeRate: number;

  utxos: BitcoinUtxo[];
}

export interface BitcoinTransactionPlan {
  selectedUtxos: BitcoinUtxo[];

  inputTotalSats: bigint;
  amountSats: bigint;
  feeSats: bigint;
  changeSats: bigint;

  feeRate: number;
  estimatedVBytes: number;

  inputCount: number;
  outputCount: number;
}

export interface BuildBitcoinTransactionParams
  extends PlanBitcoinTransactionParams {
  privateKey: Uint8Array;
}

export interface BuiltBitcoinTransaction {
  rawTxHex: string;
  txid: string;

  feeSats: bigint;
  changeSats: bigint;

  inputCount: number;
  outputCount: number;
}

const DUST_LIMIT = 546n;

function assertPositiveInteger(
  value: bigint,
  label: string,
): void {
  if (value <= 0n) {
    throw new Error(
      `${label} must be greater than zero`,
    );
  }
}

function assertBitcoinAddress(
  address: string,
  label: string,
): void {
  if (!/^bc1[a-z0-9]+$/i.test(address.trim())) {
    throw new Error(
      `Invalid Bitcoin ${label} address`,
    );
  }
}

function estimateP2wpkhVBytes(
  inputCount: number,
  outputCount: number,
): number {
  /*
   * Native SegWit P2WPKH estimate:
   *
   * transaction overhead ~10 vB
   * each input ~68 vB
   * each output ~31 vB
   *
   * Before broadcast we will use the real signed
   * transaction as the final source of truth.
   */
  return (
    10 +
    inputCount * 68 +
    outputCount * 31
  );
}

function calculateFee(
  inputCount: number,
  outputCount: number,
  feeRate: number,
): bigint {
  if (
    !Number.isFinite(feeRate) ||
    feeRate <= 0
  ) {
    throw new Error(
      "Invalid Bitcoin fee rate",
    );
  }

  const vbytes =
    estimateP2wpkhVBytes(
      inputCount,
      outputCount,
    );

  return BigInt(
    Math.ceil(vbytes * feeRate),
  );
}

export function planBitcoinTransaction(
  params: PlanBitcoinTransactionParams,
): BitcoinTransactionPlan {
  const {
    fromAddress,
    toAddress,
    amountSats,
    feeRate,
    utxos,
  } = params;

  assertPositiveInteger(
    amountSats,
    "Bitcoin amount",
  );

  assertBitcoinAddress(
    fromAddress,
    "sender",
  );

  assertBitcoinAddress(
    toAddress,
    "recipient",
  );

  if (
    !Number.isFinite(feeRate) ||
    feeRate <= 0
  ) {
    throw new Error(
      "Invalid Bitcoin fee rate",
    );
  }

  const confirmedUtxos =
    utxos.filter(
      (utxo) => utxo.status.confirmed,
    );

  if (confirmedUtxos.length === 0) {
    throw new Error(
      "No confirmed Bitcoin UTXOs available",
    );
  }

  /*
   * Simple deterministic coin selection:
   * largest confirmed UTXOs first.
   */
  const sorted =
    [...confirmedUtxos].sort(
      (a, b) => b.value - a.value,
    );

  const selected: BitcoinUtxo[] = [];

  let inputTotalSats = 0n;

  for (const utxo of sorted) {
    selected.push(utxo);

    inputTotalSats +=
      BigInt(utxo.value);

    /*
     * Preferred case: recipient + change.
     */
    const feeWithChange =
      calculateFee(
        selected.length,
        2,
        feeRate,
      );

    const changeWithChange =
      inputTotalSats -
      amountSats -
      feeWithChange;

    if (changeWithChange >= DUST_LIMIT) {
      return {
        selectedUtxos: selected,

        inputTotalSats,
        amountSats,
        feeSats: feeWithChange,
        changeSats: changeWithChange,

        feeRate,
        estimatedVBytes:
          estimateP2wpkhVBytes(
            selected.length,
            2,
          ),

        inputCount: selected.length,
        outputCount: 2,
      };
    }

    /*
     * If the remainder would be dust, omit the
     * change output and add that remainder to fee.
     */
    const minimumOneOutputFee =
      calculateFee(
        selected.length,
        1,
        feeRate,
      );

    const remainderWithoutChange =
      inputTotalSats -
      amountSats -
      minimumOneOutputFee;

    if (
      remainderWithoutChange >= 0n &&
      remainderWithoutChange < DUST_LIMIT
    ) {
      return {
        selectedUtxos: selected,

        inputTotalSats,
        amountSats,

        /*
         * With no change output, every satoshi not
         * sent to the recipient becomes network fee.
         */
        feeSats:
          inputTotalSats -
          amountSats,

        changeSats: 0n,

        feeRate,
        estimatedVBytes:
          estimateP2wpkhVBytes(
            selected.length,
            1,
          ),

        inputCount: selected.length,
        outputCount: 1,
      };
    }
  }

  throw new Error(
    "Insufficient Bitcoin balance",
  );
}

export function buildSignedBitcoinTransaction(
  params: BuildBitcoinTransactionParams,
): BuiltBitcoinTransaction {
  const {
    privateKey,
    fromAddress,
    toAddress,
  } = params;

  const plan =
    planBitcoinTransaction(params);

  const publicKey =
    pubECDSA(privateKey);

  const payment =
    btc.p2wpkh(publicKey);

  if (!payment.script) {
    throw new Error(
      "Failed to build Bitcoin sender script",
    );
  }

  if (
    payment.address &&
    payment.address !== fromAddress.trim()
  ) {
    throw new Error(
      "Bitcoin private key does not match sender address",
    );
  }

  const transaction =
    new btc.Transaction();

  for (const utxo of plan.selectedUtxos) {
    transaction.addInput({
      txid: utxo.txid,
      index: utxo.vout,

      witnessUtxo: {
        script: payment.script,
        amount: BigInt(utxo.value),
      },
    });
  }

  transaction.addOutputAddress(
    toAddress.trim(),
    plan.amountSats,
  );

  if (plan.changeSats > 0n) {
    transaction.addOutputAddress(
      fromAddress.trim(),
      plan.changeSats,
    );
  }

  for (
    let index = 0;
    index < plan.selectedUtxos.length;
    index += 1
  ) {
    transaction.signIdx(
      privateKey,
      index,
    );
  }

  transaction.finalize();

  const rawTx =
    transaction.extract();

  return {
    rawTxHex:
      bytesToHex(rawTx),

    txid:
      transaction.id,

    feeSats:
      plan.feeSats,

    changeSats:
      plan.changeSats,

    inputCount:
      plan.inputCount,

    outputCount:
      plan.outputCount,
  };
}
