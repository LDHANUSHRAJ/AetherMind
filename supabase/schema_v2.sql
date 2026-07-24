-- ═══════════════════════════════════════════════
-- AetherMind — Schema migration v2
-- Adds tables for: Practice Problems, Flashcards, Collaborative Study Rooms,
-- Curriculum Planner (deadlines), and mistake-tracking columns.
-- Run this in the Supabase SQL Editor AFTER schema.sql. Purely additive —
-- safe to re-run (all statements are idempotent).
-- ═══════════════════════════════════════════════

-- ─── Mistake tracking (Phase 3.1) ─────────────────
alter table query_logs add column if not exists error_type text;
alter table query_logs add column if not exists okf_source text;

-- ─── Practice Problems (Phase 3.2) ─────────────────
create table if not exists practice_problems (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users on delete cascade,
  domain text not null,
  difficulty text not null default 'intermediate',
  problem text not null,
  verified_solution text,
  full_solution text,
  student_answer text,
  is_correct boolean,
  error_type text,
  created_at timestamptz default now()
);

alter table practice_problems enable row level security;
drop policy if exists "practice_own" on practice_problems;
create policy "practice_own" on practice_problems
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create index if not exists idx_practice_user on practice_problems(user_id, created_at desc);

-- ─── Flashcard Sets (Phase 3.3) ─────────────────────
create table if not exists flashcard_sets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users on delete cascade,
  title text not null,
  domain text,
  cards jsonb not null default '[]'::jsonb,   -- [{front, back}]
  created_at timestamptz default now()
);

alter table flashcard_sets enable row level security;
drop policy if exists "flashcards_own" on flashcard_sets;
create policy "flashcards_own" on flashcard_sets
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create index if not exists idx_flashcards_user on flashcard_sets(user_id, created_at desc);

-- ─── Collaborative Study Rooms (Phase 5.1) ──────────
create table if not exists study_rooms (
  id uuid primary key default gen_random_uuid(),
  created_by uuid not null references auth.users(id),
  room_code text unique not null,
  name text not null,
  is_active boolean default true,
  created_at timestamptz default now()
);

create table if not exists room_members (
  room_id uuid references study_rooms(id) on delete cascade,
  user_id uuid references auth.users(id) on delete cascade,
  display_name text,
  joined_at timestamptz default now(),
  primary key (room_id, user_id)
);

create table if not exists room_messages (
  id uuid primary key default gen_random_uuid(),
  room_id uuid references study_rooms(id) on delete cascade,
  user_id uuid references auth.users(id),
  role text not null check (role in ('user', 'ai', 'system')),
  content text not null,
  sender_name text,
  created_at timestamptz default now()
);

alter table study_rooms enable row level security;
alter table room_members enable row level security;
alter table room_messages enable row level security;

-- Anyone signed in may look up a room by code (to join); only members can see
-- full room details otherwise. Simplified for a study-room use case: any
-- authenticated user can read/join active rooms.
drop policy if exists "rooms_read" on study_rooms;
create policy "rooms_read" on study_rooms
  for select using (auth.role() = 'authenticated');
drop policy if exists "rooms_insert" on study_rooms;
create policy "rooms_insert" on study_rooms
  for insert with check (auth.uid() = created_by);
drop policy if exists "rooms_update_owner" on study_rooms;
create policy "rooms_update_owner" on study_rooms
  for update using (auth.uid() = created_by);

drop policy if exists "room_members_read" on room_members;
create policy "room_members_read" on room_members
  for select using (auth.role() = 'authenticated');
drop policy if exists "room_members_join" on room_members;
create policy "room_members_join" on room_members
  for insert with check (auth.uid() = user_id);
drop policy if exists "room_members_leave" on room_members;
create policy "room_members_leave" on room_members
  for delete using (auth.uid() = user_id);

drop policy if exists "room_messages_read" on room_messages;
create policy "room_messages_read" on room_messages
  for select using (
    exists (select 1 from room_members m where m.room_id = room_messages.room_id and m.user_id = auth.uid())
  );
drop policy if exists "room_messages_send" on room_messages;
create policy "room_messages_send" on room_messages
  for insert with check (
    auth.uid() = user_id and
    exists (select 1 from room_members m where m.room_id = room_messages.room_id and m.user_id = auth.uid())
  );

create index if not exists idx_room_messages_room on room_messages(room_id, created_at asc);

-- ─── Curriculum Planner / Deadlines (Phase 5.2) ─────
create table if not exists deadlines (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  domain text,
  topics text[] default '{}',
  due_date date not null,
  completed boolean default false,
  created_at timestamptz default now()
);

alter table deadlines enable row level security;
drop policy if exists "deadlines_own" on deadlines;
create policy "deadlines_own" on deadlines
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create index if not exists idx_deadlines_user on deadlines(user_id, due_date asc);
