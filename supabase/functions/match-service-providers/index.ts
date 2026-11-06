import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.117.2";
import { describeError, redactSecrets } from "../_shared/safe-log.ts";
import {
  BodyTooLargeError,
  buildGeminiRequest,
  buildMatchPrompt,
  normalizeMatches,
  readJsonBodyLimited,
  sanitizeProviderEntries,
  sanitizeRequestForPrompt,
} from "./match-core.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type ProviderRow = {
  provider_id: string;
  rating_avg: number | null;
  rating_count: number | null;
  completed_services_count: number | null;
  full_name: string | null;
  avatar_url: string | null;
  region: string | null;
  verification_status: string | null;
  services: Array<Record<string, unknown>> | null;
  preliminary_score: number | null;
};

const reply = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

function parseAiJson(content: string): unknown {
  const cleaned = content
    .trim()
    .replace(/^\x60{3}json\s*/i, "")
    .replace(/^\x60{3}\s*/i, "")
    .replace(/\s*\x60{3}$/i, "")
    .trim();
  const firstObject = cleaned.indexOf("{");
  const lastObject = cleaned.lastIndexOf("}");
  if (firstObject === -1 || lastObject <= firstObject) {
    throw new SyntaxError("AI response does not contain a JSON object");
  }
  return JSON.parse(cleaned.slice(firstObject, lastObject + 1));
}

async function matchBatch(
  apiKey: string,
  request: Record<string, unknown>,
  providers: Array<{ provider_id: string; service: unknown }>,
) {
  // Everything user-authored is bounded and whitelisted here, for both the request_id flow
  // and the legacy flow, before it is placed in the prompt.
  const safeRequest = sanitizeRequestForPrompt(request);
  const safeProviders = sanitizeProviderEntries(providers);
  const { url, init } = buildGeminiRequest(apiKey, buildMatchPrompt(safeRequest, safeProviders));

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 60_000);
  let upstream: Response;
  try {
    upstream = await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timeoutId);
  }

  if (!upstream.ok) {
    const detail = await upstream.text();
    console.error("[match-service-providers] Gemini error:", upstream.status, redactSecrets(detail.slice(0, 300)));
    throw new Error("AI matching failed");
  }

  const result = await upstream.json();
  const content =
    result?.candidates?.[0]?.content?.parts?.map((part: any) => part?.text ?? "").join("") ?? "";
  if (!content.trim()) throw new Error("AI returned empty content");

  const parsed = parseAiJson(content);
  return normalizeMatches(parsed, new Set(providers.map((provider) => provider.provider_id)));
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return reply({ error: "Method not allowed" }, 405);

  const authorization = req.headers.get("Authorization");
  const token = authorization?.replace(/^Bearer\s+/i, "");
  if (!authorization || !token) return reply({ error: "Unauthorized" }, 401);

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const publishableKeysRaw = Deno.env.get("SUPABASE_PUBLISHABLE_KEYS");
  let defaultPublishableKey: string | undefined;
  if (publishableKeysRaw) {
    try {
      defaultPublishableKey = JSON.parse(publishableKeysRaw)?.default;
    } catch {
      console.error("[match-service-providers] SUPABASE_PUBLISHABLE_KEYS is not valid JSON");
    }
  }
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? defaultPublishableKey;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const geminiKey = Deno.env.get("GEMINI_API_KEY");
  if (!supabaseUrl || !anonKey || !serviceRoleKey || !geminiKey) {
    console.error("[match-service-providers] Required server configuration is missing");
    return reply({ error: "Server configuration is incomplete" }, 500);
  }

  let body: { request_id?: unknown; request?: unknown; providers?: unknown };
  try {
    body = (await readJsonBodyLimited(req)) as typeof body;
  } catch (error) {
    if (error instanceof BodyTooLargeError) return reply({ error: "Request body too large" }, 413);
    return reply({ error: "Invalid JSON body" }, 400);
  }

  const requestId = typeof body?.request_id === "string" ? body.request_id : "";
  const validRequestId = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(requestId);

  const userClient = createClient(supabaseUrl, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: authorization } },
  });
  const { data: authData, error: authError } = await userClient.auth.getUser(token);
  if (authError || !authData.user) return reply({ error: "Unauthorized" }, 401);

  const requesterId = authData.user.id;
    // Enforce per-user Gemini matching limits before either legacy or new flow.
  const rateLimitClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: rateLimitData, error: rateLimitError } =
    await rateLimitClient.rpc("consume_match_rate_limit", {
      p_user_id: requesterId,
    });

  if (rateLimitError || !Array.isArray(rateLimitData) || !rateLimitData[0]) {
    console.error("[match-service-providers] Rate limit check failed");
    return reply({ error: "Matching is temporarily unavailable" }, 503);
  }

  const rateLimit = rateLimitData[0];

  if (typeof rateLimit.allowed !== "boolean") {
    console.error("[match-service-providers] Invalid rate limit response");
    return reply({ error: "Matching is temporarily unavailable" }, 503);
  }

  if (!rateLimit.allowed) {
    const retryAfter = Math.max(
      1,
      Number(rateLimit.retry_after_seconds) || 60,
    );

    return new Response(
      JSON.stringify({ error: "Rate limit exceeded", retry_after_seconds: retryAfter }),
      {
        status: 429,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
          "Retry-After": String(retryAfter),
        },
      },
    );
  }
  // Compatibility for app versions already installed by users. Legacy calls can still
  // receive matching scores, but only the request_id path below can write candidate rows.
  if (!validRequestId) {
    const legacyRequest = body?.request;
    const legacyProviders = Array.isArray(body?.providers) ? body.providers : [];
    if (!legacyRequest || typeof legacyRequest !== "object" || legacyProviders.length === 0 || legacyProviders.length > 20) {
      return reply({ error: "A valid request_id is required" }, 400);
    }

    const validLegacyProviders = legacyProviders.filter((provider: any) =>
      typeof provider?.provider_id === "string" &&
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(provider.provider_id) &&
      provider.service !== null &&
      typeof provider.service === "object"
    );
    if (validLegacyProviders.length !== legacyProviders.length) {
      return reply({ error: "Invalid legacy provider payload" }, 400);
    }

    try {
      const matches = await matchBatch(
        geminiKey,
        legacyRequest as Record<string, unknown>,
        validLegacyProviders,
      );
      return reply({ matches });
    } catch (error) {
      console.error("[match-service-providers] Legacy matching failed:", describeError(error));
      return reply({ error: "AI matching failed" }, 502);
    }
  }
  const { data: requestRow, error: requestError } = await userClient
    .from("service_requests")
    .select("id, requester_id, raw_text, structured_data, region, service_area")
    .eq("id", requestId)
    .eq("requester_id", requesterId)
    .maybeSingle();

  if (requestError || !requestRow) {
    return reply({ error: "Request not found or access denied" }, 404);
  }

  const { data: providerRows, error: providerError } = await userClient.rpc(
    "get_provider_candidates",
    { p_request_id: requestId, p_limit: 50 },
  );
  if (providerError) {
    console.error("[match-service-providers] Candidate lookup failed:", providerError.message);
    return reply({ error: "Could not load eligible providers" }, 500);
  }

  const providers = (providerRows ?? []) as ProviderRow[];
  if (providers.length === 0) return reply({ matches: [], saved_count: 0 });

  const requestData =
    requestRow.structured_data && typeof requestRow.structured_data === "object"
      ? requestRow.structured_data as Record<string, unknown>
      : {
          service: requestRow.raw_text,
          skills: [],
          synonyms: [],
          region: requestRow.region,
          location: requestRow.service_area,
        };

  const candidates = providers.map((row) => ({
    provider_id: row.provider_id,
    service: Array.isArray(row.services) && row.services.length
      ? row.services
      : { service: "", skills: [], synonyms: [], region: null, location: null },
  }));

  const batches: Array<typeof candidates> = [];
  for (let offset = 0; offset < candidates.length; offset += 20) {
    batches.push(candidates.slice(offset, offset + 20));
  }

  let batchResults: Array<Array<{ provider_id: string; score: number; reason: string }>>;
  try {
    batchResults = await Promise.all(
      batches.map((batch) => matchBatch(geminiKey, requestData, batch)),
    );
  } catch (error) {
    console.error("[match-service-providers] Matching batch failed:", describeError(error));
    return reply({ error: "AI matching failed" }, 502);
  }
  const matches = batchResults.flat();

  const scoreByProvider = new Map(matches.map((match) => [match.provider_id, match]));
  const ranked = providers
    .map((provider) => ({ provider, match: scoreByProvider.get(provider.provider_id) }))
    .filter(({ match }) => match && match.score > 15)
    .sort((a, b) =>
      (b.match?.score ?? 0) - (a.match?.score ?? 0) ||
      (Number(b.provider.preliminary_score) || 0) - (Number(a.provider.preliminary_score) || 0),
    );

  const rows = ranked.map(({ provider, match }, index) => ({
    request_id: requestId,
    provider_id: provider.provider_id,
    rank: index + 1,
    match_score: match?.score ?? null,
  }));

  if (rows.length > 0) {
    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { error: saveError } = await adminClient
      .from("candidates")
      .upsert(rows, { onConflict: "request_id,provider_id" });
    if (saveError) {
      console.error("[match-service-providers] Saving candidate rows failed:", saveError.message);
      return reply({ error: "Could not save matching results" }, 500);
    }
  }

  console.log("[match-service-providers] Matched and saved:", {
    requestId,
    requesterId,
    providerCount: providers.length,
    savedCount: rows.length,
  });

  return reply({ matches, saved_count: rows.length });
});
