// ===============================================================
// توثيق الحساب — الرفع الحقيقي إلى Supabase
// الصور تُرفع إلى bucket خاص (verification-docs) داخل مجلد باسم معرّف المستخدم،
// ثم يُنشأ صف في جدول verifications بحالة pending. قرار القبول/الرفض بيد الأدمن فقط.
// ===============================================================

import { supabase } from '@/services/supabase';
import type { SupabaseClient } from '@supabase/supabase-js';

export type MyVerificationStatus = 'not_verified' | 'under_review' | 'verified' | 'rejected';

export interface MyVerification {
  status: MyVerificationStatus;
  submittedAt: string | null;
  rejectionReason: string | null;
}

export const EMPTY_VERIFICATION: MyVerification = {
  status: 'not_verified',
  submittedAt: null,
  rejectionReason: null,
};

const BUCKET = 'verification-docs';
// حد أقصى لطول نص base64 (≈ 5MB صورة) ليتوافق مع حد الـ bucket
const MAX_BASE64_LENGTH = 6_800_000;

// نتعامل مع الجدول بدون أنواع مولّدة حتى لا يتعطل البناء إن لم تُحدَّث database.ts
const db = supabase as unknown as SupabaseClient;

function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}

/**
 * حالة التوثيق كما يراها المستخدم:
 * - users.verification_status = approved  → موثّق
 * - وإلا آخر طلب: pending → قيد المراجعة، rejected → مرفوض (مع السبب)
 * - لا طلبات → غير موثّق
 */
export async function fetchMyVerification(userId: string): Promise<MyVerification> {
  const [userRes, reqRes] = await Promise.all([
    db.from('users').select('verification_status').eq('id', userId).maybeSingle(),
    db
      .from('verifications')
      .select('status, rejection_reason, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  if (userRes.error) throw userRes.error;
  if (reqRes.error) throw reqRes.error;

  const latest = reqRes.data as
    | { status: string; rejection_reason: string | null; created_at: string }
    | null;

  if (userRes.data?.verification_status === 'approved') {
    return {
      status: 'verified',
      submittedAt: latest?.created_at ?? null,
      rejectionReason: null,
    };
  }
  if (latest?.status === 'pending') {
    return { status: 'under_review', submittedAt: latest.created_at, rejectionReason: null };
  }
  if (latest?.status === 'rejected') {
    return {
      status: 'rejected',
      submittedAt: latest.created_at,
      rejectionReason: latest.rejection_reason,
    };
  }
  return EMPTY_VERIFICATION;
}

export interface SubmitResult {
  ok: boolean;
  message?: string;
}

/** يرفع صورتي الهوية والسيلفي (base64 JPEG) وينشئ طلب التوثيق. */
export async function submitVerificationPhotos(
  userId: string,
  idBase64: string,
  selfieBase64: string,
): Promise<SubmitResult> {
  if (idBase64.length > MAX_BASE64_LENGTH || selfieBase64.length > MAX_BASE64_LENGTH) {
    return { ok: false, message: 'حجم الصورة كبير. أعد التقاطها من مسافة أقرب وبإضاءة جيدة.' };
  }

  const stamp = Date.now();
  const idPath = `${userId}/${stamp}-id.jpg`;
  const selfiePath = `${userId}/${stamp}-selfie.jpg`;

  try {
    const idUpload = await db.storage
      .from(BUCKET)
      .upload(idPath, base64ToArrayBuffer(idBase64), { contentType: 'image/jpeg', upsert: false });
    if (idUpload.error) throw idUpload.error;

    const selfieUpload = await db.storage
      .from(BUCKET)
      .upload(selfiePath, base64ToArrayBuffer(selfieBase64), {
        contentType: 'image/jpeg',
        upsert: false,
      });
    if (selfieUpload.error) throw selfieUpload.error;

    const { error } = await db.from('verifications').insert({
      user_id: userId,
      id_document_url: idPath,
      selfie_url: selfiePath,
    });
    if (error) {
      // 23505 = يوجد طلب قيد المراجعة مسبقاً
      if ((error as { code?: string }).code === '23505') {
        return { ok: false, message: 'لديك طلب توثيق قيد المراجعة بالفعل.' };
      }
      throw error;
    }
    return { ok: true };
  } catch (err) {
    const message = (err as { message?: string })?.message ?? '';
    if (message.includes('ACCOUNT_SUSPENDED')) {
      return { ok: false, message: 'حسابك موقوف حالياً.' };
    }
    console.error('[verification] فشل إرسال طلب التوثيق:', message);
    return { ok: false, message: 'تعذّر إرسال الطلب. تحقق من الاتصال وحاول مجدداً.' };
  }
}
