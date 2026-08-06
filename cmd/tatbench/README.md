# TatBench

TatBench is a command-line benchmark and stress-testing tool for TatCoin and other compatible Cosmos SDK / CometBFT nodes.

Current version: **1.0.0**

## Features

### RPC benchmark

Measures HTTP RPC performance:

- total requests
- successful and failed requests
- requests per second
- minimum latency
- average latency
- P95 latency
- P99 latency
- maximum latency

### Transaction benchmark

Supports:

- sequential bank-send transactions
- parallel transactions from independent accounts
- transaction confirmation tracking
- CheckTx and DeliverTx error detection
- gas-used and gas-wanted statistics
- P50, P95, and P99 confirmation latency
- transaction distribution by block
- peak transactions per block

### Account management

Supports:

- creating benchmark accounts
- funding account ranges
- listing account addresses
- querying account balances
- deleting benchmark accounts with explicit confirmation

### Long-running tests

Supports:

- soak tests with repeated transaction rounds
- spam/burst tests without pauses between rounds

## Build

From the TatCoin repository root:

```bash
go build -o tatbench ./cmd/tatbench
