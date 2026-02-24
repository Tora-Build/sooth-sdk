// Netlify Edge Function: POST /api/request-access
// Stores requests by forwarding to a simple webhook/log
// Requests can be viewed in Netlify function logs

export default async (request: Request) => {
  const headers = {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Cache-Control": "no-cache",
  };

  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers });
  }

  if (request.method !== "POST") {
    return new Response(
      JSON.stringify({ error: "Method not allowed" }),
      { status: 405, headers }
    );
  }

  try {
    const { email, wallet } = await request.json();

    if (!email || !email.includes("@")) {
      return new Response(
        JSON.stringify({ error: "Valid email required" }),
        { status: 400, headers }
      );
    }

    const walletNorm = wallet?.toLowerCase().trim() || "";

    // Log the request (visible in Netlify edge function logs)
    console.log(JSON.stringify({
      type: "access_request",
      email,
      wallet: walletNorm,
      timestamp: new Date().toISOString(),
    }));

    return new Response(
      JSON.stringify({ success: true, message: "Request submitted" }),
      { status: 200, headers }
    );
  } catch (e) {
    return new Response(
      JSON.stringify({ error: "Invalid request body" }),
      { status: 400, headers }
    );
  }
};

export const config = { path: "/api/request-access" };
