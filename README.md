<p align="center">
  <img src="docs/logo.svg" alt="TatCoin Logo" width="160">
</p>

<h1 align="center">TatCoin</h1>

<p align="center">
  <strong>Fast • Secure • Open • Cosmos SDK Blockchain</strong>
</p>

<p align="center">
  An open-source blockchain built with the Cosmos SDK and CometBFT.
</p>

<p align="center">
  <a href="https://github.com/alltest0777/tatcore/releases">
    <img src="https://img.shields.io/github/v/release/alltest0777/tatcore?label=Release" alt="Release">
  </a>
  <img src="https://img.shields.io/github/actions/workflow/status/alltest0777/tatcore/release.yml?label=Build" alt="Build">
  <img src="https://img.shields.io/github/license/alltest0777/tatcore" alt="License">
  <img src="https://img.shields.io/badge/Go-1.24+-00ADD8?logo=go" alt="Go">
  <img src="https://img.shields.io/badge/Cosmos%20SDK-v0.53-blue" alt="Cosmos SDK">
</p>

---

# Overview

TatCoin is a modern blockchain built on the Cosmos SDK.

The project is designed to provide a secure, lightweight and extensible blockchain platform that is fully compatible with the Cosmos ecosystem.

TatCoin focuses on:

- High performance
- Decentralization
- Open-source development
- Fast transaction finality
- Validator security
- Ecosystem interoperability

---

# Why TatCoin?

TatCoin combines the reliability of the Cosmos SDK with a clean architecture and modern development workflow.

Our goals are:

- Build an open public blockchain
- Provide simple validator deployment
- Offer fast synchronization using State Sync
- Maintain transparent development
- Deliver reproducible binary releases
- Support future IBC integration

---

# Features

- Cosmos SDK v0.53
- CometBFT consensus
- Native staking
- Governance
- Validator support
- IBC Ready
- Automatic GitHub Releases
- Linux AMD64 binaries
- Linux ARM64 binaries
- SHA256 verification
- State Sync
- Snapshot support
- Public Mainnet
- Open-source development

---

# Architecture

```
                     Wallet
                        │
        ┌───────────────┼───────────────┐
        │                               │
     REST API                        RPC API
        │                               │
        └───────────────┬───────────────┘
                        │
                  TatCoin Node
                        │
                   CometBFT
                        │
          ┌─────────────┴─────────────┐
          │                           │
     Validator A                 Validator B
          │                           │
          └─────────────┬─────────────┘
                        │
                    TatCoin Network
```

---

# Network

TatCoin's permanent public mainnet is `tat-1`. No chain reset or genesis replacement is planned. Earlier descriptions of `tat-1` as a testnet are outdated; the existing chain ID and genesis remain unchanged.

| Parameter | Value |
|-----------|-------|
| Chain ID | `tat-1` |
| Address Prefix | `tat` |
| Base Denom | `utat` |
| Display Denom | `TAT` |
| Decimals | `6` |
| Consensus | CometBFT |
| SDK | Cosmos SDK v0.53 |

---

# Project Status

Current status:

- ✅ Public Mainnet
- ✅ Validator node
- ✅ State Sync
- ✅ GitHub Releases
- ✅ Automatic CI/CD
- ✅ Linux builds
- ✅ ARM64 builds
- ✅ Documentation in progress

---

# Quick Start

Clone the repository:

```bash
git clone https://github.com/alltest0777/tatcore.git
cd tatcore
```

Build and install:

```bash
make install
```

Verify installation:

```bash
tatcoind version
```

You are now ready to initialize a TatCoin node.

---

# Installation

TatCoin requires Go 1.24 or newer.

Install dependencies and build the binary:

```bash
make install
```

The binary will be installed as:

```text
tatcoind
```

Check the installed version:

```bash
tatcoind version
```

---

# Initialize a Node

Create a new node:

```bash
tatcoind init mynode --chain-id tat-1
```

This command creates the local blockchain configuration under:

```text
~/.tatcoin
```

---

# Configure the Network

Download the official network configuration from:

```text
networks/tat-1/
```

This directory contains:

- genesis.json
- genesis.sha256
- peers.txt
- README.md
- STATE_SYNC.md

Copy the genesis file:

```bash
cp networks/tat-1/genesis.json ~/.tatcoin/config/
```

---

# Start the Node

Run:

```bash
tatcoind start
```

If everything is configured correctly, the node will begin synchronizing with the TatCoin Mainnet.

---

# Join the Public Mainnet

Network parameters:

| Parameter | Value |
|-----------|-------|
| Chain ID | tat-1 |
| Address Prefix | tat |
| Base Denom | utat |
| Display Denom | TAT |

The latest network configuration is always available in:

```text
networks/tat-1/
```

---

# State Sync

TatCoin supports fast synchronization using State Sync.

The complete setup guide is available in:

```text
networks/tat-1/STATE_SYNC.md
```

Using State Sync allows new validators and full nodes to synchronize in minutes instead of downloading the entire blockchain history.

---

# Releases

Every Git tag automatically creates a GitHub Release.

Each release includes:

- Linux AMD64 binary
- Linux ARM64 binary
- SHA256 checksums

Example:

```bash
git tag v0.2.0
git push origin v0.2.0
```

Releases are available at:

```text
https://github.com/alltest0777/tatcore/releases
```

---

# Repository Structure

```
.
├── app/
├── cmd/
├── docs/
├── networks/
├── proto/
├── scripts/
├── x/
├── .github/
├── go.mod
├── Makefile
└── README.md
```

---

# Documentation

Additional documentation is available inside the repository.

```
docs/
```

Documentation includes:

- Installation
- Validator Guide
- State Sync
- Snapshots
- API
- RPC
- Wallet
- Explorer
- FAQ

Network-specific documentation is located in:

```
networks/tat-1/
```
---

# Development Philosophy

TatCoin is developed with a simple philosophy:

- Keep the codebase clean and maintainable.
- Follow Cosmos SDK best practices.
- Automate repetitive tasks.
- Make validator deployment simple.
- Build for long-term stability.
- Remain fully open-source.

Every release is built automatically using GitHub Actions to ensure reproducible binaries and transparent development.

---

# Roadmap

## Phase 1 — Foundation ✅

- Cosmos SDK blockchain
- CometBFT consensus
- Public Mainnet
- Validator support
- State Sync
- Automatic GitHub Releases
- Documentation

## Phase 2 — Ecosystem

- Blockchain Explorer
- Web Wallet
- Faucet
- Public API
- Monitoring Dashboard

## Phase 3 — Expansion

- IBC integration
- Additional validators
- Public infrastructure
- Developer SDK
- CLI improvements

## Mainnet maintenance and growth

- Security review
- Network upgrades preserving chain continuity
- Additional validators and infrastructure
- Ecosystem growth

---

# Community

Community resources will continue to grow as the project evolves.

Future services include:

- Official Website
- Documentation Portal
- Explorer
- Wallet
- Faucet
- Developer Documentation

---

# Contributing

Contributions are welcome.

If you would like to contribute:

1. Fork the repository.
2. Create a feature branch.
3. Commit your changes.
4. Push the branch.
5. Open a Pull Request.

Please keep pull requests focused and well documented.

---

# Reporting Issues

Bug reports and feature requests are welcome.

Please use the GitHub Issues page to report:

- Bugs
- Documentation issues
- Feature requests
- Security improvements

---

# Security

If you discover a security vulnerability, please report it privately before opening a public issue.

Responsible disclosure helps protect network participants while fixes are prepared.

A dedicated SECURITY.md document will provide detailed reporting instructions.

---

# License

Licensed under the Apache License 2.0.

See the LICENSE file for details.

---

<p align="center">

**TatCoin**

Fast • Secure • Open

Built with ❤️ using the Cosmos SDK.

</p>
