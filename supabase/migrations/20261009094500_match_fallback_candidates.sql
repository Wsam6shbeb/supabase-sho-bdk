-- If no strong candidates exist, return up to three available providers in the requester's city
-- as clearly-labelled alternatives. Strong matches always take precedence.
create or replace function public.get_provider_candidates(p_request_id uuid, p_limit integer default 50)
returns table(
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
language sql
security definer
set search_path = public
as $$
with request_row as (
  select sr.id, sr.requester_id, coalesce(sr.structured_data,'{}'::jsonb) data,
    array_remove(array[
      public.norm_region(u.region), public.norm_region(sr.region),
      public.norm_region(sr.structured_data->>'region'),
      public.norm_region(sr.structured_data->>'city'),
      public.norm_region(sr.structured_data->'service_area'->>'city')
    ],'') cities,
    array_remove(array[
      public.norm_region(sr.structured_data->>'area'),
      public.norm_region(sr.structured_data->>'location'),
      public.norm_region(sr.service_area),
      public.norm_region(sr.structured_data->>'service_area')
    ] || coalesce((select array_agg(public.norm_region(x)) from unnest(public.jsonb_place_texts(sr.structured_data->'service_area')) x),'{}'::text[]),'') places
  from public.service_requests sr
  join public.users u on u.id=sr.requester_id
  where sr.id=p_request_id and sr.requester_id=auth.uid()
  limit 1
),
request_terms as (
  select distinct t.term from request_row r
  cross join lateral (
    select regexp_split_to_table(
      public.norm_ar(concat_ws(' ',r.data->>'service',r.data->>'category',
        public.jsonb_text_list(r.data->'skills'),public.jsonb_text_list(r.data->'synonyms'))),
      ' +'
    ) raw
  ) w
  cross join lateral (select regexp_replace(w.raw,'^ال','') base) b
  cross join lateral (values (b.base),(case when length(b.base)>=5 then left(b.base,greatest(4,length(b.base)-1)) end)) t(term)
  where t.term is not null and length(t.term)>=3
    and t.term not in ('خدمه','خدمات','عام','عامه','اعمال','مهام','مهارات')
),
provider_docs as (
  select ps.provider_id,
    public.norm_ar(concat_ws(' ',ps.description,ps.structured_data->>'service',
      ps.structured_data->>'category',public.jsonb_text_list(ps.structured_data->'skills'),
      public.jsonb_text_list(ps.structured_data->'synonyms'))) doc,
    public.norm_ar(ps.structured_data->>'category') category,
    array_remove(array[
      public.norm_region(u.region), public.norm_region(ps.structured_data->>'city'),
      public.norm_region(ps.structured_data->>'region'),
      public.norm_region(ps.structured_data->'service_area'->>'city')
    ],'') cities,
    array_remove(array[
      public.norm_region(ps.structured_data->>'area'),
      public.norm_region(ps.structured_data->>'location'),
      public.norm_region(ps.structured_data->>'service_area')
    ] || coalesce((select array_agg(public.norm_region(x)) from unnest(public.jsonb_place_texts(ps.structured_data->'service_area')) x),'{}'::text[]),'') places
  from public.provider_services ps
  join public.users u on u.id=ps.provider_id
  where ps.is_active=true
),
provider_scored as (
  select pd.provider_id,
    count(distinct rt.term)::integer word_matches,
    case when (select public.norm_ar(data->>'category') from request_row)<>'' 
      and bool_or(pd.category=(select public.norm_ar(data->>'category') from request_row))
      then 1 else 0 end category_match,
    case
      when exists(select 1 from unnest(pd.places) pp_place, unnest((select places from request_row)) rp_place where public.region_matches(pp_place,rp_place)) then 2
      when exists(select 1 from unnest(pd.cities) pc, unnest((select cities from request_row)) rc where public.region_matches(pc,rc)) then 1
      else 0
    end location_tier
  from provider_docs pd
  join public.provider_profiles pp on pp.user_id=pd.provider_id
  left join request_terms rt on pd.doc like '%'||rt.term||'%'
  where pp.is_available=true and pd.provider_id<>(select requester_id from request_row)
  group by pd.provider_id,pd.places,pd.cities
),
eligible as (
  select s.provider_id,s.word_matches,
    (s.category_match*60+s.word_matches*10+
      case when s.location_tier=2 then 40 when s.location_tier=1 then 20 else 0 end) preliminary_score
  from provider_scored s
  where ((select public.norm_ar(data->>'category') from request_row)='' or s.category_match=1)
    and (cardinality((select cities from request_row))=0 or s.location_tier>0)
),
final_chosen as (
  select e.provider_id,e.preliminary_score,e.word_matches
  from eligible e
  order by e.preliminary_score desc,e.word_matches desc,e.provider_id
  limit greatest(1,least(coalesce(p_limit,50),100))
),
fallback_chosen as (
  select s.provider_id,
    (s.category_match*20+s.word_matches*10+
      case when s.location_tier=2 then 40 when s.location_tier=1 then 20 else 0 end)::integer preliminary_score,
    s.word_matches
  from provider_scored s
  join public.provider_profiles pp on pp.user_id=s.provider_id
  where not exists(select 1 from eligible)
    and (cardinality((select cities from request_row))=0 or s.location_tier>0)
  order by s.category_match desc,s.word_matches desc,s.location_tier desc,
    pp.rating_avg desc,pp.completed_services_count desc,s.provider_id
  limit greatest(1,least(coalesce(p_limit,3),3))
),
chosen as (
  select * from final_chosen
  union all
  select * from fallback_chosen
)
select c.provider_id,pp.rating_avg,pp.completed_services_count,u.full_name,u.avatar_url,u.region,
  u.verification_status::text,
  coalesce((
    select jsonb_agg(
      coalesce(ps2.structured_data,jsonb_build_object(
        'service',ps2.description,'skills','[]'::jsonb,'synonyms','[]'::jsonb,'region',null,'location',null
      )) order by ps2.created_at desc
    )
    from public.provider_services ps2
    where ps2.provider_id=c.provider_id and ps2.is_active=true
  ),'[]'::jsonb) services,
  c.preliminary_score
from chosen c
join public.provider_profiles pp on pp.user_id=c.provider_id
join public.users u on u.id=c.provider_id
order by c.preliminary_score desc,c.word_matches desc,c.provider_id;
$$;
