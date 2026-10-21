-- ===============================================================
-- نظام التوثيق الحقيقي (هوية أمامية + سيلفي، بقرار الأدمن)
-- لا يحذف أي جدول أو بيانات. جدول verifications موجود (0 صفوف وقت الكتابة).
-- ===============================================================

-- 1) مساحة تخزين خاصة للصور (ليست عامة، 5MB كحد أقصى، صور فقط)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('verification-docs', 'verification-docs', false, 5242880, array['image/jpeg', 'image/png'])
on conflict (id) do update
  set public = false,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- المستخدم يرفع فقط داخل مجلد باسم معرّفه. لا قراءة ولا تعديل ولا حذف من التطبيق:
-- الصور أدلة، والأدمن يقرأها من الخادم (service role) فقط.
drop policy if exists verification_docs_owner_insert on storage.objects;
create policy verification_docs_owner_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'verification-docs'
    and (storage.foldername(name))[1] = auth.uid()::text
    and public.current_user_is_active()
  );

-- 2) إغلاق ثغرة: كان المستخدم يقدر يُدخل صفاً بحالة approved بنفسه.
--    نسمح فقط بالأعمدة الثلاثة، والباقي (status, reviewed_*) يأخذ القيم الافتراضية.
revoke insert on public.verifications from authenticated, anon;
grant insert (user_id, id_document_url, selfie_url) on public.verifications to authenticated;

-- 3) طلب واحد قيد المراجعة لكل مستخدم
create unique index if not exists verifications_one_pending_per_user
  on public.verifications (user_id) where status = 'pending';

-- 4) المسارات إلزامية وتقع داخل مجلد صاحب الطلب
alter table public.verifications alter column id_document_url set not null;
alter table public.verifications alter column selfie_url set not null;
alter table public.verifications drop constraint if exists verifications_paths_own_folder;
alter table public.verifications add constraint verifications_paths_own_folder check (
  id_document_url like user_id::text || '/%' and selfie_url like user_id::text || '/%'
);

-- 5) قرار الأدمن (ذرّي: صف الطلب + حالة المستخدم + سجل التدقيق).
--    يُستدعى من خادم لوحة التحكم بمفتاح service_role فقط.
create or replace function public.decide_verification(
  p_id uuid, p_decision text, p_reason text, p_admin uuid
) returns jsonb
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  v public.verifications;
  v_reason text := nullif(btrim(coalesce(p_reason, '')), '');
begin
  if p_decision not in ('approved', 'rejected') then
    raise exception 'INVALID_DECISION' using errcode = 'P0001';
  end if;
  if p_decision = 'rejected' and v_reason is null then
    raise exception 'REASON_REQUIRED' using errcode = 'P0001';
  end if;

  select * into v from public.verifications where id = p_id for update;
  if not found then
    raise exception 'VERIFICATION_NOT_FOUND' using errcode = 'P0002';
  end if;
  if v.status <> 'pending' then
    raise exception 'ALREADY_DECIDED' using errcode = 'P0001';
  end if;

  update public.verifications
     set status = p_decision::public.verification_status,
         rejection_reason = case when p_decision = 'rejected' then v_reason else null end,
         reviewed_by = p_admin,
         reviewed_at = now()
   where id = p_id;

  update public.users
     set verification_status = p_decision::public.verification_status
   where id = v.user_id;

  insert into public.audit_log (actor_id, action, entity_type, entity_id, metadata)
  values (p_admin, 'admin_decide_verification', 'verification', p_id,
          jsonb_build_object('decision', p_decision, 'user_id', v.user_id, 'reason', v_reason));

  return jsonb_build_object('id', p_id, 'user_id', v.user_id, 'status', p_decision);
end;
$$;

revoke all on function public.decide_verification(uuid, text, text, uuid) from public, anon, authenticated;
grant execute on function public.decide_verification(uuid, text, text, uuid) to service_role;

-- 6) حذف الحساب لا يمحو سجل التوثيق (يُحتفظ به للجهات المختصة عند الحاجة).
--    التعريف أدناه نسخة حرفية من الدالة الحالية في القاعدة، والتغيير الوحيد:
--    إزالة سطر "delete from public.verifications".
CREATE OR REPLACE FUNCTION public.delete_my_account()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_uid uuid := auth.uid();
  v_ongoing int;
begin
  if v_uid is null then
    raise exception 'NOT_AUTHENTICATED' using errcode = '28000';
  end if;

  -- Refuse while there is work in progress with another person.
  select count(*) into v_ongoing
    from public.agreements a
    join public.service_requests sr on sr.id = a.request_id
   where (a.requester_id = v_uid or a.provider_id = v_uid)
     and (
       a.state = 'pending'
       or (a.state = 'active' and sr.state in ('active', 'agreement_pending_provider'))
     );
  if v_ongoing > 0 then
    raise exception 'ACTIVE_WORK_IN_PROGRESS' using errcode = 'P0001';
  end if;

  -- Personal data owned by the user: delete.
  delete from public.push_tokens where user_id = v_uid;
  delete from public.notifications where user_id = v_uid;
  delete from public.phone_shares where from_user_id = v_uid;
  -- verifications: kept on purpose (safety / legal requests). Do not delete.
  delete from public.provider_services where provider_id = v_uid;

  -- Provider profile row must stay (agreements/conversations reference it): clear text, stop matching.
  update public.provider_profiles set bio = null, is_available = false where user_id = v_uid;

  -- Public profile: anonymize.
  update public.users
     set full_name = 'حساب محذوف',
         phone = null,
         region = null,
         avatar_url = null,
         is_provider = false,
         deleted_at = now()
   where id = v_uid;

  -- Sign-in identity: scrub email/metadata (name, Google picture...), unlink Google, end all sessions, block login.
  delete from auth.identities where user_id = v_uid;
  delete from auth.sessions where user_id = v_uid;
  update auth.users
     set email = 'deleted+' || id::text || '@deleted.invalid',
         phone = null,
         raw_user_meta_data = '{}'::jsonb,
         raw_app_meta_data = jsonb_build_object('deleted', true),
         banned_until = 'infinity'
   where id = v_uid;
end;
$function$;
