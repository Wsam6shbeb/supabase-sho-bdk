-- Per-user conversation archive. Archiving never changes the shared conversation state.
create table if not exists public.conversation_user_archives (
  user_id uuid not null default auth.uid()
    references public.users(id) on delete cascade,
  conversation_id uuid not null
    references public.conversations(id) on delete cascade,
  archived_at timestamptz not null default now(),
  primary key (user_id, conversation_id)
);

alter table public.conversation_user_archives enable row level security;

grant select, insert, delete on public.conversation_user_archives to authenticated;

drop policy if exists conversation_user_archives_select_own
  on public.conversation_user_archives;
create policy conversation_user_archives_select_own
  on public.conversation_user_archives
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists conversation_user_archives_insert_own
  on public.conversation_user_archives;
create policy conversation_user_archives_insert_own
  on public.conversation_user_archives
  for insert
  to authenticated
  with check (
    (select auth.uid()) = user_id
    and exists (
      select 1
      from public.conversations c
      where c.id = conversation_id
        and (c.requester_id = (select auth.uid()) or c.provider_id = (select auth.uid()))
    )
  );

drop policy if exists conversation_user_archives_delete_own
  on public.conversation_user_archives;
create policy conversation_user_archives_delete_own
  on public.conversation_user_archives
  for delete
  to authenticated
  using ((select auth.uid()) = user_id);

-- When a new message arrives, remove the archive entry for its recipient only.
-- The sender's own archive state is left untouched.
create or replace function public.unarchive_conversation_recipient_after_message()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $function$
declare
  v_recipient_id uuid;
begin
  select case
    when new.sender_id = c.requester_id then c.provider_id
    when new.sender_id = c.provider_id then c.requester_id
    else null
  end
  into v_recipient_id
  from public.conversations c
  where c.id = new.conversation_id;

  if v_recipient_id is not null then
    delete from public.conversation_user_archives a
    where a.conversation_id = new.conversation_id
      and a.user_id = v_recipient_id;
  end if;

  return new;
end;
$function$;

revoke all on function public.unarchive_conversation_recipient_after_message()
  from public, anon, authenticated;

drop trigger if exists unarchive_conversation_recipient_after_message
  on public.messages;
create trigger unarchive_conversation_recipient_after_message
  after insert on public.messages
  for each row
  execute function public.unarchive_conversation_recipient_after_message();
