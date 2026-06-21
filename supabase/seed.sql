-- Coat Check — seed data. Run after 0001_init.sql.
-- Mirrors lib/catalog.ts (the generic baseline catalog) so the DB and the engine agree.

insert into clothing_items (id, name, category, min_temp_c, max_temp_c, requires_rain, requires_wind, icon) values
  -- Tops
  ('tank',             'Tank top',            'Tops',        26,  60, false, false, '🎽'),
  ('tshirt',           'T-shirt',             'Tops',        18,  30, false, false, '👕'),
  ('long_sleeve',      'Long-sleeve shirt',   'Tops',        12,  22, false, false, '👔'),
  ('sweater',          'Sweater',             'Tops',         4,  15, false, false, '🧶'),
  ('thermal_top',      'Thermal base layer',  'Tops',       -40,   6, false, false, '🩲'),
  -- Bottoms
  ('shorts',           'Shorts',              'Bottoms',     22,  60, false, false, '🩳'),
  ('trousers',         'Trousers / jeans',    'Bottoms',      6,  24, false, false, '👖'),
  ('thermal_leggings', 'Thermal leggings',    'Bottoms',    -40,   8, false, false, '🦵'),
  -- Outerwear
  ('light_jacket',     'Light jacket',        'Outerwear',   10,  17, false, false, '🧥'),
  ('heavy_coat',       'Heavy coat',          'Outerwear',  -40,   9, false, false, '🧥'),
  ('raincoat',         'Raincoat',            'Outerwear',  -40,  22, true,  false, '🌂'),
  ('windbreaker',      'Windbreaker',         'Outerwear',    6,  20, false, true,  '🧥'),
  -- Accessories
  ('umbrella',         'Umbrella',            'Accessories',-40,  60, true,  false, '☂️'),
  ('sunglasses',       'Sunglasses',          'Accessories', 18,  60, false, false, '🕶️'),
  ('beanie',           'Beanie',              'Accessories',-40,   6, false, false, '🧢'),
  ('gloves',           'Gloves',              'Accessories',-40,   4, false, false, '🧤'),
  ('scarf',            'Scarf',               'Accessories',-40,   7, false, false, '🧣')
on conflict (id) do nothing;

-- Initial generic baselines (version 1): no offset until cohort feedback refines them.
insert into baselines (cohort, version, thresholds) values
  ('alpha', 1, '{"offsetC":0}'::jsonb),
  ('beta',  1, '{"offsetC":0}'::jsonb),
  ('ga',    1, '{"offsetC":0}'::jsonb)
on conflict (cohort, version) do nothing;
