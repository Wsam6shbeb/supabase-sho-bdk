-- Public display names: keep full_name private/internal and expose display_name through approved read RPCs.
alter table public.users
  add column if not exists display_name text,
  add column if not exists display_name_normalized text,
  add column if not exists display_name_changed_at timestamptz,
  add column if not exists display_name_prompted_at timestamptz;

create unique index if not exists users_display_name_normalized_key
  on public.users (display_name_normalized)
  where display_name_normalized is not null;

create or replace function public.guard_display_name_write()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if (new.display_name is distinct from old.display_name
      or new.display_name_normalized is distinct from old.display_name_normalized
      or new.display_name_changed_at is distinct from old.display_name_changed_at
      or new.display_name_prompted_at is distinct from old.display_name_prompted_at)
     and current_setting('app.display_name_rpc', true) is distinct from 'on' then
    raise exception 'DISPLAY_NAME_WRITE_NOT_ALLOWED' using errcode = '42501';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_guard_display_name_write on public.users;
create trigger trg_guard_display_name_write
before update on public.users
for each row execute function public.guard_display_name_write();

create or replace function public.set_my_display_name(p_display_name text)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_name text;
  v_normalized text;
  v_digits text;
begin
  if v_user_id is null or not public.current_user_is_active() then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;

  v_name := nullif(regexp_replace(btrim(coalesce(p_display_name, '')), '\s+', ' ', 'g'), '');
  if v_name is not null then
    if char_length(v_name) < 2 or char_length(v_name) > 40 then
      raise exception 'DISPLAY_NAME_LENGTH' using errcode = '22023';
    end if;
    if v_name ~ '[[:cntrl:]]' or v_name ~* 'https?://' then
      raise exception 'DISPLAY_NAME_INVALID' using errcode = '22023';
    end if;
    v_digits := regexp_replace(translate(v_name, '٠١٢٣٤٥٦٧٨٩۰۱۲۳۴۵۶۷۸۹', '01234567890123456789'), '[^0-9]', '', 'g');
    if char_length(v_digits) >= 7 then
      raise exception 'DISPLAY_NAME_PHONE_NOT_ALLOWED' using errcode = '22023';
    end if;
  end if;

  v_normalized := case when v_name is null then null else lower(v_name) end;
  perform set_config('app.display_name_rpc', 'on', true);

  begin
    update public.users
       set display_name = v_name,
           display_name_normalized = v_normalized,
           display_name_changed_at = now(),
           display_name_prompted_at = coalesce(display_name_prompted_at, now())
     where id = v_user_id;
  exception when unique_violation then
    raise exception 'DISPLAY_NAME_TAKEN' using errcode = '23505';
  end;

  return jsonb_build_object(
    'display_name', v_name,
    'display_name_prompted_at', (select u.display_name_prompted_at from public.users u where u.id = v_user_id)
  );
end;
$$;

create or replace function public.skip_my_display_name_prompt()
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_prompted_at timestamptz;
begin
  if v_user_id is null or not public.current_user_is_active() then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;

  perform set_config('app.display_name_rpc', 'on', true);
  update public.users
     set display_name_prompted_at = coalesce(display_name_prompted_at, now())
   where id = v_user_id
  returning display_name_prompted_at into v_prompted_at;

  return jsonb_build_object('display_name_prompted_at', v_prompted_at);
end;
$$;

revoke all on function public.guard_display_name_write() from public, anon, authenticated;
revoke all on function public.set_my_display_name(text) from public, anon;
revoke all on function public.skip_my_display_name_prompt() from public, anon;
grant execute on function public.set_my_display_name(text) to authenticated;
grant execute on function public.skip_my_display_name_prompt() to authenticated;

-- Keep the existing RPC contracts intact; only substitute the public-facing name expression.
do $$
declare
  v_definition text;
  v_updated text;
begin
  v_definition := pg_get_functiondef('public.get_request_candidates(uuid)'::regprocedure);
  v_updated := replace(v_definition, 'u.full_name,', 'coalesce(nullif(u.display_name, ''''), u.full_name),');
  if v_updated = v_definition then raise exception 'Could not update get_request_candidates name expression'; end if;
  execute v_updated;

  v_definition := pg_get_functiondef('public.get_provider_candidates(uuid,integer)'::regprocedure);
  v_updated := replace(v_definition, 'u.full_name,', 'coalesce(nullif(u.display_name, ''''), u.full_name),');
  if v_updated = v_definition then raise exception 'Could not update get_provider_candidates name expression'; end if;
  execute v_updated;

  v_definition := pg_get_functiondef('public.get_my_conversations()'::regprocedure);
  v_updated := replace(v_definition, 'o.full_name,', 'coalesce(nullif(o.display_name, ''''), o.full_name),');
  if v_updated = v_definition then raise exception 'Could not update get_my_conversations name expression'; end if;
  execute v_updated;

  v_definition := pg_get_functiondef('public.get_my_order_history()'::regprocedure);
  v_updated := replace(v_definition, 'u.full_name,', 'coalesce(nullif(u.display_name, ''''), u.full_name),');
  if v_updated = v_definition then raise exception 'Could not update get_my_order_history name expression'; end if;
  execute v_updated;

  v_definition := pg_get_functiondef('public.get_my_blocked_users()'::regprocedure);
  v_updated := replace(v_definition, 'coalesce(nullif(u.full_name, ''''), ''مستخدم'')',
    'coalesce(nullif(u.display_name, ''''), nullif(u.full_name, ''''), ''مستخدم'')');
  if v_updated = v_definition then raise exception 'Could not update get_my_blocked_users name expression'; end if;
  execute v_updated;

  v_definition := pg_get_functiondef('public.admin_find_users(text)'::regprocedure);
  v_updated := replace(v_definition, 'coalesce(nullif(u.full_name, ''''), ''—'')',
    'coalesce(nullif(u.display_name, ''''), nullif(u.full_name, ''''), ''—'')');
  if v_updated = v_definition then raise exception 'Could not update admin_find_users name expression'; end if;
  v_updated := replace(v_updated, 'where u.full_name ilike v_like',
    'where coalesce(nullif(u.display_name, ''''), u.full_name) ilike v_like or u.full_name ilike v_like');
  execute v_updated;

  v_definition := pg_get_functiondef('public.admin_get_user(uuid)'::regprocedure);
  v_updated := replace(v_definition, '''name'', v_u.full_name,',
    '''name'', coalesce(nullif(v_u.display_name, ''''), v_u.full_name),');
  if v_updated = v_definition then raise exception 'Could not update admin_get_user name expression'; end if;
  execute v_updated;
end;
$$;

notify pgrst, 'reload schema';
