-- The rated party must only ever see their general (average) rating, never who rated them or how much.

-- 1) Provider jobs no longer expose the score each customer gave (column kept as NULL for compatibility).
create or replace function public.get_my_provider_jobs()
returns table(agreement_id uuid, request_id uuid, conversation_id uuid, agreement_state text, request_state text, requester_id uuid, requester_name text, request_text text, region text, price numeric, commission_amount numeric, created_at timestamp with time zone, expires_at timestamp with time zone, completed_at timestamp with time zone, rating_received integer, rating_given integer)
language sql
stable security definer
set search_path to 'public'
as $function$
  select
    a.id,
    a.request_id,
    a.conversation_id,
    a.state::text,
    sr.state::text,
    a.requester_id,
    coalesce(nullif(u.full_name, ''), 'زبون'),
    sr.raw_text,
    sr.region,
    a.price,
    a.commission_amount,
    a.created_at,
    a.expires_at,
    sr.completed_at,
    null::int,
    rg.score::int
  from public.agreements a
  join public.service_requests sr on sr.id = a.request_id
  join public.users u on u.id = a.requester_id
  left join public.ratings rg
         on rg.request_id = a.request_id and rg.from_user_id = a.provider_id
  where a.provider_id = auth.uid()
  order by a.created_at desc
  limit 100;
$function$;

-- 2) Ratings table: a user can read only the ratings they GAVE (all aggregation/status RPCs are security definer).
drop policy if exists ratings_read on public.ratings;
create policy ratings_read on public.ratings
  for select to authenticated
  using (auth.uid() = from_user_id);

-- 3) Old notifications named the rater and the score: make them neutral.
update public.notifications
   set payload = payload || jsonb_build_object('title', 'حصلت على تقييم جديد', 'body', 'تم تحديث تقييمك العام.')
 where type = 'rating_received';
