-- MechSweep cloud library: index rows + blob storage per user.
-- Run in Supabase SQL Editor (safe to re-run).

create table if not exists public.library_documents (
  user_id uuid not null references auth.users (id) on delete cascade,
  document_id text not null,
  title text not null,
  status text not null,
  content_hash text,
  updated_at timestamptz not null default now(),
  primary key (user_id, document_id)
);

create index if not exists library_documents_user_updated_idx
  on public.library_documents (user_id, updated_at desc);

alter table public.library_documents enable row level security;

drop policy if exists "Users read own library index" on public.library_documents;
drop policy if exists "Users insert own library index" on public.library_documents;
drop policy if exists "Users update own library index" on public.library_documents;
drop policy if exists "Users delete own library index" on public.library_documents;

create policy "Users read own library index"
  on public.library_documents
  for select
  using (auth.uid() = user_id);

create policy "Users insert own library index"
  on public.library_documents
  for insert
  with check (auth.uid() = user_id);

create policy "Users update own library index"
  on public.library_documents
  for update
  using (auth.uid() = user_id);

create policy "Users delete own library index"
  on public.library_documents
  for delete
  using (auth.uid() = user_id);

insert into storage.buckets (id, name, public, file_size_limit)
values ('library-blobs', 'library-blobs', false, 52428800)
on conflict (id) do nothing;

drop policy if exists "Users read own library blobs" on storage.objects;
drop policy if exists "Users upload own library blobs" on storage.objects;
drop policy if exists "Users update own library blobs" on storage.objects;
drop policy if exists "Users delete own library blobs" on storage.objects;

create policy "Users read own library blobs"
  on storage.objects
  for select
  using (
    bucket_id = 'library-blobs'
    and (storage.foldername (name))[1] = auth.uid()::text
  );

create policy "Users upload own library blobs"
  on storage.objects
  for insert
  with check (
    bucket_id = 'library-blobs'
    and (storage.foldername (name))[1] = auth.uid()::text
  );

create policy "Users update own library blobs"
  on storage.objects
  for update
  using (
    bucket_id = 'library-blobs'
    and (storage.foldername (name))[1] = auth.uid()::text
  );

create policy "Users delete own library blobs"
  on storage.objects
  for delete
  using (
    bucket_id = 'library-blobs'
    and (storage.foldername (name))[1] = auth.uid()::text
  );
