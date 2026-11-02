import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { authenticateAndLimit, corsHeaders, json } from "./guard.ts";

const MAX_REQUEST_TEXT = 1000;
const MAX_SERVICE_AREA = 200;
const MAX_ADDITIONAL_INFO = 1000;

const allowedCategories = [
  "تعليم",
  "تصليح وصيانة",
  "نقل",
  "تنظيف",
  "معاملات وخدمات حكومية",
  "ترجمة",
  "تصميم وبرمجة",
  "صحة وجمال",
  "منزل وحديقة",
  "سيارات ومركبات",
  "خدمات تجارية",
  "خدمات شخصية",
  "أخرى",
];

function buildPrompt(requestText: string, serviceArea: string, additionalInfo: string) {
  return `حلّل طلب الخدمة التالي باللغة العربية وأعد JSON فقط بدون أي نص إضافي.

ما الخدمة التي يريدها الزبون:
${requestText}

مكان تقديم/الحصول على الخدمة:
${serviceArea}

معلومات إضافية اختيارية:
${additionalInfo || "لا يوجد"}

أعد هذا الشكل:
{
  "service": "نوع الخدمة أو المطلوب",
  "category": "التصنيف العام",
  "skills": ["المهارات أو التفاصيل الأساسية المطلوبة"],
  "region": "المدينة/المنطقة إن وجدت",
  "location": "الموقع التفصيلي إن وجد",
  "service_area": {
    "type": "city | rural | city_and_rural | specific_areas | multiple_areas",
    "city": "المدينة إن وجدت",
    "areas": ["الأحياء أو المناطق المحددة إن وجدت"],
    "raw": "النص الأصلي لمكان الخدمة"
  },
  "delivery_mode": "طريقة تقديم الخدمة إن كانت واضحة",
  "additional_info": "المعلومات الإضافية التي ذكرها الزبون",
  "synonyms": ["مرادفات مفيدة للبحث والمطابقة"],
  "needs_clarification": false,
  "clarification_question": null,
  "confidence": 0.0
}

التصنيفات العامة المسموح بها فقط:
- تعليم
- تصليح وصيانة
- نقل
- تنظيف
- معاملات وخدمات حكومية
- ترجمة
- تصميم وبرمجة
- صحة وجمال
- منزل وحديقة
- سيارات ومركبات
- خدمات تجارية
- خدمات شخصية
- أخرى

القواعد:
- الخدمة ومكانها الأساسيان قد حددهما المستخدم في الحقول أعلاه، فلا تطلب منه تحديد مكان الخدمة مرة أخرى.
- لا تخترع معلومات غير موجودة.
- لا تشترط أن تكون الخدمة أو المهنة موجودة مسبقًا ضمن قائمة ثابتة.
- افهم الخدمة من النص، وضعها ضمن أقرب تصنيف عام من القائمة.
- احتفظ بنوع الخدمة أو المهنة المحدد في "service".
- إذا كانت الخدمة جديدة أو غير مألوفة، لا تضعها في "أخرى" لمجرد أنها غير موجودة مسبقًا؛ اختر التصنيف العام الأقرب حسب معناها.
- استخدم "أخرى" فقط عندما لا يناسب الطلب أي تصنيف عام.
- فسّر مكان الخدمة كما كتبه المستخدم: مدينة، ريف، مدينة وريف، حي/منطقة محددة، أو عدة مناطق.
- إذا كتب المستخدم مدينة مع ريفها، استخدم "city_and_rural".
- إذا ذكر أحياء أو مناطق محددة، استخدم "specific_areas" أو "multiple_areas" حسب الحالة.
- لا تغيّر أو تخمّن المدينة أو المناطق.
- إذا كانت المعلومات الإضافية فارغة، استخدم null أو قيمة فارغة مناسبة.
- لا تجعل needs_clarification = true لمجرد أن معلومات اختيارية غير موجودة.
- استخدم needs_clarification = true فقط إذا كانت الخدمة نفسها غير مفهومة بما يكفي للمطابقة، واكتب سؤالًا قصيرًا.
- confidence رقم بين 0 و1 يعكس وضوح التحليل.`;
}

function extractJsonObject(raw: string): string | null {
  const text = raw
    .trim()
    .replace(/^\s*```(?:json)?\s*/i, "")
    .replace(/\s*```\s*$/i, "")
    .trim();
  const first = text.indexOf("{");
  const last = text.lastIndexOf("}");
  if (first === -1 || last <= first) return null;
  return text.slice(first, last + 1);
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  // Real signed-in user only + 10 requests/minute and 60/day per user.
  const guard = await authenticateAndLimit(req, "analyze-service-request", 10, 60);
  if (guard instanceof Response) return guard;

  try {
    let body: any;
    try {
      body = await req.json();
    } catch {
      return json({ error: "Invalid JSON body" }, 400);
    }

    const requestText = typeof body?.request_text === "string" ? body.request_text.trim() : "";
    const providedServiceArea = typeof body?.service_area === "string" ? body.service_area.trim() : "";
    // Latakia is the app's default city when the user does not choose a specific area.
    const serviceArea = providedServiceArea || "اللاذقية";
    const additionalInfo = typeof body?.additional_info === "string" ? body.additional_info.trim() : "";

    if (!requestText) return json({ error: "request_text is required" }, 400);
    if (
      requestText.length > MAX_REQUEST_TEXT ||
      serviceArea.length > MAX_SERVICE_AREA ||
      additionalInfo.length > MAX_ADDITIONAL_INFO
    ) {
      return json({ error: "Input is too long" }, 400);
    }

    const apiKey = Deno.env.get("GEMINI_API_KEY");
    if (!apiKey) {
      console.error("[analyze-service-request] GEMINI_API_KEY is not configured");
      return json({ error: "Server configuration is incomplete" }, 500);
    }

    const response = await fetch(
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash-lite:generateContent",
      {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
        body: JSON.stringify({
          systemInstruction: {
            parts: [{ text: "You extract structured service-request information. Return valid JSON only." }],
          },
          contents: [{ role: "user", parts: [{ text: buildPrompt(requestText, serviceArea, additionalInfo) }] }],
          generationConfig: { temperature: 0.1, responseMimeType: "application/json" },
        }),
        signal: AbortSignal.timeout(45_000),
      },
    );

    if (!response.ok) {
      console.error("[analyze-service-request] Gemini failed:", response.status);
      return json({ error: "AI request failed" }, 502);
    }

    const result = await response.json();
    const content = result?.candidates?.[0]?.content?.parts
      ?.map((p: any) => p?.text ?? "")
      .join("")
      ?.trim();
    if (typeof content !== "string" || !content) return json({ error: "No AI response content returned" }, 502);

    const jsonCandidate = extractJsonObject(content);
    if (!jsonCandidate) return json({ error: "AI response did not contain a valid JSON object" }, 502);

    let structuredData: any;
    try {
      structuredData = JSON.parse(jsonCandidate);
    } catch {
      return json({ error: "AI returned invalid JSON" }, 502);
    }
    if (!structuredData || typeof structuredData !== "object" || Array.isArray(structuredData)) {
      return json({ error: "AI returned invalid JSON" }, 502);
    }

    if (!allowedCategories.includes(structuredData.category)) structuredData.category = "أخرى";

    const confidence =
      typeof structuredData.confidence === "number" ? Math.max(0, Math.min(1, structuredData.confidence)) : null;
    const needsClarification = structuredData.needs_clarification === true;
    const clarificationQuestion =
      typeof structuredData.clarification_question === "string" && structuredData.clarification_question.trim()
        ? structuredData.clarification_question.trim()
        : null;

    structuredData.service_area = {
      ...(structuredData.service_area && typeof structuredData.service_area === "object"
        ? structuredData.service_area
        : {}),
      raw: serviceArea,
    };
    structuredData.additional_info = additionalInfo || null;

    return json({
      original_text: requestText,
      structured_data: structuredData,
      ai_confidence: confidence,
      needs_clarification: needsClarification,
      clarification_question: clarificationQuestion,
    });
  } catch (error) {
    console.error("[analyze-service-request] unexpected error:", error instanceof Error ? error.message : "unknown");
    return json({ error: "Unexpected server error" }, 500);
  }
});
