-- ================================================================
-- Happy Hour Platform — Sample Data Seed
-- Run this in Supabase SQL Editor AFTER running schema.sql
-- ================================================================

-- ── VENUES ──────────────────────────────────────────────────────

insert into venues (id, name, neighborhood, city, state, address, latitude, longitude, website, phone, categories, price_tier, verification_status, last_verified_at, data_source, is_featured, upvote_count)
values
  ('00000000-0000-0000-0000-000000000001', 'The Eagle OTR',        'OTR',        'Cincinnati', 'OH', '1342 Vine St, Cincinnati, OH 45202',         39.1095, -84.5178, 'https://eaglerestaurant.com',     '(513) 802-5007', array['restaurant','patio']::venue_category[],              '$$', 'community', now() - interval '5 days',  'user_submitted', true,  42),
  ('00000000-0000-0000-0000-000000000002', 'Boca',                 'Downtown',   'Cincinnati', 'OH', '114 E 6th St, Cincinnati, OH 45202',          39.1006, -84.5111, 'https://bocacincinnati.com',       '(513) 542-2022', array['cocktail_bar','date_night','lounge']::venue_category[], '$$$', 'verified',  now() - interval '2 days',  'user_submitted', true,  38),
  ('00000000-0000-0000-0000-000000000003', 'Neon''s',              'Northside',  'Cincinnati', 'OH', '4120 Hamilton Ave, Cincinnati, OH 45223',     39.1574, -84.5401, null,                               '(513) 541-0040', array['dive_bar','live_music','late_night']::venue_category[],  '$',   'community', now() - interval '12 days', 'user_submitted', false, 27),
  ('00000000-0000-0000-0000-000000000004', 'Prime Cincinnati',     'Downtown',   'Cincinnati', 'OH', '600 Walnut St, Cincinnati, OH 45202',         39.1027, -84.5124, 'https://primecincinnati.com',      '(513) 621-2210', array['cocktail_bar','date_night','lounge']::venue_category[], '$$$', 'verified',  now() - interval '1 day',   'user_submitted', false, 31),
  ('00000000-0000-0000-0000-000000000005', 'Taste of Belgium',     'OTR',        'Cincinnati', 'OH', '1362 Vine St, Cincinnati, OH 45202',          39.1101, -84.5181, 'https://tasteofbelgium.com',       '(513) 721-5600', array['restaurant','patio']::venue_category[],              '$$', 'community', now() - interval '8 days',  'user_submitted', false, 19),
  ('00000000-0000-0000-0000-000000000006', 'Incline Public House', 'Price Hill', 'Cincinnati', 'OH', '2601 W Fork Rd, Cincinnati, OH 45211',        39.1166, -84.5624, 'https://inclinepublichouse.com',   '(513) 251-2525', array['restaurant','patio','rooftop']::venue_category[],    '$$', 'unverified', null,                        'user_submitted', false, 14);


-- ── SCHEDULES ───────────────────────────────────────────────────

insert into happy_hour_schedules (venue_id, days, start_time, end_time, is_all_day, deal_text, deals)
values
  -- Eagle OTR: Mon–Fri 3–6pm
  ('00000000-0000-0000-0000-000000000001',
   array['Mon','Tue','Wed','Thu','Fri'], '15:00', '18:00', false,
   '$4 drafts, $6 cocktails, half-off fried chicken sandwiches',
   '[
     {"type":"beer",     "description":"$4 draft beer",                     "price":4},
     {"type":"cocktail", "description":"$6 house cocktails",                "price":6},
     {"type":"food",     "description":"Half-off fried chicken sandwiches"}
   ]'::jsonb),

  -- Boca: Mon–Fri 4–7pm
  ('00000000-0000-0000-0000-000000000002',
   array['Mon','Tue','Wed','Thu','Fri'], '16:00', '19:00', false,
   '$5 house wine, $3 domestics, $7 margaritas',
   '[
     {"type":"wine",     "description":"$5 house wine",        "price":5},
     {"type":"beer",     "description":"$3 domestic bottles",  "price":3},
     {"type":"cocktail", "description":"$7 margaritas",        "price":7}
   ]'::jsonb),

  -- Neon's: Tue–Thu 5–8pm
  ('00000000-0000-0000-0000-000000000003',
   array['Tue','Wed','Thu'], '17:00', '20:00', false,
   '$2 PBR, $4 wells, half-off pizza slices',
   '[
     {"type":"beer",     "description":"$2 PBR cans",         "price":2},
     {"type":"cocktail", "description":"$4 well drinks",      "price":4},
     {"type":"food",     "description":"Half-off pizza slices"}
   ]'::jsonb),

  -- Neon's: Fri–Sat 4–7pm (different deal)
  ('00000000-0000-0000-0000-000000000003',
   array['Fri','Sat'], '16:00', '19:00', false,
   '$3 PBR, $5 wells — weekend kickoff',
   '[
     {"type":"beer",     "description":"$3 PBR cans",    "price":3},
     {"type":"cocktail", "description":"$5 well drinks", "price":5}
   ]'::jsonb),

  -- Prime: Mon–Fri 4:30–6:30pm
  ('00000000-0000-0000-0000-000000000004',
   array['Mon','Tue','Wed','Thu','Fri'], '16:30', '18:30', false,
   '$6 signature cocktails, $5 craft beers, complimentary bar bites',
   '[
     {"type":"cocktail", "description":"$6 signature cocktails", "price":6},
     {"type":"beer",     "description":"$5 craft beers",         "price":5},
     {"type":"food",     "description":"Complimentary bar bites"}
   ]'::jsonb),

  -- Taste of Belgium: Mon–Fri 3–5pm
  ('00000000-0000-0000-0000-000000000005',
   array['Mon','Tue','Wed','Thu','Fri'], '15:00', '17:00', false,
   'Half-off waffles & frites, $4 Belgian ales',
   '[
     {"type":"food", "description":"Half-off waffles & frites"},
     {"type":"beer", "description":"$4 Belgian ales", "price":4}
   ]'::jsonb),

  -- Incline Public House: Mon–Sat 4–7pm
  ('00000000-0000-0000-0000-000000000006',
   array['Mon','Tue','Wed','Thu','Fri','Sat'], '16:00', '19:00', false,
   '$3 drafts, $5 cocktails, half-off flatbreads',
   '[
     {"type":"beer",     "description":"$3 draft beer",       "price":3},
     {"type":"cocktail", "description":"$5 house cocktails",  "price":5},
     {"type":"food",     "description":"Half-off flatbreads"}
   ]'::jsonb);
