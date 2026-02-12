// Netlify Edge Function: /api/check-access?wallet=0x...
// Returns { allowed: true/false }

const ALLOWLIST: Set<string> = new Set([
  // Add approved wallet addresses here (lowercase)
  "0xb60f9c524d8bb90ce3905a906ffe6b915ce347c2", // deployer (Daniel)
]);

export default async (request: Request) => {
  const url = new URL(request.url);
  const wallet = url.searchParams.get("wallet")?.toLowerCase().trim();

  // CORS headers
  const headers = {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Cache-Control": "no-cache",
  };

  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers });
  }

  if (!wallet || !/^0x[a-f0-9]{40}$/.test(wallet)) {
    return new Response(
      JSON.stringify({ allowed: false, error: "Invalid wallet address" }),
      { status: 400, headers }
    );
  }

  const allowed = ALLOWLIST.has(wallet);

  return new Response(
    JSON.stringify({ allowed, wallet }),
    { status: 200, headers }
  );
};

export const config = { path: "/api/check-access" };
