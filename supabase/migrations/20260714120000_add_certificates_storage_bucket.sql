-- Public Storage bucket for generated course-completion certificates
-- (pages/dashboard.html). Public because a certificate is only useful
-- to share if the link actually opens it without a signed URL — same
-- reasoning as the avatars bucket. Writes are locked down: a user may
-- only upload/replace/delete files under their own user id folder
-- (certificates/<user_id>/...).
insert into storage.buckets (id, name, public)
values ('certificates', 'certificates', true)
on conflict (id) do nothing;

create policy "Certificates are publicly readable"
on storage.objects for select
using (bucket_id = 'certificates');

create policy "Users can upload their own certificates"
on storage.objects for insert
with check (bucket_id = 'certificates' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "Users can replace their own certificates"
on storage.objects for update
using (bucket_id = 'certificates' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "Users can delete their own certificates"
on storage.objects for delete
using (bucket_id = 'certificates' and (storage.foldername(name))[1] = auth.uid()::text);
