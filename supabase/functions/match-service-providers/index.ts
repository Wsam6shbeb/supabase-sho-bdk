import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.117.2";

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

function buildPrompt(request: Record<string, unknown>, providers: Array<{ provider_id: string; service: unknown }>) {
  return [
    "أنت محرك المطابقة الذكي في تطبيق خدمات.",
    "قارن طلب العميل مع خدمات مقدمي الخدمة اعتماداً على المعنى والبيانات المنظمة، وليس التطابق الحرفي للكلمات فقط.",
    "اعتبر المرادفات، صياغة الخدمة، التصنيف العام، المهارات، المدينة، منطقة طلب الخدمة ومناطق تقديم الخدمة.",
    "",
    "قاعدة أساسية: نوع الخدمة شرط لا يعوّضه شيء. القرب الجغرافي أو التصنيف العام المشترك لا يجعل مقدماً مناسباً.",
    "إذا كانت خدمة مقدم الخدمة من نوع مختلف عن الخدمة المطلوبة (مثال: الطلب صيدلية ومقدم الخدمة معقب معاملات أو مدرّس لغات أو حلاق)، أعطه درجة بين 0 و15، حتى لو كان في نفس المدينة أو نفس التصنيف العام أو كان الوحيد في القائمة.",
    "لا تُرجع مقدماً غير مناسب لمجرد أن القائمة قصيرة أو لتجنّب نتيجة فارغة. أن لا يوجد أي مقدم مناسب جواب صحيح ومقبول، وعندها تكون كل الدرجات منخفضة.",
    "",
    "مقياس الدرجة (0 إلى 100) = قدرته على تنفيذ الطلب فعلياً:",
    "- 85 إلى 100: يقدّم نفس الخدمة المطلوبة بوضوح.",
    "- 60 إلى 84: خدمة قريبة جداً ويستطيع تنفيذ الطلب غالباً.",
    "- 30 إلى 59: صلة ضعيفة أو جزئية فقط.",
    "- 0 إلى 29: خدمة مختلفة أو غير ذات صلة.",
    "",
    "المكان: مدينة حساب مقدم الخدمة ومدينة طالب الخدمة فلتر أولي من الباك إند. اختلاف المنطقة داخل نفس المدينة لا يعني استبعاد مقدم الخدمة، فاستخدم منطقة طلب العميل ونطاق تقديم الخدمة لتحديد القرب والأولوية.",
    "أعط أولوية لمن يستطيع تقديم الخدمة في نفس المنطقة أو نطاق قريب منها، وإذا لم تجد في نفس المنطقة فوسّع إلى مقدمين مناسبين في مناطق أخرى داخل نفس المدينة، بشرط أن تكون الخدمة نفسها مناسبة.",
    "إذا كانت منطقة أحد الطرفين غير معروفة، لا تعاقب المطابقة بسبب ذلك.",
    "",
    "أعد في matches عنصراً لكل مقدم خدمة مرسل إليك (بما فيهم غير المناسبين بدرجات منخفضة).",
    "أعد JSON فقط يحتوي على matches، وكل عنصر فيه provider_id وscore وreason.",
    "reason جملة عربية قصيرة تذكر سبب الملاءمة أو عدمها، ويمكن أن تذكر أن المنطقة مختلفة داخل نفس المدينة إذا كان ذلك مؤثراً.",
    "طلب العميل:",
    JSON.stringify(request),
    "مقدمو الخدمة:",
    JSON.stringify(providers),
  ].join("\n");
}

async function matchBatch(
  apiKey: string,
  request: Record<string, unknown>,
  providers: Array<{ provider_id: string; service: unknown }>,
) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 60_000);
  let upstream: Response;
  try {
    upstream = await fetch(
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash-lite:generateContent?key=" +
        encodeURIComponent(apiKey),
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          systemInstruction: {
            parts: [{ text: "أعد JSON صالح فقط، بدون Markdown أو أي نص خارج كائن JSON." }],
          },
          contents: [{ role: "user", parts: [{ text: buildPrompt(request, providers) }] }],
          generationConfig: {
            temperature: 0.1,
            responseMimeType: "application/json",
            responseSchema: {
              type: "OBJECT",
              properties: {
                matches: {
                  type: "ARRAY",
                  items: {
                    type: "OBJECT",
                    properties: {
                      provider_id: { type: "STRING" },
                      score: { type: "NUMBER" },
                      reason: { type: "STRING" },
                    },
                    required: ["provider_id", "score", "reason"],
                  },
                },
              },
              required: ["matches"],
            },
          },
        }),
        signal: controller.signal,
      },
    );
  } finally {
    clearTimeout(timeoutId);
  }

  if (!upstream.ok) {
    const detail = await upstream.text();
    console.error("[match-service-providers] Gemini error:", upstream.status, detail.slice(0, 500));
    throw new Error("AI matching failed");
  }

  const result = await upstream.json();
  const content =
    result?.candidates?.[0]?.content?.parts?.map((part: any) => part?.text ?? "").join("") ?? "";
  if (!content.trim()) throw new Error("AI returned empty content");

  const parsed = parseAiJson(content);
  if (!parsed || typeof parsed !== "object" || !Array.isArray((parsed as any).matches)) {
    throw new Error("AI returned invalid match format");
  }

  const allowedIds = new Set(providers.map((provider) => provider.provider_id));
  return (parsed as any).matches
    .filter((item: any) => allowedIds.has(item?.provider_id))
    .map((item: any) => ({
      provider_id: item.provider_id,
      score: Math.max(0, Math.min(100, Number(item.score) || 0)),
      reason: typeof item.reason === "string" ? item.reason.trim() : "",
    }));
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

  let body: { request_id?: unknown };
  try {
    body = await req.json();
  } catch {
    return reply({ error: "Invalid JSON body" }, 400);
  }

  const requestId = typeof body?.request_id === "string" ? body.request_id : "";
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(requestId)) {
    return reply({ error: "A valid request_id is required" }, 400);
  }

  const userClient = createClient(supabaseUrl, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: authorization } },
  });
  const { data: authData, error: authError } = await userClient.auth.getUser(token);
  if (authError || !authData.user) return reply({ error: "Unauthorized" }, 401);

  const requesterId = authData.user.id;
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
    console.error("[match-service-providers] Matching batch failed:", error);
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
