# TatCoin

🚀 **TatCoin** is a decentralized cryptocurrency built on the **Cosmos SDK** with **Proof-of-Stake** consensus.  
Chain ID: **tat-1**

---

## 🌊 Quick Start (Validator / Full Node)

### 1. Clone & Build
```bash
git clone https://github.com/alltest0777/tatcoin.git
cd tatcoin
make install
```

Binary: tatcorecleand

2. Init Node
```bash
tatcorecleand init <your-moniker> --chain-id tat-1
```
3. Download Genesis & Peers
```bash
# genesis

curl -s https://tat-coin.duckdns.org/genesis.json > ~/.tatcore_tat/config/genesis.json

# peers (list of persistent_peers)
curl -s https://tat-coin.duckdns.org/join-tat-1.txt > ~/.tatcore_tat/config/peers.txt
```
4. Configure Node
Open ~/.tatcore_tat/config/config.toml and set:
```ini
persistent_peers = "<copy from peers.txt>"
```
5. Start Node
```bash
tatcorecleand start
```
🔄 Fast Sync

Use state sync for fast synchronization:
Instructions: [statesync.txt](https://tat-coin.duckdns.org/statesync.txt)

💳 Wallet

Web Wallet: [TatCoin Wallet](https://tat-coin.duckdns.org/wallet)

Create or import a wallet (mnemonic phrase).

Address format: tat1...

📜 Manifesto

Read our official [Manifesto](./MANIFESTO.md)
 🌍⚓

🌐 Network Status

Check the live status of the network here:
👉 [TatCoin Status Page](https://tat-coin.duckdns.org)
