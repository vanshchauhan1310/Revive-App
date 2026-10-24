-- Listing photos and avatars. Anyone can view; a signed-in user may only write inside
-- their own top-level folder: "<auth.uid()>/<file>".

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('listing-images', 'listing-images', true, 5242880, array['image/jpeg', 'image/png', 'image/webp']),
  ('avatars',        'avatars',        true, 2097152, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

create policy "images are publicly readable" on storage.objects for select
  using (bucket_id in ('listing-images', 'avatars'));

create policy "users upload to own folder" on storage.objects for insert to authenticated
  with check (bucket_id in ('listing-images', 'avatars')
              and (storage.foldername(name))[1] = auth.uid()::text);

create policy "users update own files" on storage.objects for update to authenticated
  using (bucket_id in ('listing-images', 'avatars') and owner_id = auth.uid()::text);

create policy "users delete own files" on storage.objects for delete to authenticated
  using (bucket_id in ('listing-images', 'avatars') and owner_id = auth.uid()::text);
