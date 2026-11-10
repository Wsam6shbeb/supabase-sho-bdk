
alter table public.verifications
  alter column id_document_url drop not null,
  alter column selfie_url drop not null;

create or replace function public.get_verification_cleanup_secret()
returns text
language sql
stable
security definer
set search_path = ''
as $function$
  select decrypted_secret
  from vault.decrypted_secrets
  where name = 'verification_cleanup_secret'
  limit 1;
$function$;

revoke all on function public.get_verification_cleanup_secret() from public, anon, authenticated;
grant execute on function public.get_verification_cleanup_secret() to service_role;

create or replace function public.clear_expired_verification_file_urls(p_user_id uuid)
returns integer
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_count integer := 0;
begin
  if p_user_id is null then
    raise exception 'INVALID_USER_ID' using errcode = '22023';
  end if;

  update public.verifications v
     set id_document_url = null,
         selfie_url = null
   where v.user_id = p_user_id
     and (v.id_document_url is not null or v.selfie_url is not null)
     and exists (
       select 1
         from public.users u
        where u.id = p_user_id
          and u.deleted_at is not null
          and u.deleted_at <= now() - interval '3 months'
     );

  get diagnostics v_count = row_count;
  return v_count;
end;
$function$;

revoke all on function public.clear_expired_verification_file_urls(uuid) from public, anon, authenticated;
grant execute on function public.clear_expired_verification_file_urls(uuid) to service_role;

do $block$
begin
  if not exists (
    select 1 from vault.secrets where name = 'verification_cleanup_secret'
  ) then
    perform vault.create_secret(
      encode(gen_random_bytes(32), 'hex'),
      'verification_cleanup_secret'
    );
  end if;
end;
$block$;
;
