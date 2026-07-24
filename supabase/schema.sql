-- ═══════════════════════════════════════════════
-- AetherMind — Supabase Schema
-- Run this in your Supabase SQL Editor
-- ═══════════════════════════════════════════════

-- ─── Profiles ────────────────────────────────
create table if not exists profiles (
  id uuid references auth.users on delete cascade primary key,
  full_name text,
  email text,
  avatar_url text,
  member_id text unique default 'am-usr-' || substr(gen_random_uuid()::text, 1, 6),
  joined_at timestamptz default now()
);

-- Auto-create profile row on signup
create or replace function handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into public.profiles (id, full_name, email)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    new.email
  );
  insert into public.user_settings (user_id) values (new.id);
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- ─── User Settings ────────────────────────────
create table if not exists user_settings (
  user_id uuid references auth.users on delete cascade primary key,
  max_tokens int default 2048,
  temperature float default 0.7,
  context_limit int default 16000,
  dark_mode boolean default false,
  font_size text default 'medium',
  compact_mode boolean default false,
  accent_color text default '#2b1c86',
  ollama_url text default 'http://localhost:8000'
);

-- ─── Chat Sessions ────────────────────────────
create table if not exists chat_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users on delete cascade,
  title text default 'New Chat',
  is_pinned boolean default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ─── Messages ────────────────────────────────
create table if not exists messages (
  id uuid primary key default gen_random_uuid(),
  session_id uuid references chat_sessions on delete cascade,
  role text not null check (role in ('user', 'assistant')),
  content text not null,
  created_at timestamptz default now()
);

-- ─── Query Logs (Analytics) ──────────────────
create table if not exists query_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users on delete cascade,
  domain text check (domain in ('math', 'stats', 'coding', 'webdev', 'security', 'general')),
  tokens_used int default 0,
  response_quality text default 'excellent' check (response_quality in ('excellent', 'good', 'poor')),
  created_at timestamptz default now()
);

-- ─── Study Topics ─────────────────────────────
create table if not exists study_topics (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users on delete cascade,
  title text not null,
  status text default 'active' check (status in ('active', 'completed', 'saved')),
  is_focus boolean default false,
  order_index int default 0,
  created_at timestamptz default now()
);

-- ═══════════════════════════════════════════════
-- Row Level Security Policies
-- ═══════════════════════════════════════════════
alter table profiles enable row level security;
alter table user_settings enable row level security;
alter table chat_sessions enable row level security;
alter table messages enable row level security;
alter table query_logs enable row level security;
alter table study_topics enable row level security;

-- Profiles: users see only their own
create policy "profiles_own" on profiles
  for all using (auth.uid() = id);

-- Settings: users see only their own
create policy "settings_own" on user_settings
  for all using (auth.uid() = user_id);

-- Chat sessions: users see only their own
create policy "sessions_own" on chat_sessions
  for all using (auth.uid() = user_id);

-- Messages: users see messages in their own sessions
create policy "messages_own" on messages
  for all using (
    exists (
      select 1 from chat_sessions
      where chat_sessions.id = messages.session_id
      and chat_sessions.user_id = auth.uid()
    )
  );

-- Query logs: users see only their own
create policy "logs_own" on query_logs
  for all using (auth.uid() = user_id);

-- Study topics: users see only their own
create policy "topics_own" on study_topics
  for all using (auth.uid() = user_id);

-- ─── Indexes for performance ──────────────────
create index if not exists idx_chat_sessions_user on chat_sessions(user_id, updated_at desc);
create index if not exists idx_messages_session on messages(session_id, created_at asc);
create index if not exists idx_query_logs_user_date on query_logs(user_id, created_at desc);
create index if not exists idx_study_topics_user on study_topics(user_id, status, order_index);

-- ═══════════════════════════════════════════════
-- Storage — profile photos
-- ═══════════════════════════════════════════════
insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;

-- Anyone can view avatars (bucket is public); a user may only write/replace/
-- delete objects under a path prefixed with their own uid, e.g. "<uid>/photo.jpg".
create policy "avatars_public_read" on storage.objects
  for select using (bucket_id = 'avatars');

create policy "avatars_own_write" on storage.objects
  for insert with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "avatars_own_update" on storage.objects
  for update using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "avatars_own_delete" on storage.objects
  for delete using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
