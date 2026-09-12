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
