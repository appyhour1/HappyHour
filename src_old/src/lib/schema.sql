-- ================================================================
-- Happy Hour Platform — Production Schema Migration
-- Run this in Supabase SQL Editor
-- ================================================================

-- ── EXTENSIONS ──────────────────────────────────────────────────
-- PostGIS for geo queries (distance filtering, nearby venues)
create extension if not exists postgis;


-- ── ENUMS ───────────────────────────────────────────────────────
create type price_tier as enum ('$', '$$', '$$$', '$$$$');

create type verification_status as enum (
  'unverified',   -- user submitted, unchecked
  'community',    -- multiple users confirmed
  'verified',     -- manually reviewed by admin
  'claimed'       -- business owner has taken ownership
);

create type data_source as enum (
  'user_submitted',
  'business_claimed',
  'scraped',
  'admin'
);

create type deal_type as enum (
  'beer', 'wine', 'cocktail', 'food', 'general'
);

create type venue_category as enum (
  'sports_bar', 'dive_bar', 'cocktail_bar', 'rooftop',
  'restaurant', 'brewery', 'wine_bar', 'pub', 'lounge',
  'date_night', 'patio', 'live_music', 'late_night'
);


-- ── VENUES ──────────────────────────────────────────────────────
create table venues (
  id                  uuid primary key default gen_random_uuid(),
  created_at          timestamptz default now() not null,
  updated_at          timestamptz default now() not null,

  -- Identity
  name                text not null,
  neighborhood        text not null default '',
  city                text not null default 'Cincinnati',
  state               text not null default 'OH',

  -- Location
  address             text,
  latitude            float8,
  longitude           float8,
  location            geography(Point, 4326),  -- PostGIS point for distance queries

  -- Contact
  website             text,
  phone               text,

  -- Classification
  categories          venue_category[] not null default '{}',
  price_tier          price_tier,

  -- Media
  image_url           text,

  -- Trust
  verification_status verification_status not null default 'unverified',
  last_verified_at    timestamptz,
  data_source         data_source not null default 'user_submitted',
  claimed_by_user_id  uuid references auth.users(id) on delete set null,

  -- Platform
  is_featured         boolean not null default false,
  upvote_count        integer not null default 0
);

-- Auto-update updated_at
create or replace function update_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger venues_updated_at
  before update on venues
  for each row execute function update_updated_at();

-- Auto-sync lat/lng to PostGIS geography point
create or replace function sync_venue_location()
returns trigger as $$
begin
  if new.latitude is not null and new.longitude is not null then
    new.location = st_point(new.longitude, new.latitude)::geography;
  end if;
  return new;
end;
$$ language plpgsql;

create trigger venues_sync_location
  before insert or update on venues
  for each row execute function sync_venue_location();


-- ── HAPPY HOUR SCHEDULES ────────────────────────────────────────
-- Each venue can have multiple schedules
-- e.g. Mon–Wed 4–6pm has different deals than Thu–Fri 3–7pm
create table happy_hour_schedules (
  id          uuid primary key default gen_random_uuid(),
  venue_id    uuid not null references venues(id) on delete cascade,
  created_at  timestamptz default now() not null,
  updated_at  timestamptz default now() not null,

  -- When
  days        text[] not null default '{}',  -- ['Mon','Tue','Wed']
  start_time  time not null default '16:00',
  end_time    time not null default '18:00',
  is_all_day  boolean not null default false,

  -- What
  deal_text   text not null default '',   -- display summary
  deals       jsonb not null default '[]' -- array of DealItem objects
);

create trigger schedules_updated_at
  before update on happy_hour_schedules
  for each row execute function update_updated_at();

-- ── INDEXES ─────────────────────────────────────────────────────
-- Geo index for distance queries
create index venues_location_idx on venues using gist(location);

-- City index — most queries will filter by city
create index venues_city_idx on venues(city, state);

-- Featured venues surface first
create index venues_featured_idx on venues(is_featured desc, upvote_count desc);

-- Full-text search on venue name
create index venues_name_search_idx on venues using gin(to_tsvector('english', name));

-- Schedules by venue
create index schedules_venue_idx on happy_hour_schedules(venue_id);


-- ── ROW LEVEL SECURITY ──────────────────────────────────────────
alter table venues enable row level security;
alter table happy_hour_schedules enable row level security;

-- Anyone can read venues and schedules
create policy "Public read venues"
  on venues for select using (true);

create policy "Public read schedules"
  on happy_hour_schedules for select using (true);

-- Anyone can insert (open contribution model — tighten later with auth)
create policy "Public insert venues"
  on venues for insert with check (true);

create policy "Public insert schedules"
  on happy_hour_schedules for insert with check (true);

-- Anyone can update (tighten later: auth.uid() = claimed_by_user_id)
create policy "Public update venues"
  on venues for update using (true);

create policy "Public update schedules"
  on happy_hour_schedules for update using (true);

-- Anyone can delete (tighten later with ownership checks)
create policy "Public delete venues"
  on venues for delete using (true);

create policy "Public delete schedules"
  on happy_hour_schedules for delete using (true);


-- ── HELPER VIEWS ────────────────────────────────────────────────

-- Venues with their schedules as a JSON array — reduces round trips
create or replace view venues_with_schedules as
select
  v.*,
  coalesce(
    json_agg(
      json_build_object(
        'id',         s.id,
        'venue_id',   s.venue_id,
        'days',       s.days,
        'start_time', s.start_time::text,
        'end_time',   s.end_time::text,
        'is_all_day', s.is_all_day,
        'deal_text',  s.deal_text,
        'deals',      s.deals,
        'created_at', s.created_at,
        'updated_at', s.updated_at
      ) order by s.start_time
    ) filter (where s.id is not null),
    '[]'
  ) as schedules
from venues v
left join happy_hour_schedules s on s.venue_id = v.id
group by v.id;


-- ── DISTANCE QUERY HELPER ───────────────────────────────────────
-- Usage: select * from venues_near_point(-84.512, 39.103, 5000)
-- Returns venues within radius_meters of (lng, lat), ordered by distance
create or replace function venues_near_point(
  lng float8,
  lat float8,
  radius_meters float8 default 8047  -- default 5 miles
)
returns table (
  id uuid,
  name text,
  neighborhood text,
  distance_meters float8
)
language sql stable as $$
  select
    v.id,
    v.name,
    v.neighborhood,
    st_distance(v.location, st_point(lng, lat)::geography) as distance_meters
  from venues v
  where v.location is not null
    and st_dwithin(v.location, st_point(lng, lat)::geography, radius_meters)
  order by distance_meters;
$$;
