-- LOCAL SCRATCH POSTGRES ONLY. Never run this against the Supabase project.
-- Minimal re-creation of the pieces of the production schema that the migrations touch:
-- Supabase roles, auth.uid(), the relevant tables/policies/grants/triggers, and the *verbatim*
-- production bodies of get_provider_candidates, contains_phone_number and
-- reject_phone_numbers_in_text_columns. Scoring helpers (norm_ar, ...) are simplified stubs
-- because the tests only look at the shape/size of the `services` payload.

do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then create role service_role nologin bypassrls; end if;
end
$$;
grant usage on schema public to anon, authenticated, service_role;

create schema auth;
grant usage on schema auth to anon, authenticated, service_role;
create function auth.uid() returns uuid language sql stable as $$
  select coalesce(
    nullif(current_setting('request.jwt.claim.sub', true), ''),
    (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub')
  )::uuid
$$;
grant execute on function auth.uid() to anon, authenticated, service_role;

create function public.current_user_is_active() returns boolean language sql stable as $$ select true $$;

create table public.users (
  id uuid primary key, full_name text, avatar_url text, region text,
  verification_status text default 'unverified', rating_count integer default 0, rating_avg numeric default 0
);
create table public.provider_profiles (
  user_id uuid primary key references public.users(id), is_available boolean default true,
  rating_avg numeric default 0, rating_count integer default 0, completed_services_count integer default 0
);
create table public.provider_services (
  id uuid primary key default gen_random_uuid(),
  provider_id uuid not null references public.users(id),
  description text not null, structured_data jsonb, is_active boolean not null default true,
  experience_years integer not null default 0, price_min numeric not null default 0, price_max numeric not null default 0,
  skill_id uuid, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.service_requests (
  id uuid primary key default gen_random_uuid(),
  requester_id uuid not null references public.users(id),
  raw_text text, structured_data jsonb, region text, service_area text, additional_info text
);
create table public.wallets (user_id uuid primary key, available_balance numeric not null default 0);
create table public.app_settings (key text primary key, value jsonb);
create table public.candidates (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.service_requests(id) on delete cascade,
  provider_id uuid not null references public.users(id),
  rank integer, match_score numeric, match_metadata jsonb, excluded_reason text,
  created_at timestamptz not null default now(),
  unique (request_id, provider_id)
);

-- Grants/policies as in production (before the migrations).
alter table public.candidates enable row level security;
grant select, insert, update on public.candidates to authenticated;
grant select, insert, update, truncate, references, trigger on public.candidates to service_role;
create policy active_account_required on public.candidates as restrictive for all to authenticated
  using (current_user_is_active()) with check (current_user_is_active());
create policy candidates_read on public.candidates for select to public
  using (auth.uid() = provider_id or exists (select 1 from public.service_requests r where r.id = candidates.request_id and r.requester_id = auth.uid()));
create policy candidates_requester_insert on public.candidates for insert to public
  with check (exists (select 1 from public.service_requests r where r.id = candidates.request_id and r.requester_id = auth.uid()));
create policy candidates_requester_update on public.candidates for update to authenticated
  using (exists (select 1 from public.service_requests r where r.id = candidates.request_id and r.requester_id = auth.uid()))
  with check (exists (select 1 from public.service_requests r where r.id = candidates.request_id and r.requester_id = auth.uid()));

grant select on public.users, public.provider_profiles, public.provider_services, public.service_requests, public.wallets, public.app_settings to authenticated;
grant select, insert, update on public.provider_services, public.service_requests to authenticated;
grant all on all tables in schema public to service_role;

-- Simplified stubs (production versions only affect ranking, not the services payload).
create function public.norm_ar(t text) returns text language sql immutable as $$ select lower(coalesce(t,'')) $$;
create function public.norm_region(t text) returns text language sql immutable as $$ select lower(coalesce(t,'')) $$;
create function public.region_matches(a text, b text) returns boolean language sql immutable as $$ select a = b $$;
create function public.jsonb_text_list(j jsonb) returns text language sql immutable as $$
  select coalesce(string_agg(x, ' '), '') from jsonb_array_elements_text(case when jsonb_typeof(j)='array' then j else '[]'::jsonb end) x $$;
create function public.jsonb_place_texts(j jsonb) returns text[] language sql immutable as $$ select '{}'::text[] $$;

-- VERBATIM production functions -------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.contains_phone_number(p_text text)
 RETURNS boolean
 LANGUAGE plpgsql
 IMMUTABLE
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v text;
begin
  if p_text is null then
    return false;
  end if;

  -- Normalize Arabic and Persian digits to ASCII digits.
  v := translate(p_text, '٠١٢٣٤٥٦٧٨٩۰۱۲۳۴۵۶۷۸۹', '01234567890123456789');
  v := lower(v);

  -- Convert common Arabic number words into digits.
  v := regexp_replace(v, '\m(صفر|زيرو|زيرو|zero|sifr)\M', '0', 'g');
  v := regexp_replace(v, '\m(واحد|واحده|واحدة|one)\M', '1', 'g');
  v := regexp_replace(v, '\m(اثنان|اثنين|اتنين|إثنان|إثنين|ثنين|two)\M', '2', 'g');
  v := regexp_replace(v, '\m(ثلاثة|ثلاث|تلاتة|تلات|three)\M', '3', 'g');
  v := regexp_replace(v, '\m(اربعة|أربعة|أربع|اربَع|four)\M', '4', 'g');
  v := regexp_replace(v, '\m(خمسة|خمس|five)\M', '5', 'g');
  v := regexp_replace(v, '\m(ستة|ست|سته|six)\M', '6', 'g');
  v := regexp_replace(v, '\m(سبعة|سبع|seven)\M', '7', 'g');
  v := regexp_replace(v, '\m(ثمانية|ثماني|تمنية|تمانية|eight)\M', '8', 'g');
  v := regexp_replace(v, '\m(تسعة|تسع|تسعه|nine)\M', '9', 'g');

  -- Handle the digit zero spelled as separated Arabic letters or letter names.
  v := regexp_replace(v, 'ص[[:space:]]*ف[[:space:]]*ر', '0', 'g');
  v := regexp_replace(v, '\mصاد[[:space:]]+فاء[[:space:]]+راء\M', '0', 'g');

  -- Existing Syrian and international phone patterns, plus long digit sequences
  -- assembled with spaces or punctuation between digits.
  return v ~ '(^|[^0-9])09[[:space:]().-]*[0-9][0-9[:space:]().-]{6,}[0-9]([^0-9]|$)'
      or v ~ '(^|[^0-9])(([+]|00)?963)[[:space:]().-]*9[[:space:]().-]*[0-9][0-9[:space:]().-]{6,}[0-9]([^0-9]|$)'
      or v ~ '(^|[^0-9])([+]|00)[[:space:]]*[0-9][0-9[:space:]().-]{7,}[0-9]([^0-9]|$)'
      or v ~ '(^|[^0-9])[0-9]{9,15}([^0-9]|$)'
      or v ~ '(^|[^0-9])[0-9]([[:space:]().-]+[0-9]){8,14}([^0-9]|$)';
end;
$function$;

CREATE OR REPLACE FUNCTION public.reject_phone_numbers_in_text_columns()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
declare
  col text;
  v_new text;
  v_old text;
begin
  foreach col in array tg_argv loop
    v_new := to_jsonb(new) #>> string_to_array(col, '.');
    v_old := case when tg_op = 'UPDATE' then to_jsonb(old) #>> string_to_array(col, '.') else null end;
    if v_new is not null and v_new is distinct from v_old and public.contains_phone_number(v_new) then
      raise exception 'PHONE_NUMBER_NOT_ALLOWED' using errcode = '23514', detail = 'Phone numbers are not allowed in ' || col;
    end if;
  end loop;
  return new;
end;
$function$;

CREATE TRIGGER reject_phone_numbers_provider_services BEFORE INSERT OR UPDATE ON public.provider_services FOR EACH ROW EXECUTE FUNCTION reject_phone_numbers_in_text_columns('description', 'structured_data.additional_info');
CREATE TRIGGER reject_phone_numbers_service_requests BEFORE INSERT OR UPDATE ON public.service_requests FOR EACH ROW EXECUTE FUNCTION reject_phone_numbers_in_text_columns('raw_text', 'additional_info', 'service_area', 'region');

CREATE OR REPLACE FUNCTION public.get_provider_candidates(p_request_id uuid, p_limit integer DEFAULT 50)
 RETURNS TABLE(provider_id uuid, rating_avg numeric, rating_count integer, completed_services_count integer, full_name text, avatar_url text, region text, verification_status text, services jsonb, preliminary_score integer)
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
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
    and b.base not in ('خدمه','خدمات','عام','عامه','اعمال','مهام','مهارات','مدرس','معلم','معلمه','استاذ','استاذه','مدرسه','تعليم','تدريس','تعلم','لغه','لغات','مطلوب','بدي','اريد','احتاج','خدماتي','خدمتي','دروس','درس','خصوصي','خصوصيه','خاص','خاصه','دورات','دوره','كورس','كورسات','تدريب','تعليمي','تعليميه','تدريسي','فني','عمل','شغل')
    and t.term not in ('خدمه','خدمات','عام','عامه','اعمال','مهام','مهارات','مدرس','معلم','معلمه','استاذ','استاذه','مدرسه','تعليم','تدريس','تعلم','لغه','لغات','مطلوب','بدي','اريد','احتاج','خدماتي','خدمتي','دروس','درس','خصوصي','خصوصيه','خاص','خاصه','دورات','دوره','كورس','كورسات','تدريب','تعليمي','تعليميه','تدريسي','فني','عمل','شغل')
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
    max(case
      when exists(select 1 from unnest(pd.places) pp_place, unnest((select places from request_row)) rp_place where public.region_matches(pp_place,rp_place)) then 2
      when exists(select 1 from unnest(pd.cities) pc, unnest((select cities from request_row)) rc where public.region_matches(pc,rc)) then 1
      else 0
    end)::integer location_tier
  from provider_docs pd
  join public.provider_profiles pp on pp.user_id=pd.provider_id
  left join request_terms rt on pd.doc like '%'||rt.term||'%'
  where pp.is_available=true and pd.provider_id<>(select requester_id from request_row)
    and coalesce((select w.available_balance from public.wallets w where w.user_id=pd.provider_id), 0) >= coalesce((select (value)::text::numeric from public.app_settings where key='commission_max'), 50)
    and not exists (select 1 from public.users ur where ur.id=pd.provider_id
      and ur.rating_count >= coalesce((select (value)::text::integer from public.app_settings where key='hide_provider_min_ratings'),5)
      and ur.rating_avg < coalesce((select (value)::text::numeric from public.app_settings where key='hide_provider_below_rating'),3))
  group by pd.provider_id
),
eligible as (
  select s.provider_id,s.word_matches,
    (s.category_match*60+s.word_matches*10+
      case when s.location_tier=2 then 40 when s.location_tier=1 then 20 else 0 end) preliminary_score
  from provider_scored s
  where s.word_matches > 0
    and (cardinality((select cities from request_row))=0 or s.location_tier>0)
),
final_chosen as (
  select e.provider_id,e.preliminary_score,e.word_matches
  from eligible e
  order by e.preliminary_score desc,e.word_matches desc,e.provider_id
  limit greatest(1,least(coalesce(p_limit,50),100))
),
chosen as (
  select * from final_chosen
)
select c.provider_id,pp.rating_avg,pp.rating_count,pp.completed_services_count,u.full_name,u.avatar_url,u.region,
  u.verification_status::text,
  coalesce((
    select jsonb_agg(
      jsonb_build_object('service',ps2.description,'skills','[]'::jsonb,'synonyms','[]'::jsonb)
        || coalesce(ps2.structured_data,'{}'::jsonb)
        || jsonb_build_object('service',coalesce(nullif(ps2.structured_data->>'service',''),ps2.description))
      order by ps2.created_at desc
    )
    from public.provider_services ps2
    where ps2.provider_id=c.provider_id and ps2.is_active=true
  ),'[]'::jsonb) services,
  c.preliminary_score
from chosen c
join public.provider_profiles pp on pp.user_id=c.provider_id
join public.users u on u.id=c.provider_id
order by c.preliminary_score desc,c.word_matches desc,c.provider_id;
$function$;
revoke all on function public.get_provider_candidates(uuid, integer) from public, anon;
grant execute on function public.get_provider_candidates(uuid, integer) to authenticated;
