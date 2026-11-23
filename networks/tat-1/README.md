# TatCoin Mainnet (tat-1)

Welcome to the official TatCoin mainnet.

`tat-1` is TatCoin's permanent public mainnet. No chain reset or genesis replacement is planned. Earlier testnet descriptions are outdated; the existing chain ID and genesis remain unchanged.

## Network Information

| Parameter | Value |
|-----------|-------|
| Chain ID | tat-1 |
| Binary | tatcoind |
| Bech32 Prefix | tat |
| Base Denomination | utat |
| Display Denomination | TAT |
| Decimals | 6 |

## Node Home

The default node home is `$HOME/.tatcoin`. A different directory can be selected explicitly with `--home`; this does not change the default.

## Genesis

File:

```
genesis.json
```

SHA256:

```
bc463409f88749ef7dcef51028536295a3c752ee1fbf8162346c78422cbe2df7
```

Verify:

```bash
sha256sum genesis.json
```

Expected:

```
bc463409f88749ef7dcef51028536295a3c752ee1fbf8162346c78422cbe2df7
```

## Persistent Peer

```
3d940ce39b642f7cd070325ad605720001676cf8@84.8.220.64:26656
```

## Public Endpoints

RPC

```
http://84.8.220.64:26657
```

REST API

```
http://84.8.220.64:1317
```

## Validator Status

Current validator is running continuously and producing blocks.

## State Sync

See:

```
STATE_SYNC.md
```

## License

MIT
