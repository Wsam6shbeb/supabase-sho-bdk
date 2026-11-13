-- Jobs section: additive migration (no existing table is modified)

insert into public.app_settings (key, value) values
  ('jobs_enabled', 'false'::jsonb),
  ('jobs_ad_every_n', '5'::jsonb),
  ('jobs_max_active_per_user', '5'::jsonb),
  ('jobs_expiry_days', '30'::jsonb),
  ('jobs_report_auto_hide_threshold', '3'::jsonb)
on conflict (key) do nothing;

create or replace function public._job_setting_int(p_key text, p_default int)
returns int
language sql stable security definer
set search_path = public, pg_temp
as $f$
  select coalesce((select (value)::text::int from public.app_settings where key = p_key), p_default);
$f$;

create or replace function public.job_normalize_text(p_text text, p_keep_spaces boolean default false)
returns text
language sql immutable
set search_path = public, pg_temp
as $f$
  select btrim(
    regexp_replace(
      regexp_replace(
        regexp_replace(
          translate(
            translate(lower(coalesce(p_text, '')), '٠١٢٣٤٥٦٧٨٩', '0123456789'),
            'أإآٱىةؤئـ', 'اااايهوي'),
          '[\u064B-\u065F\u0670]', '', 'g'),
        case when p_keep_spaces then '[^\u0621-\u064Aa-z0-9]+' else '[^\u0621-\u064Aa-z0-9]' end,
        case when p_keep_spaces then ' ' else '' end,
        'g'),
      '(.)\1+', '\1', 'g'));
$f$;

create table public.job_blocked_words (
  id uuid primary key default gen_random_uuid(),
  word text not null check (char_length(btrim(word)) between 2 and 60),
  whole_word boolean not null default false,
  created_at timestamptz not null default now(),
  constraint job_blocked_words_word_key unique (word)
);
alter table public.job_blocked_words enable row level security;
revoke all on public.job_blocked_words from anon, authenticated;

insert into public.job_blocked_words (word, whole_word) values
  ('سكس', false), ('اباحي', false), ('شرموط', false), ('قحبة', false),
  ('منيوك', false), ('متناك', false),
  ('نيك', true), ('كس', true), ('زب', true),
  ('porn', false), ('sex', true);

create or replace function public.job_text_is_blocked(p_text text)
returns boolean
language sql stable security definer
set search_path = public, pg_temp
as $f$
  select exists (
    select 1
      from public.job_blocked_words w
     where char_length(public.job_normalize_text(w.word)) >= 2
       and (
         (not w.whole_word
            and position(public.job_normalize_text(w.word) in public.job_normalize_text(p_text)) > 0)
         or (w.whole_word
            and (' ' || public.job_normalize_text(p_text, true) || ' ')
                like ('% ' || public.job_normalize_text(w.word, true) || ' %'))
       )
  );
$f$;

create table public.job_posts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  title text not null check (char_length(title) between 3 and 80),
  description text not null check (char_length(description) between 10 and 2000),
  region text not null check (char_length(region) between 2 and 40),
  area text check (area is null or char_length(area) <= 60),
  skills text[] not null default '{}' check (cardinality(skills) <= 10),
  job_type text not null default 'full_time' check (job_type in ('full_time', 'part_time', 'freelance')),
  salary_text text check (salary_text is null or char_length(salary_text) <= 60),
  contact_type text not null check (contact_type in ('phone', 'whatsapp', 'email', 'link')),
  contact_value text not null check (char_length(contact_value) between 5 and 200),
  status text not null default 'active' check (status in ('active', 'closed', 'hidden')),
  hidden_reason text check (hidden_reason is null or char_length(hidden_reason) <= 200),
  expires_at timestamptz not null default (now() + interval '30 days'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint job_posts_contact_format check (
    case contact_type
      when 'phone' then contact_value ~ '^\+?[0-9]{9,15}$'
      when 'whatsapp' then contact_value ~ '^\+?[0-9]{9,15}$'
      when 'email' then contact_value ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'
      when 'link' then contact_value ~* '^https?://[^\s]+$'
      else false
    end)
);

create index job_posts_feed_idx on public.job_posts (region, created_at desc) where status = 'active';
create index job_posts_skills_idx on public.job_posts using gin (skills);
create index job_posts_user_idx on public.job_posts (user_id, status);

create or replace function public.job_posts_before_write()
returns trigger
language plpgsql security definer
set search_path = public, pg_temp
as $f$
declare
  v_is_admin boolean;
  v_check_text boolean := (tg_op = 'INSERT');
  v_active int;
begin
  if pg_trigger_depth() > 1 then
    return new;
  end if;

  v_is_admin := auth.uid() is null
    or exists (select 1 from public.users u
                where u.id = auth.uid() and u.is_admin and u.deleted_at is null);

  new.title := btrim(new.title);
  new.description := btrim(new.description);
  new.region := btrim(new.region);
  new.area := nullif(btrim(coalesce(new.area, '')), '');
  new.salary_text := nullif(btrim(coalesce(new.salary_text, '')), '');
  new.skills := coalesce((
    select array_agg(x order by x)
      from (select distinct left(btrim(regexp_replace(s, '\s+', ' ', 'g')), 30) as x
              from unnest(coalesce(new.skills, '{}'::text[])) as s) q
     where x <> ''), '{}'::text[]);

  if new.contact_type in ('phone', 'whatsapp') then
    new.contact_value := regexp_replace(
      translate(coalesce(new.contact_value, ''), '٠١٢٣٤٥٦٧٨٩', '0123456789'),
      '[\s\-().]', '', 'g');
  else
    new.contact_value := btrim(coalesce(new.contact_value, ''));
  end if;

  if tg_op = 'UPDATE' then
    v_check_text := new.title is distinct from old.title
      or new.description is distinct from old.description
      or new.area is distinct from old.area
      or new.salary_text is distinct from old.salary_text
      or new.skills is distinct from old.skills
      or new.contact_value is distinct from old.contact_value;
  end if;
  if v_check_text and public.job_text_is_blocked(concat_ws(' ', new.title, new.description,
       new.area, new.salary_text, array_to_string(new.skills, ' '), new.contact_value)) then
    raise exception 'JOB_CONTENT_BLOCKED' using errcode = 'P0001';
  end if;

  if tg_op = 'INSERT' then
    if not v_is_admin and not coalesce(
         (select (value)::text::boolean from public.app_settings where key = 'jobs_enabled'), false) then
      raise exception 'JOBS_DISABLED' using errcode = 'P0001';
    end if;
    new.status := 'active';
    new.hidden_reason := null;
    new.created_at := now();
    new.expires_at := now() + make_interval(days => public._job_setting_int('jobs_expiry_days', 30));
    if not v_is_admin then
      perform pg_advisory_xact_lock(hashtext('job_posts:' || new.user_id::text));
      select count(*) into v_active from public.job_posts
       where user_id = new.user_id and status = 'active' and expires_at > now();
      if v_active >= public._job_setting_int('jobs_max_active_per_user', 5) then
        raise exception 'JOB_LIMIT_REACHED' using errcode = 'P0001';
      end if;
    end if;
  else
    if not v_is_admin then
      new.user_id := old.user_id;
      new.created_at := old.created_at;
      new.hidden_reason := old.hidden_reason;
      new.expires_at := old.expires_at;
      if old.status = 'hidden' then
        new.status := 'hidden';
      elsif new.status = 'hidden' then
        raise exception 'FORBIDDEN' using errcode = '42501';
      end if;
    end if;
    if new.status = 'active' and (old.status <> 'active' or old.expires_at <= now()) then
      if not v_is_admin then
        perform pg_advisory_xact_lock(hashtext('job_posts:' || new.user_id::text));
        select count(*) into v_active from public.job_posts
         where user_id = new.user_id and status = 'active' and expires_at > now() and id <> new.id;
        if v_active >= public._job_setting_int('jobs_max_active_per_user', 5) then
          raise exception 'JOB_LIMIT_REACHED' using errcode = 'P0001';
        end if;
      end if;
      new.expires_at := now() + make_interval(days => public._job_setting_int('jobs_expiry_days', 30));
      new.hidden_reason := null;
    end if;
  end if;

  return new;
end;
$f$;

create trigger job_posts_before_write
  before insert or update on public.job_posts
  for each row execute function public.job_posts_before_write();
create trigger job_posts_set_updated_at
  before update on public.job_posts
  for each row execute function public.set_updated_at();

alter table public.job_posts enable row level security;
create policy active_account_required on public.job_posts as restrictive for all to authenticated
  using (public.current_user_is_active()) with check (public.current_user_is_active());
create policy job_posts_read_active on public.job_posts for select to authenticated
  using (status = 'active' and expires_at > now());
create policy job_posts_read_own on public.job_posts for select to authenticated
  using (user_id = auth.uid());
create policy job_posts_insert_own on public.job_posts for insert to authenticated
  with check (user_id = auth.uid());
create policy job_posts_update_own on public.job_posts for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy job_posts_delete_own on public.job_posts for delete to authenticated
  using (user_id = auth.uid());

revoke all on public.job_posts from anon, authenticated;
grant select (id, user_id, title, description, region, area, skills, job_type, salary_text,
              contact_type, status, expires_at, created_at, updated_at)
  on public.job_posts to authenticated;
grant insert (user_id, title, description, region, area, skills, job_type, salary_text,
              contact_type, contact_value)
  on public.job_posts to authenticated;
grant update (title, description, region, area, skills, job_type, salary_text,
              contact_type, contact_value, status)
  on public.job_posts to authenticated;
grant delete on public.job_posts to authenticated;

create or replace function public.get_job_contact(p_job_id uuid)
returns table (contact_type text, contact_value text)
language plpgsql stable security definer
set search_path = public, pg_temp
as $f$
begin
  if auth.uid() is null or not public.current_user_is_active() then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;
  return query
    select j.contact_type, j.contact_value
      from public.job_posts j
     where j.id = p_job_id
       and ((j.status = 'active' and j.expires_at > now()) or j.user_id = auth.uid());
end;
$f$;

create table public.job_reports (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.job_posts(id) on delete cascade,
  reporter_id uuid not null references public.users(id) on delete cascade,
  reason text not null check (reason in ('scam', 'inappropriate', 'spam', 'other')),
  details text check (details is null or char_length(details) <= 500),
  status text not null default 'open' check (status in ('open', 'resolved', 'dismissed')),
  created_at timestamptz not null default now(),
  constraint job_reports_one_per_user unique (job_id, reporter_id)
);
create index job_reports_job_idx on public.job_reports (job_id, status);

create or replace function public.job_reports_after_insert()
returns trigger
language plpgsql security definer
set search_path = public, pg_temp
as $f$
declare
  v_threshold int := public._job_setting_int('jobs_report_auto_hide_threshold', 3);
begin
  if v_threshold > 0
     and (select count(*) from public.job_reports where job_id = new.job_id and status = 'open') >= v_threshold then
    update public.job_posts
       set status = 'hidden', hidden_reason = 'auto_reports'
     where id = new.job_id and status = 'active';
  end if;
  return new;
end;
$f$;

create trigger job_reports_after_insert
  after insert on public.job_reports
  for each row execute function public.job_reports_after_insert();

alter table public.job_reports enable row level security;
create policy active_account_required on public.job_reports as restrictive for all to authenticated
  using (public.current_user_is_active()) with check (public.current_user_is_active());
create policy job_reports_read_own on public.job_reports for select to authenticated
  using (reporter_id = auth.uid());
create policy job_reports_insert_own on public.job_reports for insert to authenticated
  with check (
    reporter_id = auth.uid()
    and not exists (select 1 from public.job_posts j where j.id = job_id and j.user_id = auth.uid()));

revoke all on public.job_reports from anon, authenticated;
grant select (id, job_id, reason, status, created_at) on public.job_reports to authenticated;
grant insert (job_id, reporter_id, reason, details) on public.job_reports to authenticated;

create table public.job_ads (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(title) between 1 and 80),
  image_url text not null,
  link_url text check (link_url is null or link_url ~* '^https?://[^\s]+$'),
  is_active boolean not null default true,
  starts_at timestamptz,
  ends_at timestamptz,
  priority int not null default 0,
  impressions bigint not null default 0,
  clicks bigint not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger job_ads_set_updated_at
  before update on public.job_ads
  for each row execute function public.set_updated_at();

alter table public.job_ads enable row level security;
create policy active_account_required on public.job_ads as restrictive for all to authenticated
  using (public.current_user_is_active()) with check (public.current_user_is_active());
create policy job_ads_read_live on public.job_ads for select to authenticated
  using (is_active
         and (starts_at is null or starts_at <= now())
         and (ends_at is null or ends_at > now()));

revoke all on public.job_ads from anon, authenticated;
grant select (id, title, image_url, link_url, priority) on public.job_ads to authenticated;

create or replace function public.job_ad_event(p_ad_id uuid, p_event text)
returns void
language plpgsql security definer
set search_path = public, pg_temp
as $f$
begin
  if auth.uid() is null or not public.current_user_is_active() then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;
  if p_event = 'impression' then
    update public.job_ads set impressions = impressions + 1 where id = p_ad_id;
  elsif p_event = 'click' then
    update public.job_ads set clicks = clicks + 1 where id = p_ad_id;
  else
    raise exception 'INVALID_EVENT' using errcode = 'P0001';
  end if;
end;
$f$;

revoke all on function public._job_setting_int(text, int) from public, anon, authenticated;
revoke all on function public.job_normalize_text(text, boolean) from public, anon, authenticated;
revoke all on function public.job_text_is_blocked(text) from public, anon, authenticated;
revoke all on function public.job_posts_before_write() from public, anon, authenticated;
revoke all on function public.job_reports_after_insert() from public, anon, authenticated;
revoke all on function public.get_job_contact(uuid) from public, anon;
grant execute on function public.get_job_contact(uuid) to authenticated;
revoke all on function public.job_ad_event(uuid, text) from public, anon;
grant execute on function public.job_ad_event(uuid, text) to authenticated;

notify pgrst, 'reload schema';
