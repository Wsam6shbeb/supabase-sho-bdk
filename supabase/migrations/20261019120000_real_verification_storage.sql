-- Private storage for account verification photos.
-- This migration is committed to a feature branch only; it is not applied to the live project.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'verification-documents',
  'verification-documents',
  false,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do nothing;

create policy "verification_documents_owner_insert"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'verification-documents'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

create policy "verification_documents_owner_select"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'verification-documents'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);
