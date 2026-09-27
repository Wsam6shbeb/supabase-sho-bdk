// ===============================================================
// شرح الملف: هذا بيانات/خدمات تجريبية Mock (orderAnalysis.mock).
// الهدف: توضيح وظيفة الملف ومهام الدوال دون تغيير منطق البرنامج.
// الدوال/الوظائف المعرّفة هنا: analyzeOrderDescription.
// ملاحظة: التعليقات التالية للشرح فقط؛ لا تغيّر سلوك الكود.
// ===============================================================

// ═══════════════════════════════════════════════════════════
// محاكاة تحليل الطلب باستخدام الذكاء الاصطناعي
// ═══════════════════════════════════════════════════════════
// ⚠️ محاكاة مؤقتة بديلة عن الباك إند — لما الذكاء الاصطناعي الحقيقي يجهز،
// هاد الملف كامل يُحذف ويُستبدل بنداء API فعلي يحلل نص الطلب.
//
// المنطق هون بسيط قصداً (طول النص بس) عشان يعطي تجربة قابلة للاختبار بالواجهة،
// وما إله علاقة بمنطق التحليل الحقيقي يلي رح يبني عليه الباك إند.

export interface OrderAnalysisResult {
  needsClarification: boolean;
  clarificationQuestion?: string;
}

const MIN_CLEAR_LENGTH = 20;

// [شرح الدالة: analyzeOrderDescription] يحلل وصف طلب الخدمة التجريبي ويستخرج المعلومات التي يستخدمها منطق الطلب.
export function analyzeOrderDescription(
  description: string,
  clarificationAnswer?: string,
): OrderAnalysisResult {
  // إذا المستخدم أصلاً جاوب على سؤال توضيحي، منعتبر الفهم صار كافي (بمحاكاتنا هون
  // ما منسأل أكتر من سؤال وحيد — الباك إند الحقيقي ممكن يقرر يسأل أكتر من مرة).
  if (clarificationAnswer && clarificationAnswer.trim().length > 0) {
    return { needsClarification: false };
  }

  if (description.trim().length < MIN_CLEAR_LENGTH) {
    return {
      needsClarification: true,
      clarificationQuestion: 'ممكن توضّح أكتر؟ شو بالضبط نوع الخدمة يلي بدك ياها؟',
    };
  }

  return { needsClarification: false };
}
