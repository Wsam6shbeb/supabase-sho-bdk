CREATE TABLE IF NOT EXISTS public.push_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  token text NOT NULL UNIQUE,
  platform text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS push_tokens_user_idx ON public.push_tokens (user_id);

ALTER TABLE public.push_tokens ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS push_tokens_owner_read ON public.push_tokens;
CREATE POLICY push_tokens_owner_read ON public.push_tokens FOR SELECT USING (user_id = auth.uid());
DROP POLICY IF EXISTS push_tokens_owner_delete ON public.push_tokens;
CREATE POLICY push_tokens_owner_delete ON public.push_tokens FOR DELETE USING (user_id = auth.uid());

REVOKE ALL ON public.push_tokens FROM anon, authenticated;
GRANT SELECT, DELETE ON public.push_tokens TO authenticated;

CREATE OR REPLACE FUNCTION public.register_push_token(p_token text, p_platform text DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
begin
  if auth.uid() is null then
    raise exception 'NOT_AUTHENTICATED' using errcode = '28000';
  end if;
  if p_token is null or length(trim(p_token)) < 10 then
    raise exception 'INVALID_TOKEN' using errcode = 'P0001';
  end if;

  insert into push_tokens (user_id, token, platform)
  values (auth.uid(), trim(p_token), p_platform)
  on conflict (token) do update
    set user_id = excluded.user_id, platform = excluded.platform, updated_at = now();
end;
$$;

CREATE OR REPLACE FUNCTION public.unregister_push_token(p_token text)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  delete from public.push_tokens where token = trim(p_token) and user_id = auth.uid();
$$;

REVOKE ALL ON FUNCTION public.register_push_token(text, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.unregister_push_token(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.register_push_token(text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.unregister_push_token(text) TO authenticated;

CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

DO $$
begin
  if not exists (select 1 from vault.secrets where name = 'push_webhook_secret') then
    perform vault.create_secret(encode(gen_random_bytes(32), 'hex'), 'push_webhook_secret',
                                'Shared secret between the DB trigger and the send-push Edge Function');
  end if;
  if not exists (select 1 from vault.secrets where name = 'push_function_url') then
    perform vault.create_secret('https://cmflpnweojteblxrpzgq.supabase.co/functions/v1/send-push',
                                'push_function_url', 'send-push Edge Function URL');
  end if;
end $$;

CREATE OR REPLACE FUNCTION public.get_push_secret()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  select decrypted_secret from vault.decrypted_secrets where name = 'push_webhook_secret' limit 1;
$$;
REVOKE ALL ON FUNCTION public.get_push_secret() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_push_secret() TO service_role;

CREATE OR REPLACE FUNCTION public.push_on_notification()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
declare
  v_url text;
  v_secret text;
begin
  if tg_op = 'UPDATE' then
    if new.read_at is not null
       or coalesce(new.payload->>'count', '') = coalesce(old.payload->>'count', '') then
      return new;
    end if;
  end if;

  if not exists (select 1 from push_tokens where user_id = new.user_id) then
    return new;
  end if;

  begin
    select decrypted_secret into v_url from vault.decrypted_secrets where name = 'push_function_url' limit 1;
    select decrypted_secret into v_secret from vault.decrypted_secrets where name = 'push_webhook_secret' limit 1;
    if v_url is not null and v_secret is not null then
      perform net.http_post(
        url := v_url,
        body := jsonb_build_object('notification_id', new.id),
        headers := jsonb_build_object('Content-Type', 'application/json', 'x-push-secret', v_secret)
      );
    end if;
  exception when others then
    raise warning 'push_on_notification failed: %', sqlerrm;
  end;

  return new;
end;
$$;
REVOKE ALL ON FUNCTION public.push_on_notification() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS notifications_push_trg ON public.notifications;
CREATE TRIGGER notifications_push_trg
  AFTER INSERT OR UPDATE OF payload ON public.notifications
  FOR EACH ROW EXECUTE FUNCTION public.push_on_notification();;
