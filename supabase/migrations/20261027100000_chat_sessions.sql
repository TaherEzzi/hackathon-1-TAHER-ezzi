-- chat_sessions + chat_messages — memory for the chat agent (F0 "returning
-- traveller lands on that thread", F12 multi-turn).
--   * chat_sessions.slots holds the facts gathered so far (route, dates, cabin,
--     pax, card codes, points held) so a later turn never re-asks them.
--   * chat_messages carries user_id as well as session_id so RLS is a single
--     column compare, not a join per row.
-- Writes go through the service role (same rule as itineraries: the engine
-- payload attached to an assistant message is never client-minted). Clients
-- read their own rows and may delete a session.

create table public.chat_sessions (
  id         uuid        primary key default gen_random_uuid(),
  user_id    uuid        not null references auth.users (id) on delete cascade,
  title      text,
  slots      jsonb       not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index idx_chat_sessions_user on public.chat_sessions (user_id, updated_at desc);

create trigger trg_chat_sessions_updated_at
  before update on public.chat_sessions
  for each row execute function public.touch_updated_at();

create table public.chat_messages (
  id           uuid        primary key default gen_random_uuid(),
  session_id   uuid        not null references public.chat_sessions (id) on delete cascade,
  user_id      uuid        not null references auth.users (id) on delete cascade,
  role         text        not null check (role in ('user', 'assistant')),
  content      text        not null check (char_length(content) <= 8000),
  payload      jsonb,
  itinerary_id uuid        references public.itineraries (id) on delete set null,
  created_at   timestamptz not null default now()
);
create index idx_chat_messages_session on public.chat_messages (session_id, created_at);
create index idx_chat_messages_user on public.chat_messages (user_id);
create index idx_chat_messages_itinerary on public.chat_messages (itinerary_id) where itinerary_id is not null;

alter table public.chat_sessions enable row level security;
alter table public.chat_messages enable row level security;

create policy "chat_sessions_select_own" on public.chat_sessions
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "chat_sessions_delete_own" on public.chat_sessions
  for delete to authenticated using ((select auth.uid()) = user_id);
create policy "chat_messages_select_own" on public.chat_messages
  for select to authenticated using ((select auth.uid()) = user_id);

grant select, delete on public.chat_sessions to authenticated;
grant select on public.chat_messages to authenticated;
