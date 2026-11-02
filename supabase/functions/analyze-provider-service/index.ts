import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { authenticateAndLimit, corsHeaders, json } from "./guard.ts";

const MAX_SERVICE_TEXT = 500;
const MAX_SERVICE_AREA = 200;
const MAX_ADDITIONAL_INFO = 1000;

function buildPrompt(serviceText: string, serviceArea: string, additionalInfo: string) {
  return [
    "حلّل بيانات خدمة مقدم الخدمة التالية باللغة العربية وأعد JSON فقط بدون أي نص إضافي.",
    "المهارة/الخدمة:",
    serviceText,
    "مكان تقديم الخدمة:",
    serviceArea,
    "معلومات إضافية اختيارية:",
    additionalInfo || "لا يوجد",
    "",
    "أعد هذا الشكل:",
    JSON.stringify({
      category: "التصنيف العام للخدمة",
      service: "نوع الخدمة أو المهنة",
      skills: ["المهارات الأساسية"],
      region: "المدينة/المنطقة إن أمكن استخلاصها من مكان تقديم الخدمة",
      location: "الموقع التفصيلي أو الأحياء إن وجدت",
      service_area: {
        type: "city | rural | city_and_rural | specific_areas | other",
        city: "المدينة إن وجدت",
        areas: ["المناطق أو الأحياء إن وجدت"],
        raw: "مكان تقديم الخدمة كما أدخله المستخدم",
      },
      delivery_mode: "استخلصه فقط إذا ذكره المستخدم مثل عند مقدم الخدمة أو عند الزبون أو كلاهما، وإلا null",
      additional_info: "المعلومات الإضافية كما فهمتها دون اختراع معلومات",
      synonyms: ["مرادفات مفيدة للبحث والمطابقة"],
    }, null, 2),
    "",
    "التصنيف العام يجب أن يكون واحداً من: تعليم، تصليح وصيانة، نقل، تنظيف، معاملات وخدمات حكومية، ترجمة، تصميم وبرمجة، صحة وجمال، منزل وحديقة، سيارات ومركبات، خدمات تجارية، خدمات شخصية، أخرى.",
    "مهم:",
    "- لا تشترط وجود المهنة أو الخدمة مسبقاً في قائمة.",
    "- افهم أي مهنة أو خدمة جديدة من النص.",
    "- احتفظ بالتخصص الدقيق في service والمهارات في skills.",
    "- لا تخترع معلومات غير موجودة.",
    "- مكان تقديم الخدمة الذي أدخله المستخدم هو بيانات أساسية مؤكدة، فلا تضعه null ولا تستبدله بتخمين آخر.",
    "- إذا كان المستخدم كتب مدينة وريف فعبّر عنها كـ city_and_rural.",
    "- إذا ذكر أحياء أو مناطق محددة فعبّر عنها كـ specific_areas.",
    "- إذا كتب منطقة ريفية أو قرى، استخدم rural عندما يكون ذلك واضحاً.",
    "- لا تعتبر المعلومات الاختيارية سبباً لفشل التحليل.",
  ].join("\n");
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  // Real signed-in user only + 10 requests/minute and 60/day per user.
  const guard = await authenticateAndLimit(req, "analyze-provider-service", 10, 60);
  if (guard instanceof Response) return guard;

  try {
    let body: any;
    try {
      body = await req.json();
    } catch {
      return json({ error: "Invalid JSON body" }, 400);
    }

    const serviceText = typeof body?.service_text === "string" ? body.service_text.trim() : "";
    const serviceArea = typeof body?.service_area === "string" ? body.service_area.trim() : "";
    const additionalInfo = typeof body?.additional_info === "string" ? body.additional_info.trim() : "";

    if (!serviceText || !serviceArea) {
      return json({ error: "service_text and service_area are required" }, 400);
    }
    if (
      serviceText.length > MAX_SERVICE_TEXT ||
      serviceArea.length > MAX_SERVICE_AREA ||
      additionalInfo.length > MAX_ADDITIONAL_INFO
    ) {
      return json({ error: "Input is too long" }, 400);
    }

    const apiKey = Deno.env.get("GEMINI_API_KEY");
    if (!apiKey) {
      console.error("[analyze-provider-service] GEMINI_API_KEY is not configured");
      return json({ error: "Server configuration is incomplete" }, 500);
    }

    const response = await fetch(
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash-lite:generateContent",
      {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: "You extract structured service information. Return valid JSON only." }] },
          contents: [{ role: "user", parts: [{ text: buildPrompt(serviceText, serviceArea, additionalInfo) }] }],
          generationConfig: { temperature: 0.1, responseMimeType: "application/json" },
        }),
        signal: AbortSignal.timeout(45_000),
      },
    );

    if (!response.ok) {
      console.error("[analyze-provider-service] Gemini failed:", response.status);
      return json({ error: "AI request failed" }, 502);
    }

    const result = await response.json();
    const content = result?.candidates?.[0]?.content?.parts?.map((p: any) => p?.text ?? "").join("").trim();
    if (typeof content !== "string" || !content) return json({ error: "No AI response content returned" }, 502);

    let structuredData: unknown;
    try {
      structuredData = JSON.parse(content);
    } catch {
      try {
        structuredData = JSON.parse(content.replace(/^```json\s*/i, "").replace(/\s*```$/i, "").trim());
      } catch {
        return json({ error: "AI returned invalid JSON" }, 502);
      }
    }
    if (!structuredData || typeof structuredData !== "object" || Array.isArray(structuredData)) {
      return json({ error: "AI returned invalid JSON" }, 502);
    }

    return json({
      original_text: serviceText,
      service_area_input: serviceArea,
      additional_info_input: additionalInfo,
      structured_data: structuredData,
    });
  } catch (error) {
    console.error("[analyze-provider-service]", error instanceof Error ? error.message : "unknown");
    return json({ error: "Unexpected server error" }, 500);
  }
});
