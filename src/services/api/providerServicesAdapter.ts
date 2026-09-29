// ===============================================================
// شرح الملف: طبقة "خدمات مقدّم الخدمة" (become provider) — تكتب/تقرأ
// من جدول provider_services بـ Supabase.
//
// ملاحظة: منح "مكافأة الانضمام" الفعلية بالمحفظة غير متاح من هون لأنو
// جدول ledger_entries ليس له سياسة INSERT من طرف العميل عن قصد (الكتابة
// المالية يجب أن تمر بدالة/RPC موثوقة بجانب السيرفر لاحقًا). القيمة
// المرئية للمستخدم حاليًا محلية فقط (تُدار من OrderContext كما كانت
// بالوضع التجريبي السابق).
// ===============================================================

import { supabase } from '@/services/supabase';
import type { ApiResponse } from '@/types/common';

export interface ProviderServiceRow {
  id: string;
  provider_id: string;
  skill_id: string | null;
  description: string;
  experience_years: number;
  price_min: number;
  price_max: number;
  structured_data: {
    service?: string | null;
    skills?: string[];
    region?: string | null;
    location?: string | null;
    synonyms?: string[];
  } | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface CreateProviderServiceInput {
  description: string;
  experience_years: number;
  price_min: number;
  price_max: number;
}

// [شرح الدالة: getCurrentUserId] يجلب معرّف المستخدم الحالي من جلسة Supabase.
async function getCurrentUserId(): Promise<string | null> {
  const { data } = await supabase.auth.getUser();
  return data.user?.id ?? null;
}

// [شرح الدالة: analyzeProviderService] يرسل وصف الخدمة إلى Edge Function لتحليله بالذكاء الاصطناعي.
// إذا فشل التحليل، لا نمنع حفظ الخدمة الأصلية؛ حتى لا تتعطل تجربة المستخدم بسبب خدمة AI مؤقتًا.
async function analyzeProviderService(serviceText: string): Promise<ProviderServiceRow['structured_data']> {
  try {
    const { data, error } = await supabase.functions.invoke('analyze-provider-service', {
      body: { service_text: serviceText },
    });

    if (error) {
      console.error('[Supabase][providerServices][AI] فشل تحليل الخدمة:', error.message);
      return null;
    }

    if (!data?.structured_data || typeof data.structured_data !== 'object') {
      console.error('[Supabase][providerServices][AI] لم تصل بيانات منظمة صالحة.');
      return null;
    }

    return data.structured_data as ProviderServiceRow['structured_data'];
  } catch (error) {
    console.error('[Supabase][providerServices][AI] خطأ غير متوقع أثناء تحليل الخدمة:', error);
    return null;
  }
}

// [شرح الدالة: create] ينشئ خدمة جديدة لمقدّم الخدمة الحالي، وينشئ ملفه التعريفي كمزوّد إن لم يكن موجودًا.
// قبل الحفظ، يحلل النص الحر بالذكاء الاصطناعي ويحفظ النتيجة في structured_data.
async function create(input: CreateProviderServiceInput): Promise<ApiResponse<ProviderServiceRow>> {
  const userId = await getCurrentUserId();
  if (!userId) {
    return { success: false, error: { code: 'UNAUTHENTICATED', message: 'يجب تسجيل الدخول لإضافة خدمة.' } };
  }

  const description = input.description.trim();
  const structuredData = await analyzeProviderService(description);

  // أول خدمة يضيفها المستخدم تنشئ سجل provider_profiles تلقائيًا (لا يوجد trigger لهذا بقاعدة البيانات).
  const { error: profileError } = await supabase
    .from('provider_profiles')
    .upsert({ user_id: userId }, { onConflict: 'user_id', ignoreDuplicates: true });
  if (profileError) {
    return { success: false, error: { code: profileError.code || 'DB_ERROR', message: profileError.message } };
  }

  const { data, error } = await supabase
    .from('provider_services')
    .insert({
      provider_id: userId,
      description,
      experience_years: input.experience_years,
      price_min: input.price_min,
      price_max: input.price_max,
      structured_data: structuredData,
    })
    .select()
    .single();

  if (error) {
    return { success: false, error: { code: error.code || 'DB_ERROR', message: error.message } };
  }

  // أفضل محاولة (best-effort): تعليم المستخدم كمزوّد؛ فشلها لا يُسقط نجاح إضافة الخدمة نفسها.
  await supabase.from('users').update({ is_provider: true }).eq('id', userId);

  return { success: true, data: data as ProviderServiceRow };
}

// [شرح الدالة: mine] يجلب خدمات مقدّم الخدمة الحالي.
async function mine(): Promise<ApiResponse<ProviderServiceRow[]>> {
  const userId = await getCurrentUserId();
  if (!userId) {
    return { success: false, error: { code: 'UNAUTHENTICATED', message: 'يجب تسجيل الدخول لعرض الخدمات.' } };
  }

  const { data, error } = await supabase
    .from('provider_services')
    .select('*')
    .eq('provider_id', userId)
    .order('created_at', { ascending: false });

  if (error) {
    return { success: false, error: { code: error.code || 'DB_ERROR', message: error.message } };
  }

  return { success: true, data: (data ?? []) as ProviderServiceRow[] };
}

export const providerServices = { create, mine };
