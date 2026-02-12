/**
 * Sooth RPC Proxy — Cloudflare Worker
 * Proxies JSON-RPC requests to the real RPC endpoint.
 * Protects the RPC URL from being exposed in client bundles.
 */

interface Env {
  ALLOWED_ORIGINS: string;
  MONAD_RPC_URL: string;       // Set as secret: wrangler secret put MONAD_RPC_URL
  BASE_SEPOLIA_RPC_URL: string; // Set as secret: wrangler secret put BASE_SEPOLIA_RPC_URL
}

const ALLOWED_METHODS = new Set([
  'eth_call',
  'eth_getBalance',
  'eth_getBlockByNumber',
  'eth_getBlockByHash',
  'eth_blockNumber',
  'eth_chainId',
  'eth_getCode',
  'eth_getLogs',
  'eth_getStorageAt',
  'eth_getTransactionByHash',
  'eth_getTransactionCount',
  'eth_getTransactionReceipt',
  'eth_estimateGas',
  'eth_gasPrice',
  'eth_maxPriorityFeePerGas',
  'eth_feeHistory',
  'eth_sendRawTransaction',
  'net_version',
]);

function corsHeaders(origin: string | null, allowedOrigins: string[]): Record<string, string> {
  const headers: Record<string, string> = {
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
  };
  if (origin && allowedOrigins.some(o => origin === o || origin.endsWith(o.replace('https://', '.').replace('http://', '.')))) {
    headers['Access-Control-Allow-Origin'] = origin;
  }
  return headers;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const allowedOrigins = env.ALLOWED_ORIGINS.split(',').map(o => o.trim());
    const origin = request.headers.get('Origin');
    const cors = corsHeaders(origin, allowedOrigins);

    // CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: cors });
    }

    if (request.method !== 'POST') {
      return new Response('Method not allowed', { status: 405, headers: cors });
    }

    // Check origin
    if (origin && !allowedOrigins.includes(origin)) {
      return new Response('Forbidden', { status: 403, headers: cors });
    }

    // Parse chain from path: /monad or /base-sepolia
    const url = new URL(request.url);
    const chain = url.pathname.replace('/', '').toLowerCase();

    let rpcUrl: string;
    switch (chain) {
      case 'monad':
      case 'monad-testnet':
      case '10143':
        rpcUrl = env.MONAD_RPC_URL;
        break;
      case 'base-sepolia':
      case '84532':
        rpcUrl = env.BASE_SEPOLIA_RPC_URL;
        break;
      default:
        // Default to monad
        rpcUrl = env.MONAD_RPC_URL;
    }

    if (!rpcUrl) {
      return new Response(JSON.stringify({ error: 'RPC not configured' }), {
        status: 500,
        headers: { ...cors, 'Content-Type': 'application/json' },
      });
    }

    // Parse and validate JSON-RPC request
    let body: any;
    try {
      body = await request.json();
    } catch {
      return new Response(JSON.stringify({ error: 'Invalid JSON' }), {
        status: 400,
        headers: { ...cors, 'Content-Type': 'application/json' },
      });
    }

    // Validate methods (support batch requests)
    const requests = Array.isArray(body) ? body : [body];
    for (const req of requests) {
      if (!ALLOWED_METHODS.has(req.method)) {
        return new Response(JSON.stringify({
          jsonrpc: '2.0',
          error: { code: -32601, message: `Method not allowed: ${req.method}` },
          id: req.id,
        }), {
          status: 403,
          headers: { ...cors, 'Content-Type': 'application/json' },
        });
      }
    }

    // Forward to real RPC
    const rpcResponse = await fetch(rpcUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    const responseBody = await rpcResponse.text();

    return new Response(responseBody, {
      status: rpcResponse.status,
      headers: {
        ...cors,
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store',
      },
    });
  },
};
