CREATE OR REPLACE FUNCTION public.jsonb_place_texts(j jsonb)
RETURNS text[]
LANGUAGE sql
IMMUTABLE PARALLEL SAFE
SET search_path = public
AS $$
  select case jsonb_typeof(j)
    when 'string' then array[j #>> '{}']
    when 'object' then
      array_remove(array[j->>'city', j->>'raw'], null)
      || coalesce(
           case when jsonb_typeof(j->'areas') = 'array'
                then (select array_agg(a) from jsonb_array_elements_text(j->'areas') a) end,
           '{}'::text[])
    else '{}'::text[]
  end;
$$;

CREATE OR REPLACE FUNCTION public.get_provider_candidates(p_request_id uuid, p_limit integer DEFAULT 50)
RETURNS TABLE(
  provider_id uuid,
  rating_avg numeric,
  completed_services_count integer,
  full_name text,
  avatar_url text,
  region text,
  verification_status text,
  services jsonb,
  preliminary_score integer
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
with request_row as (
  select
    sr.id,
    sr.requester_id,
    coalesce(sr.structured_data, '{}'::jsonb) as data,
    array_remove(array[public.norm_region(u.region), public.norm_region(sr.region)], '') as cities,
    array_remove(
      array[
        public.norm_region(u.region), public.norm_region(sr.region), public.norm_region(sr.service_area),
        public.norm_region(sr.structured_data->>'region'), public.norm_region(sr.structured_data->>'location')
      ] || coalesce(
        (select array_agg(public.norm_region(x)) from unnest(public.jsonb_place_texts(sr.structured_data->'service_area')) x),
        '{}'::text[]),
      '') as places
  from public.service_requests sr
  join public.users u on u.id = sr.requester_id
  where sr.id = p_request_id
    and sr.requester_id = auth.uid()
  limit 1
),

request_terms as (
  select distinct t.term
  from request_row r
  cross join lateral (
    select regexp_split_to_table(
      public.norm_ar(concat_ws(' ',
        r.data->>'service',
        r.data->>'category',
        public.jsonb_text_list(r.data->'skills'),
        public.jsonb_text_list(r.data->'synonyms'))),
      ' +') as raw
  ) w
  cross join lateral (
    select regexp_replace(w.raw, '^ال', '') as base
  ) b
  cross join lateral (
    values (b.base),
           (case when length(b.base) >= 5 then left(b.base, greatest(4, length(b.base) - 1)) end)
  ) t(term)
  where t.term is not null
    and length(t.term) >= 3
    and t.term not in ('خدمه', 'خدمات', 'عام', 'عامه', 'اعمال', 'مهام', 'مهارات')
),

provider_docs as (
  select
    ps.provider_id,
    public.norm_ar(concat_ws(' ',
      ps.description,
      ps.structured_data->>'service',
      ps.structured_data->>'category',
      public.jsonb_text_list(ps.structured_data->'skills'),
      public.jsonb_text_list(ps.structured_data->'synonyms'))) as doc,
    public.norm_ar(ps.structured_data->>'category') as category,
    array_remove(
      array[
        public.norm_region(ps.structured_data->>'region'),
        public.norm_region(ps.structured_data->>'location')
      ] || coalesce(
        (select array_agg(public.norm_region(x)) from unnest(public.jsonb_place_texts(ps.structured_data->'service_area')) x),
        '{}'::text[]),
      '') as places
  from public.provider_services ps
  where ps.is_active = true
),

provider_scored as (
  select
    pd.provider_id,
    public.norm_region(u.region) as profile_region,
    count(distinct rt.term)::integer as word_matches,
    case when (select public.norm_ar(data->>'category') from request_row) <> ''
          and bool_or(pd.category = (select public.norm_ar(data->>'category') from request_row))
         then 1 else 0 end as category_match,
    bool_or(
      exists (select 1 from unnest((select cities from request_row)) c where public.region_matches(u.region, c))
      or exists (
        select 1 from unnest(pd.places) pp, unnest((select places from request_row)) rp
        where public.region_matches(pp, rp))
    ) as location_match
  from provider_docs pd
  join public.provider_profiles pp on pp.user_id = pd.provider_id
  join public.users u on u.id = pd.provider_id
  left join request_terms rt on pd.doc like '%' || rt.term || '%'
  where pp.is_available = true
    and pd.provider_id <> (select requester_id from request_row)
  group by pd.provider_id, u.region
),

eligible as (
  select
    s.provider_id,
    s.word_matches,
    (s.category_match * 60 + s.word_matches * 10 + case when s.location_match then 20 else 0 end) as preliminary_score
  from provider_scored s
  where
    (s.category_match = 1 or s.word_matches > 0)
    and not (
      s.profile_region <> ''
      and cardinality((select cities from request_row)) > 0
      and not s.location_match
    )
),

final_chosen as (
  select * from eligible
  order by preliminary_score desc, word_matches desc, provider_id
  limit greatest(1, least(coalesce(p_limit, 50), 100))
)

select
  c.provider_id,
  pp.rating_avg,
  pp.completed_services_count,
  u.full_name,
  u.avatar_url,
  u.region,
  u.verification_status::text,
  coalesce((
    select jsonb_agg(
      coalesce(ps2.structured_data,
        jsonb_build_object('service', ps2.description, 'skills', '[]'::jsonb, 'synonyms', '[]'::jsonb,
                           'region', null, 'location', null))
      order by ps2.created_at desc)
    from public.provider_services ps2
    where ps2.provider_id = c.provider_id and ps2.is_active = true
  ), '[]'::jsonb) as services,
  c.preliminary_score
from final_chosen c
join public.provider_profiles pp on pp.user_id = c.provider_id
join public.users u on u.id = c.provider_id
order by c.preliminary_score desc, c.word_matches desc, c.provider_id;
$$;

REVOKE ALL ON FUNCTION public.get_provider_candidates(uuid, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_provider_candidates(uuid, integer) TO authenticated;;
