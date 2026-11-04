import { createClient } from "npm:@supabase/supabase-js@2.117.2";

export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

export const json = (body: unknown, status = 200, extra: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json", ...extra },
  });

// Requires a real signed-in user (the public anon key is rejected) and applies a per-user rate limit.
export async function authenticateAndLimit(
  req: Request,
  bucket: string,
  perMinute: number,
  perDay: number,
): Promise<{ userId: string } | Response> {
  const authorization = req.headers.get("Authorization");
  const token = authorization?.replace(/^Bearer\s+/i, "");
  if (!authorization || !token) return json({ error: "Unauthorized" }, 401);

  const url = Deno.env.get("SUPABASE_URL");
  let publishable: string | undefined;
  try {
    publishable = JSON.parse(Deno.env.get("SUPABASE_PUBLISHABLE_KEYS") ?? "")?.default;
  } catch { /* ignore */ }
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? publishable;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !anonKey || !serviceKey) {
    console.error("[guard] server configuration is incomplete");
    return json({ error: "Server configuration is incomplete" }, 500);
  }

  const userClient = createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: authorization } },
  });
  const { data, error } = await userClient.auth.getUser(token);
  if (error || !data.user) return json({ error: "Unauthorized" }, 401);

  const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: rl, error: rlError } = await admin.rpc("consume_ai_rate_limit", {
    p_user_id: data.user.id,
    p_bucket: bucket,
    p_per_minute: perMinute,
    p_per_day: perDay,
  });
  if (rlError || !Array.isArray(rl) || !rl[0] || typeof rl[0].allowed !== "boolean") {
    console.error("[guard] rate limit check failed");
    return json({ error: "Service temporarily unavailable" }, 503);
  }
  if (!rl[0].allowed) {
    const retryAfter = Math.max(1, Number(rl[0].retry_after_seconds) || 60);
    return json({ error: "Rate limit exceeded", retry_after_seconds: retryAfter }, 429, {
      "Retry-After": String(retryAfter),
    });
  }
  return { userId: data.user.id };
}
