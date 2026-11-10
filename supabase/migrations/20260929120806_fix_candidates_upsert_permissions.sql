grant update on table public.candidates to authenticated;

create policy "candidates_requester_update"
on public.candidates
for update
to authenticated
using (
  exists (
    select 1
    from public.service_requests r
    where r.id = candidates.request_id
      and r.requester_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.service_requests r
    where r.id = candidates.request_id
      and r.requester_id = auth.uid()
  )
);;
