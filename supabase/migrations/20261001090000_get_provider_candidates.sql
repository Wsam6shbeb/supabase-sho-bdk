CREATE OR REPLACE FUNCTION public.get_provider_candidates(p_request_id uuid, p_limit integer DEFAULT 50)
 RETURNS TABLE(provider_id uuid, rating_avg numeric, completed_services_count integer, full_name text, avatar_url text, region text, verification_status text, services jsonb, preliminary_score integer)
 LANGUAGE sql
 STABLE
AS $function$with request_row as (
  select
    sr.id,
    sr.requester_id,
    u.region as requester_region,
    coalesce(sr.structured_data, '{}'::jsonb) as data
  from public.service_requests sr
  join public.users u on u.id = sr.requester_id
  where sr.id = p_request_id
    and sr.requester_id = auth.uid()
  limit 1
),

request_terms as (
  select distinct lower(trim(term)) as term
  from request_row r
  cross join lateral regexp_split_to_table(
    concat_ws(
      ' ',
      coalesce(r.data->>'service', ''),
      coalesce(r.data->>'category', ''),
      coalesce(r.data->>'skills', ''),
      coalesce(r.data->>'synonyms', '')
    ),
    '[[:space:][:punct:]]+'
  ) as term
  where length(trim(term)) >= 3
),

-- نجهز نص البحث لكل مقدم مرة واحدة
provider_docs as (
  select
    ps.provider_id,
    lower(
      concat_ws(
        ' ',
        coalesce(ps.description, ''),
        coalesce(ps.structured_data->>'service', ''),
        coalesce(ps.structured_data->>'category', ''),
        coalesce(ps.structured_data->>'skills', ''),
        coalesce(ps.structured_data->>'synonyms', '')
      )
    ) as doc,
    lower(coalesce(ps.structured_data->>'category', '')) as category,
    ps.created_at
  from public.provider_services ps
  where ps.is_active = true
),

provider_scored as (
  select
    pd.provider_id,
    u.region,
    count(distinct rt.term)::integer as word_matches,
    case
      when coalesce((select data->>'category' from request_row), '') <> ''
       and bool_or(
         pd.category = lower((select data->>'category' from request_row))
       )
      then 1 else 0
    end as category_match,
    case
      when coalesce((select requester_region from request_row), '') <> ''
       and lower(coalesce(u.region, '')) =
           lower((select requester_region from request_row))
      then 1 else 0
    end as city_match
  from provider_docs pd
  join public.provider_profiles pp on pp.user_id = pd.provider_id
  join public.users u on u.id = pd.provider_id
  left join request_terms rt
    on pd.doc like '%' || rt.term || '%'
  where pp.is_available = true
    and lower(coalesce(u.region, '')) =
        lower((select requester_region from request_row))
    and pd.provider_id <> (select requester_id from request_row)
  group by pd.provider_id, u.region
),

eligible as (
  select
    ps.provider_id,
    ps.word_matches,
    ps.category_match,
    ps.city_match,
    (ps.category_match * 100 + ps.word_matches * 10 + ps.city_match * 20) as preliminary_score
  from provider_scored ps
  where ps.category_match = 1
     or ps.word_matches > 0
),

fallback as (
  select
    pp.user_id as provider_id,
    0::integer as word_matches,
    0::integer as category_match,
    1::integer as city_match,
    20::integer as preliminary_score
  from public.provider_profiles pp
  join public.users u on u.id = pp.user_id
  where pp.is_available = true
    and lower(coalesce(u.region, '')) =
        lower((select requester_region from request_row))
    and pp.user_id <> (select requester_id from request_row)
    and not exists (select 1 from eligible)
),

chosen as (
  select * from eligible
  union all
  select * from fallback
),

final_chosen as (
  select *
  from chosen
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
  coalesce(
    (
      select jsonb_agg(
        coalesce(
          ps2.structured_data,
          jsonb_build_object(
            'service', ps2.description,
            'skills', '[]'::jsonb,
            'synonyms', '[]'::jsonb,
            'region', null,
            'location', null
          )
        )
        order by ps2.created_at desc
      )
      from public.provider_services ps2
      where ps2.provider_id = c.provider_id
        and ps2.is_active = true
    ),
    '[]'::jsonb
  ) as services,
  c.preliminary_score
from final_chosen c
join public.provider_profiles pp on pp.user_id = c.provider_id
join public.users u on u.id = c.provider_id
order by c.preliminary_score desc, c.word_matches desc, c.provider_id;$function$