-- Run this in the Supabase SQL Editor (dashboard) to get a few sample
-- rows so the storefront isn't empty while you test locally.
-- If you already ran the old version of this file, you can re-run this
-- one too — it will just add a second draw (harmless for testing), but
-- delete the old draws row first if you want a clean slate:
--   delete from draws;

insert into groups (key, label, sort_order) values
  ('single', 'Single', 1),
  ('pair', 'Pair', 2),
  ('set', 'Set of 5', 3)
on conflict (key) do nothing;

insert into draws (label, draw_date, tiers, published) values
  ('16 September 2026', '2026-09-16',
   '[
     {"label":"First prize","prize":"6,000,000","numbers":["123456"]},
     {"label":"Second prize","prize":"200,000","numbers":["654321","112233"]},
     {"label":"Third prize","prize":"80,000","numbers":["445566","778899","998877"]}
   ]'::jsonb,
   true);

insert into tickets (number, group_key, status, price) values
  ('123456', 'single', 'available', 80),
  ('654321', 'single', 'available', 80),
  ('112233', 'pair', 'available', 90),
  ('445566', 'pair', 'available', 90),
  ('778899', 'set', 'available', 400);
