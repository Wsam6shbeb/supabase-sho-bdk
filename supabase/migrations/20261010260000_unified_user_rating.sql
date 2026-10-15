-- One rating per person, shared by their roles as customer and as provider.
-- Everybody starts with N virtual 5-star ratings (app_settings.rating_virtual_count, default 4) so one bad rating
-- can't ruin a new account: avg = (5*N + sum(real scores)) / (N + real count).

alter table public.users
  add column if not exists rating_avg numeric(3,2) not null default 5.00,
  add column if not exists rating_count integer not null default 0;

alter table public.provider_profiles
  add column if not exists rating_count integer not null default 0;

insert into public.app_settings (key, value)
values ('rating_virtual_count', '4'::jsonb)
on conflict (key) do nothing;

create or replace function public._recompute_user_rating(p_user uuid)
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_virtual int;
  v_sum numeric;
  v_cnt int;
  v_avg numeric;
begin
  if p_user is null then
    return;
  end if;
  v_virtual := coalesce((select (value)::text::integer from public.app_settings where key = 'rating_virtual_count'), 4);
  select coalesce(sum(r.score), 0), count(*) into v_sum, v_cnt from public.ratings r where r.to_user_id = p_user;
  v_avg := round((v_sum + v_virtual * 5)::numeric / (v_cnt + v_virtual), 2);

  update public.users set rating_avg = v_avg, rating_count = v_cnt where id = p_user;
  update public.provider_profiles set rating_avg = v_avg, rating_count = v_cnt where user_id = p_user;
end;
$$;
revoke all on function public._recompute_user_rating(uuid) from public, anon, authenticated;

create or replace function public.ratings_refresh_user_rating()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  if tg_op in ('INSERT', 'UPDATE') then
    perform public._recompute_user_rating(new.to_user_id);
  end if;
  if tg_op = 'DELETE' or (tg_op = 'UPDATE' and old.to_user_id is distinct from new.to_user_id) then
    perform public._recompute_user_rating(old.to_user_id);
  end if;
  return null;
end;
$$;

drop trigger if exists ratings_refresh_user_rating_trg on public.ratings;
create trigger ratings_refresh_user_rating_trg
  after insert or update of score, to_user_id or delete on public.ratings
  for each row execute function public.ratings_refresh_user_rating();

-- The other party's general rating (only for the two people in a conversation).
create or replace function public.get_counterparty_rating(p_conversation_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path to 'public'
as $$
declare
  v_uid uuid := auth.uid();
  v_conv public.conversations;
  v_other uuid;
begin
  if v_uid is null then
    return null;
  end if;
  select * into v_conv from public.conversations c
   where c.id = p_conversation_id and (c.requester_id = v_uid or c.provider_id = v_uid);
  if not found then
    return null;
  end if;
  v_other := case when v_conv.requester_id = v_uid then v_conv.provider_id else v_conv.requester_id end;
  return (select jsonb_build_object('avg', u.rating_avg, 'count', u.rating_count) from public.users u where u.id = v_other);
end;
$$;
revoke all on function public.get_counterparty_rating(uuid) from public, anon;
grant execute on function public.get_counterparty_rating(uuid) to authenticated;

-- Backfill every existing user (customers and providers).
select public._recompute_user_rating(u.id) from public.users u;
