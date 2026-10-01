import "jsr:@supabase/functions-js/edge-runtime.d.ts";

console.log("[STEP 0] analyze-service-request: module loaded");

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req: Request) => {
  console.log("[STEP 1] request received:", req.method);

  if (req.method === "OPTIONS") {
    console.log("[STEP 2] OPTIONS preflight");
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    console.log("[STEP 3] parsing body...");
    const body = await req.json();
    console.log("[STEP 4] body parsed:", JSON.stringify(body));

    const requestText =
      typeof body?.request_text === "string" ? body.request_text.trim() : "";
    const serviceArea =
      typeof body?.service_area === "string" ? body.service_area.trim() : "";
    const additionalInfo =
      typeof body?.additional_info === "string" ? body.additional_info.trim() : "";

    console.log("[STEP 5] requestText:", requestText, "| serviceArea:", serviceArea);

    if (!requestText || !serviceArea) {
      console.log("[STEP 6] MISSING requestText or serviceArea");
      return new Response(
        JSON.stringify({ error: "request_text and service_area are required" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    console.log("[STEP 7] reading OPENROUTER_API_KEY...");
    const apiKey = Deno.env.get("OPENROUTER_API_KEY");
    if (!apiKey) {
      console.log("[STEP 8] OPENROUTER_API_KEY NOT CONFIGURED");
      return new Response(
        JSON.stringify({ error: "OPENROUTER_API_KEY is not configured" }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }
    console.log("[STEP 9] API key found, length:", apiKey.length);

    const prompt = `حلّل طلب الخدمة التالي باللغة العربية وأعد JSON فقط بدون أي نص إضافي.

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

    console.log("[STEP 10] prompt built, sending to OpenRouter...");

    const response = await fetch(
      "https://openrouter.ai/api/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
          "HTTP-Referer": "https://sho-bdk.app",
          "X-Title": "Sho Bdk",
        },
        body: JSON.stringify({
          // بدل أي موديل قديم
model: "qwen/qwen3.8-27b:free",
          messages: [
            {
              role: "system",
              content:
                "You extract structured service-request information. Return valid JSON only.",
            },
            { role: "user", content: prompt },
          ],
          temperature: 0,
        }),
      },
    );

    console.log("[STEP 11] OpenRouter responded with status:", response.status);

    const result = await response.json();
    console.log("[STEP 12] OpenRouter result:", JSON.stringify(result).slice(0, 500));

    if (!response.ok) {
      console.log("[STEP 13] OpenRouter request FAILED");
      return new Response(
        JSON.stringify({ error: "OpenRouter request failed", details: result }),
        {
          status: 502,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const content = result?.choices?.[0]?.message?.content;
    console.log("[STEP 14] content type:", typeof content);

    if (typeof content !== "string") {
      console.log("[STEP 15] No AI response content returned");
      return new Response(
        JSON.stringify({ error: "No AI response content returned" }),
        {
          status: 502,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const extractJsonObject = (raw: string): string | null => {
      let text = raw.trim();

      text = text
        .replace(/^\s*\`\`\`(?:json)?\s*/i, "")
        .replace(/\s*\`\`\`\s*$/i, "")
        .trim();

      const firstBrace = text.indexOf("{");
      const lastBrace = text.lastIndexOf("}");

      if (firstBrace === -1 || lastBrace <= firstBrace) return null;
      return text.slice(firstBrace, lastBrace + 1);
    };

    console.log("[STEP 16] extracting JSON...");
    const jsonCandidate = extractJsonObject(content);

    if (!jsonCandidate) {
      console.log("[STEP 17] AI response was not a JSON object:", content);
      return new Response(
        JSON.stringify({ error: "AI response did not contain a valid JSON object" }),
        {
          status: 502,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    let structuredData;
    try {
      console.log("[STEP 18] parsing JSON...");
      structuredData = JSON.parse(jsonCandidate);
      console.log("[STEP 19] JSON parsed successfully");
    } catch (parseError) {
      console.log("[STEP 20] Failed to parse AI JSON:", parseError, "content:", content);
      return new Response(
        JSON.stringify({ error: "AI returned invalid JSON" }),
        {
          status: 502,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

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

    if (!allowedCategories.includes(structuredData?.category)) {
      structuredData.category = "أخرى";
    }

    const confidence =
      typeof structuredData?.confidence === "number"
        ? Math.max(0, Math.min(1, structuredData.confidence))
        : null;

    const needsClarification =
      structuredData?.needs_clarification === true;

    const clarificationQuestion =
      typeof structuredData?.clarification_question === "string" &&
      structuredData.clarification_question.trim()
        ? structuredData.clarification_question.trim()
        : null;

    structuredData.service_area = {
      ...(structuredData?.service_area && typeof structuredData.service_area === "object"
        ? structuredData.service_area
        : {}),
      raw: serviceArea,
    };
    structuredData.additional_info = additionalInfo || null;

    console.log("[STEP 21] SUCCESS! Returning response");

    return new Response(
      JSON.stringify({
        original_text: requestText,
        structured_data: structuredData,
        ai_confidence: confidence,
        needs_clarification: needsClarification,
        clarification_question: clarificationQuestion,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (error) {
    console.log("[STEP 99] UNEXPECTED ERROR:", error);
    console.log("[STEP 99] error message:", error instanceof Error ? error.message : String(error));
    console.log("[STEP 99] error stack:", error instanceof Error ? error.stack : "no stack");
    return new Response(
      JSON.stringify({ error: "Unexpected server error", details: String(error) }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});