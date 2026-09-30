import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type MatchInput = {
  request: Record<string, unknown>;
  providers: Array<{ provider_id: string; service: Record<string, unknown> }>;
};

const reply = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

function parseAiJson(content: string): unknown {
  const cleaned = content
    .trim()
    .replace(/^(?:\`){3}json\s*/i, "")
    .replace(/^(?:\`){3}\s*/i, "")
    .replace(/\s*(?:\`){3}$/i, "")
    .trim();

  // بعض النماذج قد تضيف نصاً قبل أو بعد JSON، مثل:
  // "User Safety: safe"
  // لذلك نبحث عن أول كائن JSON وآخر كائن JSON قبل التحليل.
  const firstObject = cleaned.indexOf("{");
  const lastObject = cleaned.lastIndexOf("}");

  if (firstObject === -1 || lastObject <= firstObject) {
    throw new SyntaxError("AI response does not contain a JSON object");
  }

  const jsonText = cleaned.slice(firstObject, lastObject + 1);
  return JSON.parse(jsonText);
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return reply({ error: "Method not allowed" }, 405);

  const apiKey = Deno.env.get("OPENROUTER_API_KEY");
  if (!apiKey) return reply({ error: "OPENROUTER_API_KEY is not configured" }, 500);

  let input: MatchInput;
  try {
    input = await req.json();
  } catch {
    return reply({ error: "Invalid JSON body" }, 400);
  }

  if (!input?.request || !Array.isArray(input.providers)) {
    return reply({ error: "request and providers are required" }, 400);
  }

  const providers = input.providers.slice(0, 20);

  const prompt = [
    "أنت محرك المطابقة الذكي في تطبيق خدمات.",
    "قارن طلب العميل مع خدمات مقدمي الخدمة اعتماداً على المعنى والبيانات المنظمة، وليس التطابق الحرفي للكلمات فقط.",
    "اعتبر المرادفات، صياغة الخدمة، المهارات، المنطقة والموقع.",
    "لا تعتبر مقدم الخدمة مناسباً فقط لأنه يشارك كلمة عامة.",
    "إذا كانت المنطقة أو الموقع موجودة في طلب العميل ومختلفة بوضوح عن مقدم الخدمة، اخفض الدرجة بشكل كبير.",
    "إذا كانت المنطقة أو الموقع غير مذكورين في أحد الطرفين، لا تعاقب المطابقة بسبب ذلك.",
    "أعط لكل مقدم درجة من 0 إلى 100 تعبّر عن مدى قدرته على تنفيذ الطلب فعلياً.",
    "أعد JSON فقط يحتوي على matches، وكل عنصر فيه provider_id وscore وreason.",
    "reason جملة عربية قصيرة.",
    "طلب العميل:",
    JSON.stringify(input.request),
    "مقدمو الخدمة:",
    JSON.stringify(providers),
  ].join("\n");

  try {
    const upstream = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: "Bearer " + apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "openrouter/free",
        temperature: 0.1,
        messages: [
          {
            role: "system",
            content: "أعد JSON صالح فقط، بدون Markdown أو أي نص خارج كائن JSON.",
          },
          { role: "user", content: prompt },
        ],
      }),
    });

    if (!upstream.ok) {
      console.error("[match-service-providers] OpenRouter error:", await upstream.text());
      return reply({ error: "AI matching failed" }, 502);
    }

    const result = await upstream.json();
    let content = result?.choices?.[0]?.message?.content;

    if (Array.isArray(content)) {
      content = content.map((part: any) => part?.text ?? "").join("");
    }

    if (typeof content !== "string" || !content.trim()) {
      return reply({ error: "AI returned empty content" }, 502);
    }

    console.log("[match-service-providers] OpenRouter raw content:", content);

    const parsed = parseAiJson(content);

    if (!parsed || typeof parsed !== "object" || !Array.isArray((parsed as any).matches)) {
      return reply({ error: "AI returned invalid match format" }, 502);
    }

    const allowedIds = new Set(providers.map((p) => p.provider_id));

    const matches = (parsed as any).matches
      .filter((item: any) => allowedIds.has(item?.provider_id))
      .map((item: any) => ({
        provider_id: item.provider_id,
        score: Math.max(0, Math.min(100, Number(item.score) || 0)),
        reason: typeof item.reason === "string" ? item.reason.trim() : "",
      }));

    console.log("[match-service-providers] AI matches:", JSON.stringify(matches));

    console.log("[match-service-providers] AI matches:", JSON.stringify(matches));

    return reply({ matches });
  } catch (error) {
    console.error("[match-service-providers] Error:", error);
    return reply({ error: "AI matching failed" }, 502);
  }
});