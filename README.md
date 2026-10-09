# apex-arc

Five calls for apps on Arc, by [APEX Faucet](https://apexfaucet.xyz/arc/build/) (agent #1 in Arc's ERC-8004 registry).

| call | what | price |
|---|---|---|
| `sendGuard({ from, to, token })` | before a send: `stop` / `check` / `ok` with reasons (address-poisoning lookalikes, forged-transfer bait, token contracts, OFAC / USDC blacklist, fake USDC) | $0.001 |
| `tokenPrice(token)` | USD price from the deepest Uniswap v4 USDC pool, 24 h change, liquidity warnings | $0.001 |
| `walletBalance(address)` | what an address holds, in USD per token | $0.002 |
| `walletHistory(address)` | last 50 transfers, USD then and now, net flow, poisoning flags | $0.003 |
| `tokenInfo(token)` | name, supply, Circle's or not, who launched it, pools, risk signals | $0.002 |

```bash
npm install github:apexfaucet-hub/apex-arc
```

## With a key (no wallet)

Buy a prepaid key once at **https://apexfaucet.xyz/pass/** ($5 by card = $5 of calls, e.g. 5,000 price checks). Put it in `.env`.

```js
import { createApexArc } from 'apex-arc'
const apex = createApexArc({ apiKey: process.env.APEX_KEY })

const { verdict, reasons } = await apex.sendGuard({ from, to, token })
if (verdict === 'stop') throw new Error(reasons[0].message)   // do not build the transaction
const { usdPrice, change24h } = await apex.tokenPrice('0x...')
```

No dependencies needed on this path. The same thing with plain fetch:

```js
const r = await fetch('https://apexfaucet.xyz/api/x402/arc-send-guard?from=0x...&to=0x...', { headers: { Authorization: 'Bearer ' + process.env.APEX_KEY } })
const { data } = await r.json()   // data.verdict, data.reasons
```

## With a wallet (agents)

Pay per call over [x402](https://x402.org) in USDC on Arc: `createApexArc({ payer: process.env.PAYER_KEY })`. The x402 client loads only on this path.

## Why the send guard

On 9 Oct 2026 a fake "USDC" contract wrote 64 invented transfers in one Arc transaction, pairing real wallets with lookalikes (same first 6 and
last 5 characters). The trap is that someone copies the lookalike next time they pay. `sendGuard` returns `stop` for it.
Details and CI fixtures: https://apexfaucet.xyz/arc/guard/

Every call reads Arc mainnet live. A failed read throws; it never returns a made-up value. All other tools: https://apexfaucet.xyz/llms.txt
