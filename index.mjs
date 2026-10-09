// apex-arc: five calls for apps on Arc, by APEX Faucet (agent #1 in Arc's ERC-8004 registry). https://apexfaucet.xyz/arc/build/
// Two ways to pay: an API key (a prepaid pass, https://apexfaucet.xyz/pass/ : plain fetch, no wallet), or per call over x402
// from a wallet with a little USDC on Arc (for agents). Every call is a real read of Arc mainnet.
const BASE = 'https://apexfaucet.xyz/api/x402/'

export function createApexArc({ apiKey, payer, network = 'eip155:5042' } = {}) {
  if (!apiKey && !payer) throw new Error('pass { apiKey } (a prepaid key from https://apexfaucet.xyz/pass/) or { payer } (a private key or viem account with USDC on Arc)')
  let payFetch = null
  async function call(path, params) {
    const q = new URLSearchParams(Object.entries(params).filter(([, v]) => v != null && v !== ''))
    const url = BASE + path + '?' + q
    let res
    if (apiKey) res = await fetch(url, { headers: { Authorization: 'Bearer ' + apiKey } })
    else {
      if (!payFetch) {   // the x402 client is only loaded when a wallet pays
        const [{ x402Client, wrapFetchWithPayment }, { registerExactEvmScheme }, { privateKeyToAccount }] = await Promise.all([import('@x402/fetch'), import('@x402/evm/exact/client'), import('viem/accounts')])
        const client = new x402Client()
        registerExactEvmScheme(client, { signer: typeof payer === 'string' ? privateKeyToAccount(payer) : payer, networks: [network] })
        payFetch = wrapFetchWithPayment(fetch, client)
      }
      res = await payFetch(url)
    }
    const body = await res.json().catch(() => null)
    const data = body && (body.data ?? body)
    if (!res.ok || !body || body.ok === false || !data || data.ok === false) {
      const pr = res.headers.get('payment-required')   // a refused x402 payment says why here (e.g. insufficient_funds)
      let prWhy = null; try { prWhy = pr ? JSON.parse(Buffer.from(pr, 'base64').toString()).error : null } catch {}
      const why = (body && body.pass && body.pass.error) || prWhy || (data && data.error) || (body && body.error) || ('HTTP ' + res.status)
      const err = new Error('apex-arc ' + path + ': ' + why); err.status = res.status; err.body = body; throw err
    }
    return data
  }
  return {
    // Before sending: { verdict: 'stop'|'check'|'ok', reasons: [{ level, key, message }] }, most severe first. Throws if unreadable:
    // do not send then.
    sendGuard: ({ from, to, token }) => call('arc-send-guard', { from, to, token }),
    // USD price from the token's deepest Uniswap v4 USDC pool, with change24h and liquidity warnings.
    tokenPrice: (token) => call('arc-price', { token }),
    // What an address holds, in USD per token.
    walletBalance: (address) => call('arc-wallet', { address }),
    // The last 50 transfers with USD then and now, net flow per token, fake USDC and address-poisoning flags.
    walletHistory: (address, { before } = {}) => call('arc-transfers', { address, before }),
    // What a token is: name, supply, Circle's or not, who launched it, pools, risk signals.
    tokenInfo: (token) => call('arc-token-info', { token }),
  }
}
