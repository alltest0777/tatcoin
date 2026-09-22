# TatCoin Wallet Swap Proxy

The Swap proxy keeps the 0x API key outside the browser and exposes only the
Ethereum Mainnet ETH/USDT routes required by TatCoin Wallet.

## Environment

Create the protected environment file:

    sudo install -d -m 750 -o root -g ubuntu /etc/tatcoin-wallet
    sudo nano /etc/tatcoin-wallet/swap-proxy.env

File contents:

    ZEROX_API_KEY=replace_with_your_0x_api_key
    SWAP_PROXY_PORT=8787

Protect the file:

    sudo chown root:ubuntu /etc/tatcoin-wallet/swap-proxy.env
    sudo chmod 640 /etc/tatcoin-wallet/swap-proxy.env

Never commit this environment file or expose the API key to frontend code.

## Swap fee

TatCoin Wallet supports an optional 0.25% integrator fee (25 basis points)
for both ETH/USDT swap directions. The fee token is USDT on Ethereum Mainnet.

Treasury address:

    0xF87eF9F9217f27C8C48276C4f7fb8fAe61dDB8C6

The rate, recipient and fee token are configured in `server/swap-proxy.mjs`.
They cannot be overridden through client request parameters.

To enable the fee, add this line to
`/etc/tatcoin-wallet/swap-proxy.env`:

    SWAP_FEE_ENABLED=true

The fee is disabled when this variable is absent or is not exactly `true`.
To disable it explicitly:

    SWAP_FEE_ENABLED=false

Restart the proxy after changing the environment file:

    sudo systemctl restart tatcoin-swap-proxy.service

The wallet displays the returned integrator fee and the separate 0x fee
before signing. Ethereum network fees are shown separately.

The `integratorFee` and `integratorFees` fields in the current provider
response describe the same configured fee; do not add them together.

The health endpoint confirms service availability and API key configuration.
Verify fee activation using a fresh price or quote response.

A completed 1 USDT → ETH swap on Ethereum Mainnet was verified.
The successful transaction receipt contains one USDT transfer of
0.0025 USDT to the configured treasury, matching the 0.25% fee.

Transaction: `0x199c1a9d151283d43f4d2fe99df19ae4a877b621d699020a57644a01388df77b`
Block: `26035467`

Treasury receipt for the ETH → USDT direction has not yet been verified.

## Route selection

Set `SWAP_ROUTE_MODE` in `/etc/tatcoin-wallet/swap-proxy.env`:

- `default`: request the standard 0x route. Used when unset or empty.
- `uniswap_v3`: exclude all listed sources except Uniswap V3 for both directions.
- `auto`: compare the standard route with a Uniswap V3 alternative
  for USDT → ETH only. ETH → USDT uses the standard route.

Example:

    SWAP_ROUTE_MODE=auto

Restart the proxy after changing this setting.

### Automatic comparison

Both candidates are validated against the requested tokens and sell amount.
The alternative must use only Uniswap V3 and report matching integrator
and 0x fees.

Candidates are ranked by expected ETH output minus estimated network cost.
A common gas price is used: the higher of the two values derived from
`totalNetworkFee / gas`, rounded upward. Equal scores retain the standard route.

This is an estimate, not a guarantee of the lowest actual transaction cost.
The wallet separately estimates transaction fees through Ethereum RPC
before signing.

A valid standard response is retained if the alternative is unavailable,
invalid, incompatible, or the comparison fails. Failure of the initial
standard request is not recovered by trying the alternative.

For `/price`, a missing allowance does not prevent comparison.
For `/quote`, comparison requires no reported allowance issue.

Automatic comparison currently makes up to three sequential provider
requests: standard quote, source list, and alternative quote. They share
a 10-second timeout. The source list is not cached.

Diagnostic `[swap-route]` logs show completed comparisons and caught
comparison failures. Some early returns retain the standard response
without a diagnostic message.

### Verification

Run the local tests:

    node --test server/swap-route-selection.test.mjs server/swap-route-provider.test.mjs

Automatic selection has been observed with live USDT → ETH price requests.
Quote selection and invalid-target fallback have been tested with mocked
responses. A USDT → ETH swap completed successfully while the production
proxy was configured in auto mode; its treasury fee transfer was verified.
The selected route for that specific swap was not separately recorded.

## systemd

Check the installed Node path:

    command -v node

Create `/etc/systemd/system/tatcoin-swap-proxy.service`:

    [Unit]
    Description=TatCoin Wallet Swap Proxy
    Wants=network-online.target
    After=network-online.target

    [Service]
    Type=simple
    User=ubuntu
    Group=ubuntu
    WorkingDirectory=/home/ubuntu/tatcoin-wallet
    EnvironmentFile=/etc/tatcoin-wallet/swap-proxy.env
    ExecStart=/home/ubuntu/.nvm/versions/node/v24.19.0/bin/node /home/ubuntu/tatcoin-wallet/server/swap-proxy.mjs
    Restart=on-failure
    RestartSec=5
    NoNewPrivileges=true
    PrivateTmp=true
    ProtectSystem=strict
    ProtectHome=read-only
    ProtectKernelTunables=true
    ProtectKernelModules=true
    ProtectControlGroups=true
    RestrictSUIDSGID=true
    LockPersonality=true
    RestrictRealtime=true
    UMask=0077

    [Install]
    WantedBy=multi-user.target

If Node is upgraded, update `ExecStart` to the path returned by
`command -v node`.

Enable and verify:

    sudo systemctl daemon-reload
    sudo systemctl enable --now tatcoin-swap-proxy.service
    sudo systemctl status tatcoin-swap-proxy.service --no-pager -l
    curl -s http://127.0.0.1:8787/health

## Nginx

Add this location to the HTTPS `server` block:

    location /api/swap/ {
        proxy_pass http://127.0.0.1:8787/;
        proxy_http_version 1.1;

        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        proxy_connect_timeout 5s;
        proxy_read_timeout 15s;
        proxy_send_timeout 15s;
    }

Validate and reload:

    sudo nginx -t
    sudo systemctl reload nginx
    curl -s https://tat-coin.duckdns.org/api/swap/health

## Deployment

Build and deploy:

    cd /home/ubuntu/tatcoin-wallet
    npm run lint
    npm run build
    sudo rsync -a --delete dist/ /var/www/tatcoin-wallet/
    sudo systemctl restart tatcoin-swap-proxy.service

## Security model

- The 0x API key remains server-side.
- The proxy supports only Ethereum Mainnet ETH/USDT pairs.
- Responses are checked against the requested tokens and amount.
- USDT approvals are restricted to the official 0x AllowanceHolder.
- The wallet approves only the exact USDT sell amount.
- Never approve the 0x Settler transaction address.
- Recovery phrases and private keys remain in the browser.
