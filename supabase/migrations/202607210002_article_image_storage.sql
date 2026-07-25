insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'article-images',
  'article-images',
  true,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "article images are publicly readable" on storage.objects;
create policy "article images are publicly readable"
  on storage.objects for select
  using (bucket_id = 'article-images');

drop policy if exists "journalists upload own article images" on storage.objects;
create policy "journalists upload own article images"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'article-images'
    and (storage.foldername(name))[1] = (select auth.jwt() ->> 'sub')
  );

drop policy if exists "journalists update own article images" on storage.objects;
create policy "journalists update own article images"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'article-images'
    and (storage.foldername(name))[1] = (select auth.jwt() ->> 'sub')
  )
  with check (
    bucket_id = 'article-images'
    and (storage.foldername(name))[1] = (select auth.jwt() ->> 'sub')
  );

drop policy if exists "journalists delete own article images" on storage.objects;
create policy "journalists delete own article images"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'article-images'
    and (storage.foldername(name))[1] = (select auth.jwt() ->> 'sub')
  );
