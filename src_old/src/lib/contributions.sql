-- ================================================================
-- Happy Hour — Contributions Table Migration
-- Run this in Supabase SQL Editor
-- ================================================================

create table if not exists contributions (
  id          uuid primary key default gen_random_uuid(),
  created_at  timestamptz default now() not null,
  flow        text not null check (flow in ('new_venue', 'suggest_edit')),
  status      text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  data        jsonb not null default '{}',
  reviewed_at timestamptz,
  reviewed_by uuid references auth.users(id),
  notes       text  -- admin notes on why approved/rejected
);

alter table contributions enable row level security;

-- Anyone can submit
create policy "Public insert contributions"
  on contributions for insert with check (true);

-- Only admins can read/update (tighten later with actual admin role)
create policy "Public read contributions"
  on contributions for select using (true);

create policy "Public update contributions"
  on contributions for update using (true);

-- Index for admin review queue
create index contributions_status_idx on contributions(status, created_at desc);
create index contributions_flow_idx on contributions(flow);
