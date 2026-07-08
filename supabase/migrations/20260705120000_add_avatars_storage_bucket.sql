-- Public Storage bucket for profile pictures (pages/profile.html).
-- Public because avatars are meant to be freely viewable (shown in the
-- profile page and, later, anywhere else in the UI) without needing a
-- signed URL — unlike the private course-materials bucket. Writes are
-- still locked down: a user may only upload/replace/delete the file
-- under their own user id folder (avatars/<user_id>/...).
insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;

create policy "Avatar images are publicly readable"
on storage.objects for select
using (bucket_id = 'avatars');

create policy "Users can upload their own avatar"
on storage.objects for insert
with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "Users can replace their own avatar"
on storage.objects for update
using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "Users can delete their own avatar"
on storage.objects for delete
using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);