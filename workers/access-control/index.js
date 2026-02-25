// Sooth Access Control Worker
// Endpoints:
//   GET  /check?wallet=0x...              → { allowed: true/false }
//   POST /approve   { wallet, email? }    → requires auth
//   POST /revoke    { wallet }            → requires auth
//   GET  /list                            → requires auth (approved wallets)
//   GET  /requests                        → requires auth (pending requests)
//   POST /request   { email, wallet? }    → public
//   POST /register  { chainId, rpcUrl, launchpadEngine, operatorName?, contactEmail? } → public (node registration)
//   GET  /nodes/pending                   → requires auth (pending node registrations)
//   GET  /nodes/pending/:nodeId           → requires auth (specific pending node)
//   POST /nodes/pending/:nodeId/approve   → requires auth (approve node)
//   POST /nodes/pending/:nodeId/reject    → requires auth (reject node)
//   GET  /                                → admin dashboard (password protected)

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Content-Type": "application/json",
};

function json(data, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: CORS });
}

function isAdmin(request, env) {
  const auth = request.headers.get("Authorization");
  return auth === `Bearer ${env.ADMIN_SECRET}`;
}

async function computeNodeId(chainId, launchpadEngine) {
  const input = `${chainId}:${launchpadEngine.toLowerCase()}`;
  const encoder = new TextEncoder();
  const bytes = encoder.encode(input);
  const hashBuffer = await crypto.subtle.digest('SHA-256', bytes);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('').slice(0, 8);
}

function dashboard(env) {
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no"/>
  <title>Sooth Access Control</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <link href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;600;700&display=swap" rel="stylesheet"/>
  <style>
    html, body { overflow-x: hidden; }
    body { background: #0a0a0b; color: #fff; font-family: 'JetBrains Mono', monospace; }
  </style>
</head>
<body class="min-h-screen antialiased">
  <div id="login" class="min-h-screen flex items-center justify-center px-4">
    <div class="max-w-sm w-full">
      <h1 class="text-2xl font-bold text-center mb-6 lowercase tracking-tight">sooth access control</h1>
      <input id="secret" type="password" placeholder="admin secret" 
        class="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-sm text-white placeholder-white/20 focus:outline-none focus:border-[#836ef9]/50 mb-3"/>
      <button onclick="login()" class="w-full px-4 py-3 rounded-xl bg-gradient-to-r from-[#836ef9] to-[#00d4aa] text-white font-semibold text-sm hover:opacity-90">
        Login
      </button>
    </div>
  </div>

  <div id="app" class="hidden max-w-4xl mx-auto px-4 py-8">
    <div class="flex items-center justify-between mb-8">
      <h1 class="text-2xl font-bold lowercase tracking-tight">access control</h1>
      <button onclick="logout()" class="text-xs text-white/30 hover:text-white">logout</button>
    </div>

    <!-- Quick approve -->
    <div class="p-5 rounded-2xl bg-white/[0.03] border border-white/5 mb-6">
      <h2 class="text-sm font-semibold text-[#00d4aa] uppercase tracking-widest mb-3">quick approve</h2>
      <div class="flex gap-2">
        <input id="approve-wallet" type="text" placeholder="0x..." class="flex-1 px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-xs text-white placeholder-white/20 focus:outline-none"/>
        <input id="approve-email" type="text" placeholder="email (optional)" class="flex-1 px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-xs text-white placeholder-white/20 focus:outline-none"/>
        <button onclick="approveWallet()" class="px-4 py-2 rounded-lg bg-[#00d4aa]/20 text-[#00d4aa] text-xs font-semibold hover:bg-[#00d4aa]/30">Approve</button>
      </div>
    </div>

    <!-- Tabs -->
    <div class="flex gap-4 mb-4 border-b border-white/5 pb-2">
      <button onclick="showTab('requests')" id="tab-requests" class="text-sm font-semibold text-[#836ef9]">Requests</button>
      <button onclick="showTab('approved')" id="tab-approved" class="text-sm font-semibold text-white/30 hover:text-white/50">Approved</button>
      <button onclick="showTab('nodes')" id="tab-nodes" class="text-sm font-semibold text-white/30 hover:text-white/50">Nodes</button>
    </div>

    <div id="requests-panel"></div>
    <div id="approved-panel" class="hidden"></div>
    <div id="nodes-panel" class="hidden"></div>
    <div id="status" class="text-xs text-white/30 mt-4"></div>
  </div>

  <script>
    let token = '';
    const API = '';

    function login() {
      token = document.getElementById('secret').value;
      if (!token) return;
      document.getElementById('login').classList.add('hidden');
      document.getElementById('app').classList.remove('hidden');
      loadData();
    }

    function logout() {
      token = '';
      document.getElementById('login').classList.remove('hidden');
      document.getElementById('app').classList.add('hidden');
    }

    document.getElementById('secret').addEventListener('keydown', e => { if (e.key === 'Enter') login(); });

    function headers() {
      return { 'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json' };
    }

    async function loadData() {
      await Promise.all([loadRequests(), loadApproved(), loadNodes()]);
    }

    async function loadRequests() {
      try {
        const res = await fetch(API + '/requests', { headers: headers() });
        if (!res.ok) { logout(); return; }
        const data = await res.json();
        const panel = document.getElementById('requests-panel');
        if (!data.entries?.length) {
          panel.innerHTML = '<p class="text-white/20 text-xs">No pending requests</p>';
          return;
        }
        panel.innerHTML = data.entries.map(r => \`
          <div class="p-4 rounded-xl bg-white/[0.03] border border-white/5 mb-2 flex items-center justify-between">
            <div>
              <div class="text-xs text-white/70">\${r.email}</div>
              <div class="text-[10px] text-white/30 font-mono">\${r.wallet || 'no wallet'}</div>
              <div class="text-[10px] text-white/20">\${new Date(r.requested_at).toLocaleString()}</div>
            </div>
            <div class="flex gap-2">
              \${r.wallet ? \`<button onclick="approveFromRequest('\${r.wallet}', '\${r.email}', '\${r.key}')" class="px-3 py-1.5 rounded-lg bg-[#00d4aa]/20 text-[#00d4aa] text-[10px] font-semibold hover:bg-[#00d4aa]/30">Approve</button>\` : ''}
              <button onclick="deleteRequest('\${r.key}')" class="px-3 py-1.5 rounded-lg bg-red-500/10 text-red-400 text-[10px] font-semibold hover:bg-red-500/20">Dismiss</button>
            </div>
          </div>
        \`).join('');
      } catch(e) { console.error(e); }
    }

    async function loadApproved() {
      try {
        const res = await fetch(API + '/list', { headers: headers() });
        if (!res.ok) return;
        const data = await res.json();
        const panel = document.getElementById('approved-panel');
        if (!data.entries?.length) {
          panel.innerHTML = '<p class="text-white/20 text-xs">No approved wallets</p>';
          return;
        }
        panel.innerHTML = \`<div class="text-xs text-white/30 mb-3">\${data.count} approved</div>\` + 
          data.entries.map(e => \`
          <div class="p-3 rounded-xl bg-white/[0.03] border border-white/5 mb-2 flex items-center justify-between">
            <div>
              <div class="text-[11px] text-white/70 font-mono">\${e.wallet}</div>
              <div class="text-[10px] text-white/30">\${e.email || ''} · \${e.approved_at ? new Date(e.approved_at).toLocaleDateString() : ''}</div>
            </div>
            <button onclick="revokeWallet('\${e.wallet}')" class="px-3 py-1.5 rounded-lg bg-red-500/10 text-red-400 text-[10px] font-semibold hover:bg-red-500/20">Revoke</button>
          </div>
        \`).join('');
      } catch(e) { console.error(e); }
    }

    async function loadNodes() {
      try {
        const res = await fetch(API + '/nodes/pending', { headers: headers() });
        if (!res.ok) { logout(); return; }
        const data = await res.json();
        const panel = document.getElementById('nodes-panel');
        if (!data.entries?.length) {
          panel.innerHTML = '<p class="text-white/20 text-xs">No pending node registrations</p>';
          return;
        }
        panel.innerHTML = data.entries.map(n => \`
          <div class="p-4 rounded-xl bg-white/[0.03] border border-white/5 mb-2 flex items-center justify-between">
            <div>
              <div class="text-xs text-white/70">\${n.operatorName || 'Unknown Operator'}</div>
              <div class="text-[10px] text-white/30 font-mono">Chain: \${n.chainId} | Engine: \${n.launchpadEngine}</div>
              <div class="text-[10px] text-white/30">RPC: \${n.rpcUrl.slice(0, 50)}...</div>
              <div class="text-[10px] text-white/20">\${new Date(n.submittedAt).toLocaleString()}</div>
            </div>
            <div class="flex gap-2">
              <button onclick="approveNode('\${n.nodeId}')" class="px-3 py-1.5 rounded-lg bg-[#00d4aa]/20 text-[#00d4aa] text-[10px] font-semibold hover:bg-[#00d4aa]/30">Approve</button>
              <button onclick="rejectNode('\${n.nodeId}')" class="px-3 py-1.5 rounded-lg bg-red-500/10 text-red-400 text-[10px] font-semibold hover:bg-red-500/20">Reject</button>
            </div>
          </div>
        \`).join('');
      } catch(e) { console.error(e); }
    }

    function showTab(tab) {
      document.getElementById('requests-panel').classList.toggle('hidden', tab !== 'requests');
      document.getElementById('approved-panel').classList.toggle('hidden', tab !== 'approved');
      document.getElementById('nodes-panel').classList.toggle('hidden', tab !== 'nodes');
      document.getElementById('tab-requests').classList.toggle('text-[#836ef9]', tab === 'requests');
      document.getElementById('tab-requests').classList.toggle('text-white/30', tab !== 'requests');
      document.getElementById('tab-approved').classList.toggle('text-[#836ef9]', tab === 'approved');
      document.getElementById('tab-approved').classList.toggle('text-white/30', tab !== 'approved');
      document.getElementById('tab-nodes').classList.toggle('text-[#836ef9]', tab === 'nodes');
      document.getElementById('tab-nodes').classList.toggle('text-white/30', tab !== 'nodes');
    }

    async function approveWallet() {
      const wallet = document.getElementById('approve-wallet').value.trim();
      const email = document.getElementById('approve-email').value.trim();
      if (!wallet) return;
      const res = await fetch(API + '/approve', { method: 'POST', headers: headers(), body: JSON.stringify({ wallet, email }) });
      const data = await res.json();
      document.getElementById('status').textContent = data.success ? '✓ Approved ' + wallet : '✗ ' + (data.error || 'Failed');
      document.getElementById('approve-wallet').value = '';
      document.getElementById('approve-email').value = '';
      loadData();
    }

    async function revokeWallet(wallet) {
      if (!confirm('Revoke ' + wallet + '?')) return;
      await fetch(API + '/revoke', { method: 'POST', headers: headers(), body: JSON.stringify({ wallet }) });
      loadData();
    }

    async function approveFromRequest(wallet, email, key) {
      await fetch(API + '/approve', { method: 'POST', headers: headers(), body: JSON.stringify({ wallet, email }) });
      await deleteRequest(key);
      loadData();
    }

    async function deleteRequest(key) {
      await fetch(API + '/delete-request', { method: 'POST', headers: headers(), body: JSON.stringify({ key }) });
      loadData();
    }

    async function approveNode(nodeId) {
      const res = await fetch(API + '/nodes/pending/' + nodeId + '/approve', { method: 'POST', headers: headers() });
      const data = await res.json();
      document.getElementById('status').textContent = data.success ? '✓ Approved node ' + nodeId : '✗ ' + (data.error || 'Failed');
      loadData();
    }

    async function rejectNode(nodeId) {
      const reason = prompt('Rejection reason (optional):');
      if (reason === null) return;
      const res = await fetch(API + '/nodes/pending/' + nodeId + '/reject', { method: 'POST', headers: headers(), body: JSON.stringify({ reason: reason || '' }) });
      const data = await res.json();
      document.getElementById('status').textContent = data.success ? '✓ Rejected node ' + nodeId : '✗ ' + (data.error || 'Failed');
      loadData();
    }
  </script>
</body>
</html>`;
  return new Response(html, { status: 200, headers: { "Content-Type": "text/html" } });
}

export default {
  async fetch(request, env) {
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: CORS });
    }

    const url = new URL(request.url);
    const path = url.pathname;

    // GET / → dashboard
    if (path === "/" && request.method === "GET") {
      return dashboard(env);
    }

    // GET /check?wallet=0x...
    if (path === "/check" && request.method === "GET") {
      const wallet = url.searchParams.get("wallet")?.toLowerCase().trim();
      if (!wallet || !/^0x[a-f0-9]{40}$/.test(wallet)) {
        return json({ allowed: false, error: "Invalid wallet" }, 400);
      }
      const entry = await env.ACCESS.get(`wallet:${wallet}`);
      return json({ allowed: !!entry, wallet });
    }

    // POST /approve { wallet, email? }
    if (path === "/approve" && request.method === "POST") {
      if (!isAdmin(request, env)) return json({ error: "Unauthorized" }, 401);
      const { wallet, email } = await request.json();
      if (!wallet || !/^0x[a-f0-9]{40}$/i.test(wallet)) {
        return json({ error: "Invalid wallet" }, 400);
      }
      const w = wallet.toLowerCase();
      await env.ACCESS.put(`wallet:${w}`, JSON.stringify({
        email: email || "",
        approved_at: new Date().toISOString(),
      }));
      return json({ success: true, wallet: w });
    }

    // POST /revoke { wallet }
    if (path === "/revoke" && request.method === "POST") {
      if (!isAdmin(request, env)) return json({ error: "Unauthorized" }, 401);
      const { wallet } = await request.json();
      if (!wallet) return json({ error: "wallet required" }, 400);
      await env.ACCESS.delete(`wallet:${wallet.toLowerCase()}`);
      return json({ success: true });
    }

    // GET /list (approved wallets)
    if (path === "/list" && request.method === "GET") {
      if (!isAdmin(request, env)) return json({ error: "Unauthorized" }, 401);
      const list = await env.ACCESS.list({ prefix: "wallet:" });
      const entries = [];
      for (const key of list.keys) {
        const val = await env.ACCESS.get(key.name, "json");
        entries.push({ wallet: key.name.replace("wallet:", ""), ...val });
      }
      return json({ count: entries.length, entries });
    }

    // GET /requests (pending access requests)
    if (path === "/requests" && request.method === "GET") {
      if (!isAdmin(request, env)) return json({ error: "Unauthorized" }, 401);
      const list = await env.ACCESS.list({ prefix: "request:" });
      const entries = [];
      for (const key of list.keys) {
        const val = await env.ACCESS.get(key.name, "json");
        entries.push({ key: key.name, ...val });
      }
      entries.sort((a, b) => (b.requested_at || "").localeCompare(a.requested_at || ""));
      return json({ count: entries.length, entries });
    }

    // POST /delete-request { key }
    if (path === "/delete-request" && request.method === "POST") {
      if (!isAdmin(request, env)) return json({ error: "Unauthorized" }, 401);
      const { key } = await request.json();
      if (!key) return json({ error: "key required" }, 400);
      await env.ACCESS.delete(key);
      return json({ success: true });
    }

    // POST /request { wallet, email? }
    if (path === "/request" && request.method === "POST") {
      const { email, wallet } = await request.json();
      if (!wallet) {
        return json({ error: "Wallet required" }, 400);
      }
      const walletNorm = wallet.toLowerCase().trim();
      const key = `request:${Date.now()}:${walletNorm}`;
      await env.ACCESS.put(key, JSON.stringify({
        email: email || "",
        wallet: walletNorm,
        requested_at: new Date().toISOString(),
      }));
      return json({ success: true });
    }

    // POST /register { chainId, rpcUrl, launchpadEngine, operatorName?, contactEmail? }
    if (path === "/register" && request.method === "POST") {
      const body = await request.json();
      const { chainId, rpcUrl, launchpadEngine, operatorName, contactEmail } = body;
      
      // Validate
      if (!chainId || typeof chainId !== 'number') return json({ error: "chainId required (number)" }, 400);
      if (!rpcUrl || typeof rpcUrl !== 'string') return json({ error: "rpcUrl required" }, 400);
      if (!launchpadEngine || !/^0x[a-fA-F0-9]{40}$/.test(launchpadEngine)) {
        return json({ error: "Invalid launchpadEngine address" }, 400);
      }
      const nodeId = await computeNodeId(chainId, launchpadEngine);
      const key = `node-pending:${nodeId}`;
      
      await env.ACCESS.put(key, JSON.stringify({
        nodeId,
        chainId,
        rpcUrl,
        launchpadEngine: launchpadEngine.toLowerCase(),
        operatorName: operatorName || "",
        contactEmail: contactEmail || "",
        submittedAt: new Date().toISOString(),
        status: "pending",
      }));
      
      return json({ nodeId, status: "pending", message: "Your node registration is pending review." });
    }

    // POST /nodes/pending/:nodeId/approve (admin)
    if (path.match(/^\/nodes\/pending\/[^/]+\/approve$/) && request.method === "POST") {
      if (!isAdmin(request, env)) return json({ error: "Unauthorized" }, 401);
      const nodeId = path.split("/")[3];
      const val = await env.ACCESS.get(`node-pending:${nodeId}`, "json");
      if (!val) return json({ error: "Not found" }, 404);
      await env.ACCESS.put(`node-approved:${nodeId}`, JSON.stringify({ ...val, status: "approved", approvedAt: new Date().toISOString() }));
      await env.ACCESS.delete(`node-pending:${nodeId}`);
      return json({ success: true, nodeId });
    }

    // POST /nodes/pending/:nodeId/reject (admin)
    if (path.match(/^\/nodes\/pending\/[^/]+\/reject$/) && request.method === "POST") {
      if (!isAdmin(request, env)) return json({ error: "Unauthorized" }, 401);
      const nodeId = path.split("/")[3];
      const { reason } = await request.json().catch(() => ({}));
      const val = await env.ACCESS.get(`node-pending:${nodeId}`, "json");
      if (!val) return json({ error: "Not found" }, 404);
      await env.ACCESS.delete(`node-pending:${nodeId}`);
      return json({ success: true, nodeId, reason: reason || "Rejected" });
    }

    // GET /nodes/pending/:nodeId (admin)
    if (path.match(/^\/nodes\/pending\/[^/]+$/) && request.method === "GET") {
      if (!isAdmin(request, env)) return json({ error: "Unauthorized" }, 401);
      const nodeId = path.replace("/nodes/pending/", "");
      const val = await env.ACCESS.get(`node-pending:${nodeId}`, "json");
      if (!val) return json({ error: "Not found" }, 404);
      return json(val);
    }

    // GET /nodes/pending (admin)
    if (path === "/nodes/pending" && request.method === "GET") {
      if (!isAdmin(request, env)) return json({ error: "Unauthorized" }, 401);
      const list = await env.ACCESS.list({ prefix: "node-pending:" });
      const entries = [];
      for (const key of list.keys) {
        const val = await env.ACCESS.get(key.name, "json");
        entries.push({ key: key.name, ...val });
      }
      entries.sort((a, b) => (b.submittedAt || "").localeCompare(a.submittedAt || ""));
      return json({ count: entries.length, entries });
    }

    return json({ error: "Not found" }, 404);
  },
};
