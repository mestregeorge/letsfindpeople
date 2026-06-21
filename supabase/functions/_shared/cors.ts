// @ts-nocheck

function toOrigin(url: string | null) {
  if (!url) return null;
  try {
    return new URL(url).origin;
  } catch {
    return null;
  }
}

export function getAllowedOrigins() {
  return [Deno.env.get("SITE_URL"), Deno.env.get("SITE_URLS")]
    .filter(Boolean)
    .flatMap((value) => String(value).split(","))
    .map((value) => toOrigin(value.trim()))
    .filter(Boolean);
}

export function corsHeaders(req: Request) {
  const requestOrigin = req.headers.get("Origin");
  const allowedOrigins = getAllowedOrigins();
  const allowedOrigin =
    requestOrigin && allowedOrigins.includes(requestOrigin)
      ? requestOrigin
      : allowedOrigins[0] ?? "";

  return {
    ...(allowedOrigin ? { "Access-Control-Allow-Origin": allowedOrigin, Vary: "Origin" } : {}),
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
  };
}

export function json(req: Request, body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders(req), "Content-Type": "application/json" },
  });
}
