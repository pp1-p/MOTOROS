-- DealerOS development seed.
-- This file is intentionally idempotent and contains no Supabase Auth users.
-- Create an Auth user separately, then claim the seeded organisation as described
-- in docs/DATABASE.md.

begin;

insert into public.organisations (
  id,
  name,
  slug,
  status,
  default_timezone
)
values (
  '00000000-0000-4000-8000-000000000001',
  'DealerOS',
  'dealeros',
  'active',
  'Europe/London'
)
on conflict (id) do update
set
  name = excluded.name,
  slug = excluded.slug,
  status = excluded.status,
  default_timezone = excluded.default_timezone,
  deleted_at = null;

insert into public.dealership_settings (
  organisation_id,
  dealership_name,
  telephone,
  email,
  address,
  opening_hours,
  social_links,
  company_number,
  vat_number,
  brand_primary_colour,
  brand_accent_colour,
  homepage_wording,
  legal_wording,
  timezone,
  data_retention_months
)
values (
  '00000000-0000-4000-8000-000000000001',
  'DealerOS',
  '01632 960 480',
  'hello@dealeros.example',
  '{
    "line1":"12 Market Road",
    "town":"Exampleton",
    "county":"Warwickshire",
    "postcode":"EX4 2PL",
    "country":"United Kingdom"
  }',
  '{
    "monday":{"open":"09:00","close":"17:30"},
    "tuesday":{"open":"09:00","close":"17:30"},
    "wednesday":{"open":"09:00","close":"17:30"},
    "thursday":{"open":"09:00","close":"17:30"},
    "friday":{"open":"09:00","close":"17:30"},
    "saturday":{"open":"09:00","close":"16:00"},
    "sunday":null
  }',
  '{"facebook":"","instagram":"","youtube":""}',
  '12345678',
  'GB123456789',
  '#172033',
  '#D4A853',
  '{
    "eyebrow":"Independent expertise, thoughtfully delivered",
    "headline":"Better cars. Clearer advice. Proper aftercare.",
    "summary":"Hand-picked used cars, personal vehicle sourcing and trusted workshop support."
  }',
  '{
    "review_required":true,
    "notice":"Example legal content must be reviewed by the dealership before launch."
  }',
  'Europe/London',
  84
)
on conflict (organisation_id) do update
set
  dealership_name = excluded.dealership_name,
  telephone = excluded.telephone,
  email = excluded.email,
  address = excluded.address,
  opening_hours = excluded.opening_hours,
  homepage_wording = excluded.homepage_wording,
  updated_at = now();

insert into public.vehicles (
  id,
  organisation_id,
  registration,
  stock_number,
  make,
  model,
  derivative,
  trim_level,
  body_type,
  fuel_type,
  transmission,
  colour,
  doors,
  seats,
  engine_size_cc,
  power_bhp,
  co2_emissions_g_km,
  euro_emissions_standard,
  ulez_status,
  year,
  first_registration_date,
  registration_year,
  mot_expiry,
  mileage,
  service_history,
  number_of_keys,
  warranty,
  purchase_price,
  preparation_costs,
  repair_costs,
  other_costs,
  retail_price,
  minimum_acceptable_price,
  deposit_amount,
  public_title,
  attention_grabber,
  description,
  features,
  warranty_wording,
  featured,
  is_public,
  slug,
  status,
  acquired_at,
  sold_at,
  actual_sale_price,
  published_at
)
values
  (
    '20000000-0000-4000-8000-000000000001',
    '00000000-0000-4000-8000-000000000001',
    'LX21 DOS',
    'DOS-26-001',
    'BMW',
    '3 Series',
    '320i M Sport',
    'M Sport',
    'Saloon',
    'Petrol',
    'Automatic',
    'Portimao Blue',
    4,
    5,
    1998,
    184,
    148,
    'Euro 6',
    'compliant',
    2021,
    '2021-03-19',
    '21',
    current_date + 210,
    28400,
    'Full service history',
    2,
    '6 months comprehensive warranty',
    21400,
    650,
    180,
    120,
    25995,
    24750,
    500,
    'BMW 320i M Sport',
    'One owner, excellent history and beautifully specified',
    'A composed, sporting executive saloon prepared to a high retail standard. Supplied with two keys, documented history and a fresh workshop inspection.',
    array['M Sport package','Heated front seats','Parking sensors','Apple CarPlay'],
    'Six-month comprehensive warranty included. Terms apply.',
    true,
    true,
    'bmw-320i-m-sport-2021',
    'on_forecourt',
    current_date - 24,
    null,
    null,
    now() - interval '20 days'
  ),
  (
    '20000000-0000-4000-8000-000000000002',
    '00000000-0000-4000-8000-000000000001',
    'KP70 DOS',
    'DOS-26-002',
    'Audi',
    'Q3',
    '35 TFSI S line',
    'S line',
    'SUV',
    'Petrol',
    'Automatic',
    'Glacier White',
    5,
    5,
    1498,
    150,
    153,
    'Euro 6',
    'compliant',
    2020,
    '2020-11-12',
    '70',
    current_date + 140,
    36200,
    'Full service history',
    2,
    '6 months comprehensive warranty',
    22100,
    740,
    260,
    95,
    26950,
    25750,
    500,
    'Audi Q3 35 TFSI S line',
    'Reserved — please contact us for similar stock',
    'A refined compact SUV with strong specification, excellent provenance and a documented service record.',
    array['Virtual Cockpit','S line styling','Climate control','Rear camera'],
    'Six-month comprehensive warranty included. Terms apply.',
    false,
    true,
    'audi-q3-35-tfsi-s-line-2020',
    'reserved',
    current_date - 31,
    null,
    null,
    now() - interval '27 days'
  ),
  (
    '20000000-0000-4000-8000-000000000003',
    '00000000-0000-4000-8000-000000000001',
    'GF21 DOS',
    'DOS-26-003',
    'Volkswagen',
    'Golf',
    '1.5 TSI Style',
    'Style',
    'Hatchback',
    'Petrol',
    'Manual',
    'Dolphin Grey',
    5,
    5,
    1498,
    150,
    128,
    'Euro 6',
    'compliant',
    2021,
    '2021-06-04',
    '21',
    current_date + 250,
    31750,
    'Main dealer history',
    2,
    '6 months comprehensive warranty',
    15800,
    520,
    90,
    80,
    18995,
    18100,
    350,
    'Volkswagen Golf 1.5 TSI Style',
    'A well-kept Golf with excellent everyday specification',
    'Comfortable, efficient and easy to own, this Golf has been carefully selected and independently inspected.',
    array['Adaptive cruise control','Digital cockpit','Front and rear sensors','LED headlights'],
    'Six-month comprehensive warranty included. Terms apply.',
    false,
    true,
    'volkswagen-golf-15-tsi-style-2021',
    'on_forecourt',
    current_date - 16,
    null,
    null,
    now() - interval '13 days'
  ),
  (
    '20000000-0000-4000-8000-000000000004',
    '00000000-0000-4000-8000-000000000001',
    'EN22 DOS',
    'DOS-26-004',
    'Ford',
    'Puma',
    '1.0 EcoBoost mHEV ST-Line',
    'ST-Line',
    'SUV',
    'Petrol hybrid',
    'Manual',
    'Fantastic Red',
    5,
    5,
    999,
    125,
    122,
    'Euro 6',
    'compliant',
    2022,
    '2022-05-23',
    '22',
    current_date + 310,
    22100,
    'Full service history',
    2,
    'Balance of manufacturer warranty where applicable',
    14900,
    430,
    70,
    75,
    17995,
    17100,
    350,
    'Ford Puma ST-Line mHEV',
    'Low mileage, lively to drive and practical',
    'A smart mild-hybrid Puma with strong equipment, low running costs and a clean inspection report.',
    array['ST-Line body styling','Navigation','Cruise control','Quickclear windscreen'],
    'Warranty details supplied with the vehicle documentation.',
    false,
    true,
    'ford-puma-st-line-mhev-2022',
    'ready_for_sale',
    current_date - 9,
    null,
    null,
    now() - interval '2 days'
  ),
  (
    '20000000-0000-4000-8000-000000000005',
    '00000000-0000-4000-8000-000000000001',
    'RX20 DOS',
    'DOS-26-005',
    'Mercedes-Benz',
    'A-Class',
    'A200 AMG Line',
    'AMG Line',
    'Hatchback',
    'Petrol',
    'Automatic',
    'Cosmos Black',
    5,
    5,
    1332,
    163,
    137,
    'Euro 6',
    'compliant',
    2020,
    '2020-08-17',
    '20',
    current_date + 180,
    40900,
    'Full service history',
    2,
    '6 months comprehensive warranty',
    17800,
    680,
    220,
    110,
    21950,
    20800,
    450,
    'Mercedes-Benz A200 AMG Line',
    'Premium compact motoring with a superb cabin',
    'A striking A-Class with the widescreen cockpit, smooth automatic transmission and careful ownership history.',
    array['Widescreen cockpit','AMG Line styling','Reversing camera','Heated seats'],
    'Six-month comprehensive warranty included. Terms apply.',
    true,
    true,
    'mercedes-a200-amg-line-2020',
    'on_forecourt',
    current_date - 38,
    null,
    null,
    now() - interval '34 days'
  ),
  (
    '20000000-0000-4000-8000-000000000006',
    '00000000-0000-4000-8000-000000000001',
    'YK22 DOS',
    'DOS-26-006',
    'Toyota',
    'Corolla',
    '1.8 VVT-i Hybrid Design',
    'Design',
    'Hatchback',
    'Petrol hybrid',
    'Automatic',
    'Scarlet Flare',
    5,
    5,
    1798,
    122,
    102,
    'Euro 6',
    'compliant',
    2022,
    '2022-04-11',
    '22',
    current_date + 275,
    27800,
    'Toyota service history',
    2,
    '6 months comprehensive warranty',
    15400,
    380,
    60,
    70,
    18495,
    17600,
    350,
    'Toyota Corolla Hybrid Design',
    'Smooth, economical hybrid with excellent reliability',
    'An efficient Corolla Hybrid with a reassuring maintenance record and useful driver-assistance technology.',
    array['Toyota Safety Sense','Reversing camera','Adaptive cruise control','Apple CarPlay'],
    'Six-month comprehensive warranty included. Terms apply.',
    false,
    true,
    'toyota-corolla-hybrid-design-2022',
    'on_forecourt',
    current_date - 13,
    null,
    null,
    now() - interval '10 days'
  ),
  (
    '20000000-0000-4000-8000-000000000007',
    '00000000-0000-4000-8000-000000000001',
    'VA71 DOS',
    'DOS-26-007',
    'Volvo',
    'XC40',
    'B4 Momentum',
    'Momentum',
    'SUV',
    'Petrol hybrid',
    'Automatic',
    'Thunder Grey',
    5,
    5,
    1969,
    197,
    151,
    'Euro 6',
    'compliant',
    2021,
    '2021-12-08',
    '71',
    current_date + 230,
    33500,
    'Full service history',
    2,
    '6 months comprehensive warranty',
    22950,
    810,
    190,
    130,
    27995,
    26750,
    500,
    'Volvo XC40 B4 Momentum',
    'Reserved following a successful viewing',
    'A beautifully presented XC40 with understated Scandinavian design, mild-hybrid efficiency and a strong safety specification.',
    array['Pilot Assist','Heated seats','Navigation','Power tailgate'],
    'Six-month comprehensive warranty included. Terms apply.',
    false,
    true,
    'volvo-xc40-b4-momentum-2021',
    'reserved',
    current_date - 28,
    null,
    null,
    now() - interval '24 days'
  ),
  (
    '20000000-0000-4000-8000-000000000008',
    '00000000-0000-4000-8000-000000000001',
    'BN23 DOS',
    'DOS-26-008',
    'Nissan',
    'Qashqai',
    '1.3 DIG-T N-Connecta',
    'N-Connecta',
    'SUV',
    'Petrol hybrid',
    'Manual',
    'Magnetic Blue',
    5,
    5,
    1332,
    140,
    145,
    'Euro 6',
    'compliant',
    2023,
    '2023-03-28',
    '23',
    current_date + 330,
    19600,
    'Full service history',
    2,
    'Balance of manufacturer warranty where applicable',
    17750,
    420,
    0,
    60,
    21495,
    20400,
    400,
    'Nissan Qashqai N-Connecta',
    'Recently arrived and undergoing preparation',
    'A modern family SUV currently progressing through our workshop preparation and quality-control process.',
    array['Around View Monitor','Navigation','Digital instruments','Keyless entry'],
    'Warranty details supplied with the vehicle documentation.',
    false,
    false,
    'nissan-qashqai-n-connecta-2023',
    'preparation',
    current_date - 3,
    null,
    null,
    null
  ),
  (
    '20000000-0000-4000-8000-000000000009',
    '00000000-0000-4000-8000-000000000001',
    'CU19 DOS',
    'DOS-26-009',
    'MINI',
    'Hatch',
    'Cooper Classic',
    'Classic',
    'Hatchback',
    'Petrol',
    'Manual',
    'Moonwalk Grey',
    3,
    4,
    1499,
    136,
    126,
    'Euro 6',
    'compliant',
    2019,
    '2019-07-19',
    '19',
    current_date + 90,
    44300,
    'Part service history',
    2,
    '6 months comprehensive warranty',
    9100,
    610,
    270,
    80,
    12495,
    11750,
    300,
    'MINI Cooper Classic',
    'Photography scheduled',
    'A characterful MINI with the desirable Cooper engine and a clean, carefully prepared interior.',
    array['Bluetooth','Cruise control','LED lights','Rear parking sensors'],
    'Six-month comprehensive warranty included. Terms apply.',
    false,
    false,
    'mini-cooper-classic-2019',
    'photography_required',
    current_date - 7,
    null,
    null,
    null
  ),
  (
    '20000000-0000-4000-8000-000000000010',
    '00000000-0000-4000-8000-000000000001',
    'LS22 DOS',
    'DOS-26-010',
    'Kia',
    'Sportage',
    '1.6 T-GDi 2',
    '2',
    'SUV',
    'Petrol',
    'Manual',
    'Phantom Black',
    5,
    5,
    1598,
    148,
    152,
    'Euro 6',
    'compliant',
    2022,
    '2022-09-02',
    '72',
    current_date + 300,
    24750,
    'Kia service history',
    2,
    'Balance of manufacturer warranty where applicable',
    16500,
    450,
    0,
    90,
    19995,
    19000,
    400,
    'Kia Sportage 1.6 T-GDi 2',
    'Due in shortly',
    'A spacious, well-equipped Sportage expected into stock shortly. Register interest for an early viewing.',
    array['Rear camera','Lane keep assist','Apple CarPlay','Cruise control'],
    'Warranty details supplied with the vehicle documentation.',
    false,
    false,
    'kia-sportage-tgdi-2-2022',
    'due_in',
    null,
    null,
    null,
    null
  ),
  (
    '20000000-0000-4000-8000-000000000011',
    '00000000-0000-4000-8000-000000000001',
    'MT70 DOS',
    'DOS-26-011',
    'Skoda',
    'Octavia',
    '1.5 TSI SE Technology',
    'SE Technology',
    'Estate',
    'Petrol',
    'Manual',
    'Quartz Grey',
    5,
    5,
    1498,
    150,
    124,
    'Euro 6',
    'compliant',
    2020,
    '2020-12-14',
    '70',
    current_date + 120,
    48800,
    'Full service history',
    2,
    'Warranty supplied at sale',
    11800,
    540,
    120,
    75,
    14995,
    14250,
    300,
    'Skoda Octavia SE Technology Estate',
    'Recently sold',
    'A practical and economical Octavia Estate, retained temporarily as an example of recently sold stock.',
    array['Navigation','Adaptive cruise control','Parking sensors','SmartLink'],
    'Sold vehicle — warranty information available from the sales record.',
    false,
    true,
    'skoda-octavia-se-technology-2020',
    'sold',
    current_date - 63,
    current_date - 6,
    14600,
    now() - interval '58 days'
  ),
  (
    '20000000-0000-4000-8000-000000000012',
    '00000000-0000-4000-8000-000000000001',
    'RJ69 DOS',
    'DOS-26-012',
    'Land Rover',
    'Range Rover Evoque',
    'D180 S',
    'S',
    'SUV',
    'Diesel',
    'Automatic',
    'Santorini Black',
    5,
    5,
    1999,
    180,
    158,
    'Euro 6',
    'compliant',
    2019,
    '2019-10-29',
    '69',
    current_date + 70,
    52600,
    'Full service history',
    2,
    'Warranty supplied at sale',
    16500,
    920,
    430,
    160,
    20995,
    19800,
    450,
    'Range Rover Evoque D180 S',
    'Recently sold',
    'A carefully prepared Evoque retained in the recently sold section while similar vehicles are sourced.',
    array['Leather upholstery','Navigation','Four-wheel drive','Reversing camera'],
    'Sold vehicle — warranty information available from the sales record.',
    false,
    true,
    'range-rover-evoque-d180-s-2019',
    'sold',
    current_date - 91,
    current_date - 17,
    20450,
    now() - interval '86 days'
  )
on conflict (id) do update
set
  registration = excluded.registration,
  stock_number = excluded.stock_number,
  make = excluded.make,
  model = excluded.model,
  derivative = excluded.derivative,
  trim_level = excluded.trim_level,
  body_type = excluded.body_type,
  fuel_type = excluded.fuel_type,
  transmission = excluded.transmission,
  colour = excluded.colour,
  mileage = excluded.mileage,
  retail_price = excluded.retail_price,
  public_title = excluded.public_title,
  attention_grabber = excluded.attention_grabber,
  description = excluded.description,
  features = excluded.features,
  featured = excluded.featured,
  is_public = excluded.is_public,
  slug = excluded.slug,
  status = excluded.status,
  sold_at = excluded.sold_at,
  actual_sale_price = excluded.actual_sale_price,
  deleted_at = null;

insert into public.vehicle_images (
  id,
  organisation_id,
  vehicle_id,
  external_url,
  mime_type,
  sort_order,
  is_cover,
  is_public,
  alt_text
)
values
  ('21000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001','https://images.unsplash.com/photo-1555215695-3004980ad54e?auto=format&fit=crop&w=1600&q=85','image/jpeg',0,true,true,'Blue BMW 3 Series parked outdoors'),
  ('21000000-0000-4000-8000-000000000002','00000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000002','https://images.unsplash.com/photo-1606664515524-ed2f786a0bd6?auto=format&fit=crop&w=1600&q=85','image/jpeg',0,true,true,'White Audi SUV front three-quarter view'),
  ('21000000-0000-4000-8000-000000000003','00000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000003','https://images.unsplash.com/photo-1471444928139-48c5bf5173f8?auto=format&fit=crop&w=1600&q=85','image/jpeg',0,true,true,'Grey Volkswagen hatchback on the road'),
  ('21000000-0000-4000-8000-000000000004','00000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000004','https://images.unsplash.com/photo-1549317661-bd32c8ce0db2?auto=format&fit=crop&w=1600&q=85','image/jpeg',0,true,true,'Red compact crossover in daylight'),
  ('21000000-0000-4000-8000-000000000005','00000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000005','https://images.unsplash.com/photo-1618843479313-40f8afb4b4d8?auto=format&fit=crop&w=1600&q=85','image/jpeg',0,true,true,'Black Mercedes-Benz hatchback'),
  ('21000000-0000-4000-8000-000000000006','00000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000006','https://images.unsplash.com/photo-1541899481282-d53bffe3c35d?auto=format&fit=crop&w=1600&q=85','image/jpeg',0,true,true,'Red hybrid hatchback'),
  ('21000000-0000-4000-8000-000000000007','00000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000007','https://images.unsplash.com/photo-1494905998402-395d579af36f?auto=format&fit=crop&w=1600&q=85','image/jpeg',0,true,true,'Grey premium SUV'),
  ('21000000-0000-4000-8000-000000000008','00000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000008','https://images.unsplash.com/photo-1503376780353-7e6692767b70?auto=format&fit=crop&w=1600&q=85','image/jpeg',0,true,false,'Blue family SUV awaiting preparation'),
  ('21000000-0000-4000-8000-000000000009','00000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000009','https://images.unsplash.com/photo-1533473359331-0135ef1b58bf?auto=format&fit=crop&w=1600&q=85','image/jpeg',0,true,false,'Grey compact hatchback'),
  ('21000000-0000-4000-8000-000000000010','00000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000010','https://images.unsplash.com/photo-1519641471654-76ce0107ad1b?auto=format&fit=crop&w=1600&q=85','image/jpeg',0,true,false,'Black family SUV'),
  ('21000000-0000-4000-8000-000000000011','00000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000011','https://images.unsplash.com/photo-1532581140115-3e355d1ed1de?auto=format&fit=crop&w=1600&q=85','image/jpeg',0,true,true,'Grey estate car'),
  ('21000000-0000-4000-8000-000000000012','00000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000012','https://images.unsplash.com/photo-1511919884226-fd3cad34687c?auto=format&fit=crop&w=1600&q=85','image/jpeg',0,true,true,'Black luxury SUV')
on conflict (id) do update
set
  external_url = excluded.external_url,
  is_public = excluded.is_public,
  alt_text = excluded.alt_text,
  deleted_at = null;

insert into public.vehicle_features (
  organisation_id,
  vehicle_id,
  category,
  name,
  is_highlight,
  sort_order
)
select
  v.organisation_id,
  v.id,
  'feature',
  feature_name,
  feature_order <= 2,
  feature_order - 1
from public.vehicles v
cross join lateral unnest(v.features) with ordinality as f(feature_name, feature_order)
where v.organisation_id = '00000000-0000-4000-8000-000000000001'
  and v.id::text like '20000000-%'
on conflict (vehicle_id, category, name) do update
set
  is_highlight = excluded.is_highlight,
  sort_order = excluded.sort_order;

insert into public.vehicle_costs (
  id,
  organisation_id,
  vehicle_id,
  purchase_price,
  preparation_costs,
  repair_costs,
  other_costs,
  minimum_acceptable_price
)
select
  ('22000000-0000-4000-8000-' || lpad(row_number() over (order by id)::text, 12, '0'))::uuid,
  organisation_id,
  id,
  purchase_price,
  preparation_costs,
  repair_costs,
  other_costs,
  minimum_acceptable_price
from public.vehicles
where organisation_id = '00000000-0000-4000-8000-000000000001'
  and id::text like '20000000-%'
on conflict (id) do update
set
  purchase_price = excluded.purchase_price,
  preparation_costs = excluded.preparation_costs,
  repair_costs = excluded.repair_costs,
  other_costs = excluded.other_costs,
  minimum_acceptable_price = excluded.minimum_acceptable_price,
  deleted_at = null;

insert into public.customers (
  id,
  organisation_id,
  full_name,
  first_name,
  last_name,
  email,
  phone,
  preferred_contact_method,
  marketing_consent,
  marketing_consent_at,
  marketing_consent_source,
  privacy_notice_accepted_at,
  address
)
values
  ('40000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000001','Amelia Harris','Amelia','Harris','amelia.harris@example.com','07700 900101','email',true,now() - interval '5 months','website enquiry',now() - interval '5 months','{"town":"Warwick","postcode":"CV34 4AA"}'),
  ('40000000-0000-4000-8000-000000000002','00000000-0000-4000-8000-000000000001','Noah Wilson','Noah','Wilson','noah.wilson@example.com','07700 900102','phone',false,null,null,now() - interval '3 months','{"town":"Leamington Spa","postcode":"CV32 5BB"}'),
  ('40000000-0000-4000-8000-000000000003','00000000-0000-4000-8000-000000000001','Olivia Patel','Olivia','Patel','olivia.patel@example.com','07700 900103','either',true,now() - interval '2 months','sourcing request',now() - interval '2 months','{"town":"Coventry","postcode":"CV1 2CC"}'),
  ('40000000-0000-4000-8000-000000000004','00000000-0000-4000-8000-000000000001','George Evans','George','Evans','george.evans@example.com','07700 900104','phone',false,null,null,now() - interval '6 weeks','{"town":"Rugby","postcode":"CV21 3DD"}'),
  ('40000000-0000-4000-8000-000000000005','00000000-0000-4000-8000-000000000001','Isla Thompson','Isla','Thompson','isla.thompson@example.com','07700 900105','email',true,now() - interval '8 months','sales enquiry',now() - interval '8 months','{"town":"Solihull","postcode":"B91 2EE"}'),
  ('40000000-0000-4000-8000-000000000006','00000000-0000-4000-8000-000000000001','Arthur Davies','Arthur','Davies','arthur.davies@example.com','07700 900106','either',false,null,null,now() - interval '4 weeks','{"town":"Kenilworth","postcode":"CV8 1FF"}'),
  ('40000000-0000-4000-8000-000000000007','00000000-0000-4000-8000-000000000001','Sophie Clarke','Sophie','Clarke','sophie.clarke@example.com','07700 900107','sms',true,now() - interval '1 month','repair booking',now() - interval '1 month','{"town":"Stratford-upon-Avon","postcode":"CV37 6GG"}'),
  ('40000000-0000-4000-8000-000000000008','00000000-0000-4000-8000-000000000001','Leo Robinson','Leo','Robinson','leo.robinson@example.com','07700 900108','email',false,null,null,now() - interval '10 days','{"town":"Nuneaton","postcode":"CV11 4HH"}')
on conflict (id) do update
set
  full_name = excluded.full_name,
  first_name = excluded.first_name,
  last_name = excluded.last_name,
  email = excluded.email,
  phone = excluded.phone,
  preferred_contact_method = excluded.preferred_contact_method,
  deleted_at = null;

insert into public.customer_vehicles (
  id,
  organisation_id,
  customer_id,
  registration,
  make,
  model,
  year,
  current_mileage,
  relationship
)
values
  ('41000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000001','40000000-0000-4000-8000-000000000001','AB18 CDE','Ford','Focus',2018,61200,'owned'),
  ('41000000-0000-4000-8000-000000000002','00000000-0000-4000-8000-000000000001','40000000-0000-4000-8000-000000000002','EF16 GHK','Volkswagen','Passat',2016,89400,'owned'),
  ('41000000-0000-4000-8000-000000000003','00000000-0000-4000-8000-000000000004','LM19 NOP','Vauxhall','Astra',2019,48750,'owned'),
  ('41000000-0000-4000-8000-000000000004','00000000-0000-4000-8000-000000000007','RS20 TUV','Toyota','Yaris',2020,35800,'owned')
on conflict (id) do update
set
  registration = excluded.registration,
  current_mileage = excluded.current_mileage,
  deleted_at = null;

insert into public.leads (
  id,
  organisation_id,
  customer_id,
  vehicle_id,
  lead_type,
  status,
  priority,
  title,
  message,
  source,
  preferred_contact_method,
  consent_status,
  consent_scope,
  consent_recorded_at,
  due_at,
  last_activity_at
)
values
  ('50000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000001','40000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001','vehicle_enquiry','qualified','high','Amelia Harris — BMW 320i','Would like to arrange a viewing and discuss her current car.','website','email',true,'marketing_granted',now() - interval '3 days',now() + interval '4 hours',now() - interval '3 hours'),
  ('50000000-0000-4000-8000-000000000002','00000000-0000-4000-8000-000000000001','40000000-0000-4000-8000-000000000002','20000000-0000-4000-8000-000000000003','test_drive','contacted','normal','Noah Wilson — Golf test drive','Available on Saturday morning.','telephone','phone',true,'transactional_only',now() - interval '2 days',now() + interval '1 day',now() - interval '8 hours'),
  ('50000000-0000-4000-8000-000000000003','00000000-0000-4000-8000-000000000005','40000000-0000-4000-8000-000000000005','20000000-0000-4000-8000-000000000007','callback_request','new','urgent','Isla Thompson — XC40 callback','Wants to know if the reserved vehicle becomes available.','website','email',true,'marketing_granted',now() - interval '5 hours',now() - interval '1 hour',now() - interval '5 hours'),
  ('50000000-0000-4000-8000-000000000004','00000000-0000-4000-8000-000000000001','40000000-0000-4000-8000-000000000006','20000000-0000-4000-8000-000000000004','part_exchange','negotiation','high','Arthur Davies — Puma part exchange','Has a 2017 Fiesta to value.','showroom','either',true,'transactional_only',now() - interval '6 days',now() + interval '6 hours',now() - interval '1 day'),
  ('50000000-0000-4000-8000-000000000005','00000000-0000-4000-8000-000000000001','40000000-0000-4000-8000-000000000008',null,'general_enquiry','contact_attempted','normal','Leo Robinson — general enquiry','Asked about weekend opening hours and appointments.','website','email',true,'transactional_only',now() - interval '1 day',now() + interval '2 days',now() - interval '12 hours')
on conflict (id) do update
set
  status = excluded.status,
  priority = excluded.priority,
  title = excluded.title,
  message = excluded.message,
  due_at = excluded.due_at,
  deleted_at = null;

insert into public.sourcing_requests (
  id,
  organisation_id,
  customer_id,
  status,
  priority,
  preferred_make,
  preferred_model,
  alternative_models,
  minimum_year,
  maximum_mileage,
  fuel_preference,
  transmission_preference,
  colour_preferences,
  required_features,
  budget,
  deposit_available,
  finance_required,
  part_exchange,
  desired_timescale,
  requirements,
  next_action_at
)
values
  ('60000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000001','40000000-0000-4000-8000-000000000003','search_active','high','Lexus','NX','Toyota RAV4 or Volvo XC60',2021,40000,'Petrol hybrid','Automatic','Dark blue, grey or black','Heated seats, adaptive cruise, rear camera',36000,5000,true,false,'Within six weeks','Prioritises comfort, reliability and a full service history.',now() + interval '1 day'),
  ('60000000-0000-4000-8000-000000000002','00000000-0000-4000-8000-000000000001','40000000-0000-4000-8000-000000000004','options_found','normal','Mazda','MX-5','Fiat 124 Spider',2018,45000,'Petrol','Manual','Red or dark grey','Heated seats preferred',19000,3000,false,true,'This summer','Must have strong provenance and no category history.',now() + interval '8 hours'),
  ('60000000-0000-4000-8000-000000000003','00000000-0000-4000-8000-000000000001','40000000-0000-4000-8000-000000000006','requirements_confirmed','normal','Volkswagen','Transporter','Ford Transit Custom',2019,75000,'Diesel','Automatic','Any neutral colour','Tailgate, air conditioning, five seats',33000,8000,false,false,'Within three months','Vehicle will be used for family travel and bikes.',now() + interval '3 days'),
  ('60000000-0000-4000-8000-000000000004','00000000-0000-4000-8000-000000000001','40000000-0000-4000-8000-000000000008','new','normal','Honda','Civic','Toyota Corolla',2020,50000,'Petrol','Automatic','Blue or silver','Adaptive cruise, Apple CarPlay',22000,2500,true,false,'No fixed deadline','Would like an initial call before search begins.',now() + interval '5 hours')
on conflict (id) do update
set
  status = excluded.status,
  priority = excluded.priority,
  requirements = excluded.requirements,
  next_action_at = excluded.next_action_at,
  deleted_at = null;

insert into public.leads (
  id,
  organisation_id,
  customer_id,
  sourcing_request_id,
  lead_type,
  status,
  priority,
  title,
  message,
  source,
  preferred_contact_method,
  consent_status,
  consent_scope,
  consent_recorded_at
)
values
  ('50000000-0000-4000-8000-000000000006','00000000-0000-4000-8000-000000000001','40000000-0000-4000-8000-000000000003','60000000-0000-4000-8000-000000000001','car_sourcing','qualified','high','Olivia Patel — Lexus NX search','Hybrid premium SUV with full history.','website','either',true,'transactional_only',now() - interval '2 months'),
  ('50000000-0000-4000-8000-000000000007','00000000-0000-4000-8000-000000000001','40000000-0000-4000-8000-000000000004','60000000-0000-4000-8000-000000000002','car_sourcing','contacted','normal','George Evans — Mazda MX-5 search','Manual sports car with clean provenance.','website','phone',true,'transactional_only',now() - interval '3 weeks'),
  ('50000000-0000-4000-8000-000000000008','00000000-0000-4000-8000-000000000001','40000000-0000-4000-8000-000000000006','60000000-0000-4000-8000-000000000003','car_sourcing','assigned','normal','Arthur Davies — Transporter search','Automatic five-seat van.','website','either',true,'transactional_only',now() - interval '8 days'),
  ('50000000-0000-4000-8000-000000000009','00000000-0000-4000-8000-000000000001','40000000-0000-4000-8000-000000000008','60000000-0000-4000-8000-000000000004','car_sourcing','new','normal','Leo Robinson — Honda Civic search','Automatic family hatchback.','website','email',true,'transactional_only',now() - interval '10 hours')
on conflict (id) do update
set
  status = excluded.status,
  title = excluded.title,
  sourcing_request_id = excluded.sourcing_request_id,
  deleted_at = null;

update public.sourcing_requests sr
set lead_id = mapping.lead_id
from (
  values
    ('60000000-0000-4000-8000-000000000001'::uuid,'50000000-0000-4000-8000-000000000006'::uuid),
    ('60000000-0000-4000-8000-000000000002'::uuid,'50000000-0000-4000-8000-000000000007'::uuid),
    ('60000000-0000-4000-8000-000000000003'::uuid,'50000000-0000-4000-8000-000000000008'::uuid),
    ('60000000-0000-4000-8000-000000000004'::uuid,'50000000-0000-4000-8000-000000000009'::uuid)
) mapping(request_id, lead_id)
where sr.id = mapping.request_id;

insert into public.sourcing_candidates (
  id,
  organisation_id,
  sourcing_request_id,
  supplier_name,
  source_url,
  registration,
  make,
  model,
  derivative,
  year,
  mileage,
  colour,
  expected_purchase_price,
  expected_preparation_cost,
  proposed_customer_price,
  inspection_status,
  customer_decision,
  notes
)
values
  ('61000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000001','60000000-0000-4000-8000-000000000001','Approved trade supplier',null,'NX21 ABC','Lexus','NX','300h Premium',2021,34800,'Graphite',30200,650,34950,'required','interested','Service history received; inspection to be arranged.'),
  ('61000000-0000-4000-8000-000000000002','00000000-0000-4000-8000-000000000001','60000000-0000-4000-8000-000000000002','Franchise part exchange',null,'MX19 DEF','Mazda','MX-5','2.0 Sport Nav+',2019,29100,'Soul Red',15800,480,18495,'passed','approved','Customer asked for a final walk-around video.')
on conflict (id) do update
set
  inspection_status = excluded.inspection_status,
  customer_decision = excluded.customer_decision,
  notes = excluded.notes,
  deleted_at = null;

insert into public.appointment_types (
  id,
  organisation_id,
  name,
  slug,
  description,
  category,
  duration_minutes,
  buffer_minutes,
  default_capacity,
  colour,
  is_public_bookable,
  active
)
values
  ('70000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000001','Repair discussion call','repair-call','A telephone call to discuss a fault and agree the appropriate next step.','repair_call',30,10,1,'#0F766E',true,true),
  ('70000000-0000-4000-8000-000000000002','00000000-0000-4000-8000-000000000001','Vehicle viewing','vehicle-viewing','A guided vehicle viewing with a member of the sales team.','viewing',45,15,1,'#2563EB',false,true),
  ('70000000-0000-4000-8000-000000000003','00000000-0000-4000-8000-000000000001','Test drive','test-drive','A pre-arranged test drive, subject to licence and eligibility checks.','test_drive',60,15,1,'#7C3AED',false,true)
on conflict (id) do update
set
  name = excluded.name,
  description = excluded.description,
  duration_minutes = excluded.duration_minutes,
  buffer_minutes = excluded.buffer_minutes,
  is_public_bookable = excluded.is_public_bookable,
  active = true;

insert into public.availability_rules (
  id,
  organisation_id,
  appointment_type_id,
  weekday,
  start_time_local,
  end_time_local,
  slot_duration_minutes,
  buffer_minutes,
  minimum_notice_minutes,
  maximum_advance_days,
  maximum_simultaneous,
  timezone,
  appointment_type,
  active
)
values
  ('71000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000001','70000000-0000-4000-8000-000000000001',1,'09:00','17:00',30,10,1440,45,1,'Europe/London','repair_call',true),
  ('71000000-0000-4000-8000-000000000002','00000000-0000-4000-8000-000000000001','70000000-0000-4000-8000-000000000001',2,'09:00','17:00',30,10,1440,45,1,'Europe/London','repair_call',true),
  ('71000000-0000-4000-8000-000000000003','00000000-0000-4000-8000-000000000001','70000000-0000-4000-8000-000000000001',3,'09:00','17:00',30,10,1440,45,1,'Europe/London','repair_call',true),
  ('71000000-0000-4000-8000-000000000004','00000000-0000-4000-8000-000000000001','70000000-0000-4000-8000-000000000001',4,'09:00','17:00',30,10,1440,45,1,'Europe/London','repair_call',true),
  ('71000000-0000-4000-8000-000000000005','00000000-0000-4000-8000-000000000001','70000000-0000-4000-8000-000000000001',5,'09:00','16:00',30,10,1440,45,1,'Europe/London','repair_call',true)
on conflict (id) do update
set
  start_time_local = excluded.start_time_local,
  end_time_local = excluded.end_time_local,
  slot_duration_minutes = excluded.slot_duration_minutes,
  buffer_minutes = excluded.buffer_minutes,
  minimum_notice_minutes = excluded.minimum_notice_minutes,
  maximum_advance_days = excluded.maximum_advance_days,
  maximum_simultaneous = excluded.maximum_simultaneous,
  active = true;

insert into public.availability_exceptions (
  id,
  organisation_id,
  appointment_type_id,
  exception_date,
  exception_type,
  reason
)
values (
  '72000000-0000-4000-8000-000000000001',
  '00000000-0000-4000-8000-000000000001',
  '70000000-0000-4000-8000-000000000001',
  current_date + 21,
  'closed',
  'Team training day'
)
on conflict (id) do update
set
  exception_date = excluded.exception_date,
  exception_type = excluded.exception_type,
  reason = excluded.reason;

insert into public.appointments (
  id,
  organisation_id,
  appointment_type_id,
  customer_id,
  customer_vehicle_id,
  starts_at,
  ends_at,
  booking_resource,
  status,
  reason_for_call,
  registration,
  vehicle_make_model,
  fault_description,
  warning_lights,
  is_driveable,
  preferred_contact_method
)
values
  ('80000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000001','70000000-0000-4000-8000-000000000001','40000000-0000-4000-8000-000000000001','41000000-0000-4000-8000-000000000001',(current_date + time '10:00' + interval '1 day') at time zone 'Europe/London',(current_date + time '10:30' + interval '1 day') at time zone 'Europe/London',1,'confirmed','Brake vibration','AB18CDE','Ford Focus','Steering wheel vibration under braking from motorway speeds.','None',true,'email'),
  ('80000000-0000-4000-8000-000000000002','00000000-0000-4000-8000-000000000001','70000000-0000-4000-8000-000000000001','40000000-0000-4000-8000-000000000002','41000000-0000-4000-8000-000000000002',(current_date + time '11:20' + interval '1 day') at time zone 'Europe/London',(current_date + time '11:50' + interval '1 day') at time zone 'Europe/London',1,'requested','Engine warning light','EF16GHK','Volkswagen Passat','Amber engine warning light appeared after a long journey.','Amber engine light',true,'phone'),
  ('80000000-0000-4000-8000-000000000003','00000000-0000-4000-8000-000000000001','70000000-0000-4000-8000-000000000001','40000000-0000-4000-8000-000000000007','41000000-0000-4000-8000-000000000004',(current_date + time '14:00' + interval '2 days') at time zone 'Europe/London',(current_date + time '14:30' + interval '2 days') at time zone 'Europe/London',1,'confirmed','Annual service','RS20TUV','Toyota Yaris','Would like to discuss annual service requirements and MOT timing.','None',true,'sms'),
  ('80000000-0000-4000-8000-000000000004','00000000-0000-4000-8000-000000000001','70000000-0000-4000-8000-000000000001','40000000-0000-4000-8000-000000000004','41000000-0000-4000-8000-000000000003',(current_date + time '15:20' - interval '2 days') at time zone 'Europe/London',(current_date + time '15:50' - interval '2 days') at time zone 'Europe/London',1,'call_completed','Air conditioning fault','LM19NOP','Vauxhall Astra','Air conditioning blows warm air.','None',true,'phone')
on conflict (id) do update
set
  starts_at = excluded.starts_at,
  ends_at = excluded.ends_at,
  status = excluded.status,
  fault_description = excluded.fault_description,
  deleted_at = null;

insert into public.repair_services (
  id,
  organisation_id,
  name,
  slug,
  short_description,
  full_description,
  icon_name,
  display_order,
  indicative_price_from,
  is_public,
  active
)
values
  ('90000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000001','Diagnostics','diagnostics','Structured fault-finding for warning lights and drivability concerns.','We combine an initial conversation, diagnostic equipment and technician-led testing before recommending work.','scan-line',10,72,true,true),
  ('90000000-0000-4000-8000-000000000002','00000000-0000-4000-8000-000000000001','Servicing','servicing','Routine servicing tailored to the vehicle and its service schedule.','Oil, filters and scheduled inspection items are agreed before work starts.','wrench',20,189,true,true),
  ('90000000-0000-4000-8000-000000000003','00000000-0000-4000-8000-000000000001','MOT preparation','mot-preparation','Pre-MOT inspections and sensible remedial advice.','We identify likely MOT concerns and explain priorities without promising a test result.','clipboard-check',30,49,true,true),
  ('90000000-0000-4000-8000-000000000004','00000000-0000-4000-8000-000000000001','Brakes','brakes','Inspection and replacement of brake pads, discs and related components.','Brake concerns are inspected before parts are authorised and an estimate is supplied.','disc-3',40,95,true,true),
  ('90000000-0000-4000-8000-000000000005','00000000-0000-4000-8000-000000000001','Tyres','tyres','Tyre inspection, replacement and pressure-system support.','We assess tread, wear patterns, damage and suitable replacement options.','circle-dot',50,69,true,true),
  ('90000000-0000-4000-8000-000000000006','00000000-0000-4000-8000-000000000001','Batteries','batteries','Battery testing and suitable replacement where required.','Charging-system checks help avoid replacing a battery before the cause is understood.','battery-charging',60,109,true,true),
  ('90000000-0000-4000-8000-000000000007','00000000-0000-4000-8000-000000000001','Electrical faults','electrical-faults','Methodical investigation of intermittent and persistent electrical faults.','We record symptoms, test affected circuits and provide the next diagnostic step.','zap',70,84,true,true),
  ('90000000-0000-4000-8000-000000000008','00000000-0000-4000-8000-000000000001','Vehicle inspections','vehicle-inspections','Independent pre-purchase and general condition inspections.','A structured visual and functional inspection with clear, evidence-based observations.','search-check',80,149,true,true)
on conflict (id) do update
set
  name = excluded.name,
  short_description = excluded.short_description,
  full_description = excluded.full_description,
  indicative_price_from = excluded.indicative_price_from,
  is_public = true,
  active = true;

insert into public.repair_jobs (
  id,
  organisation_id,
  appointment_id,
  customer_id,
  customer_vehicle_id,
  status,
  registration,
  vehicle_make_model,
  mileage,
  reported_fault,
  diagnosis,
  labour_rate,
  vat_rate,
  estimate_net,
  estimate_vat,
  estimate_total,
  approval_status,
  technician_notes,
  customer_facing_notes,
  start_date,
  due_date,
  payment_status
)
values
  ('a0000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000001','80000000-0000-4000-8000-000000000004','40000000-0000-4000-8000-000000000004','41000000-0000-4000-8000-000000000003','diagnosing','LM19NOP','Vauxhall Astra',48750,'Air conditioning blows warm air.','Initial pressure test indicates a likely leak; UV inspection in progress.',78,20,96,19.20,115.20,'not_requested','Recover refrigerant and inspect condenser and service ports.','Initial diagnostic checks are under way.',current_date - 1,current_date + 1,'not_invoiced'),
  ('a0000000-0000-4000-8000-000000000002','00000000-0000-4000-8000-000000000001',null,'40000000-0000-4000-8000-000000000001','41000000-0000-4000-8000-000000000001','awaiting_customer_approval','AB18CDE','Ford Focus',61200,'Brake vibration at motorway speed.','Front discs show heat spotting; front pads are below recommended thickness.',78,20,298,59.60,357.60,'requested','Estimate prepared for front discs and pads.','We have sent an estimate for front brake discs and pads.',current_date - 2,current_date + 1,'not_invoiced'),
  ('a0000000-0000-4000-8000-000000000003','00000000-0000-4000-8000-000000000001',null,'40000000-0000-4000-8000-000000000007','41000000-0000-4000-8000-000000000004','work_in_progress','RS20TUV','Toyota Yaris',35800,'Annual service and intermittent tyre-pressure warning.','Service due; one rear tyre valve is leaking slowly.',78,20,245,49,294,'approved','Service in progress. Replacement valve authorised.','Routine service and valve replacement are in progress.',current_date,current_date + 1,'not_invoiced')
on conflict (id) do update
set
  status = excluded.status,
  diagnosis = excluded.diagnosis,
  estimate_total = excluded.estimate_total,
  approval_status = excluded.approval_status,
  technician_notes = excluded.technician_notes,
  deleted_at = null;

insert into public.repair_job_items (
  id,
  organisation_id,
  repair_job_id,
  item_type,
  description,
  quantity,
  unit_cost,
  unit_price,
  vat_rate,
  status,
  customer_approved,
  sort_order
)
values
  ('a1000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000001','a0000000-0000-4000-8000-000000000001','inspection','Air-conditioning diagnostic inspection',1,0,96,20,'in_progress',null,0),
  ('a1000000-0000-4000-8000-000000000002','00000000-0000-4000-8000-000000000001','a0000000-0000-4000-8000-000000000002','part','Front brake disc set',1,104,168,20,'planned',false,0),
  ('a1000000-0000-4000-8000-000000000003','00000000-0000-4000-8000-000000000001','a0000000-0000-4000-8000-000000000002','part','Front brake pad set',1,42,78,20,'planned',false,1),
  ('a1000000-0000-4000-8000-000000000004','00000000-0000-4000-8000-000000000001','a0000000-0000-4000-8000-000000000002','labour','Fit front brake discs and pads',0.67,0,52,20,'planned',false,2),
  ('a1000000-0000-4000-8000-000000000005','00000000-0000-4000-8000-000000000001','a0000000-0000-4000-8000-000000000003','labour','Scheduled service labour',1.5,0,117,20,'in_progress',true,0),
  ('a1000000-0000-4000-8000-000000000006','00000000-0000-4000-8000-000000000001','a0000000-0000-4000-8000-000000000003','part','Service filter and oil kit',1,58,108,20,'received',true,1),
  ('a1000000-0000-4000-8000-000000000007','00000000-0000-4000-8000-000000000001','a0000000-0000-4000-8000-000000000003','part','Tyre-pressure valve',1,11,20,20,'received',true,2)
on conflict (id) do update
set
  status = excluded.status,
  customer_approved = excluded.customer_approved,
  deleted_at = null;

insert into public.sales (
  id,
  organisation_id,
  vehicle_id,
  customer_id,
  status,
  sale_price,
  deposit,
  part_exchange_allowance,
  discount,
  warranty,
  payment_method,
  sale_date,
  handover_date,
  gross_profit,
  completion_checklist,
  completed_at
)
values
  ('b0000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000011','40000000-0000-4000-8000-000000000005','completed',14600,500,0,395,'Six months','Bank transfer',current_date - 6,current_date - 3,2065,'[{"item":"ID checked","complete":true},{"item":"Handover pack supplied","complete":true}]',now() - interval '3 days'),
  ('b0000000-0000-4000-8000-000000000002','00000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000012','40000000-0000-4000-8000-000000000002','completed',20450,750,2100,545,'Six months','Bank transfer',current_date - 17,current_date - 14,2440,'[{"item":"ID checked","complete":true},{"item":"Handover pack supplied","complete":true}]',now() - interval '14 days')
on conflict (id) do update
set
  status = excluded.status,
  sale_price = excluded.sale_price,
  handover_date = excluded.handover_date,
  gross_profit = excluded.gross_profit,
  deleted_at = null;

insert into public.tasks (
  id,
  organisation_id,
  title,
  description,
  status,
  priority,
  due_at,
  reminder_at,
  customer_id,
  vehicle_id,
  lead_id,
  sourcing_request_id,
  repair_job_id
)
values
  ('c0000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000001','Call Isla about the reserved XC40','Offer to keep her informed if the reservation changes.','open','urgent',now() - interval '1 hour',now() - interval '2 hours','40000000-0000-4000-8000-000000000005','20000000-0000-4000-8000-000000000007','50000000-0000-4000-8000-000000000003',null,null),
  ('c0000000-0000-4000-8000-000000000002','00000000-0000-4000-8000-000000000001','Send BMW viewing confirmation','Include directions and documents to bring.','open','high',now() + interval '4 hours',now() + interval '3 hours','40000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001','50000000-0000-4000-8000-000000000001',null,null),
  ('c0000000-0000-4000-8000-000000000003','00000000-0000-4000-8000-000000000001','Arrange Lexus candidate inspection','Confirm inspection availability with approved supplier.','in_progress','high',now() + interval '1 day',now() + interval '18 hours','40000000-0000-4000-8000-000000000003',null,null,'60000000-0000-4000-8000-000000000001',null),
  ('c0000000-0000-4000-8000-000000000004','00000000-0000-4000-8000-000000000001','Chase brake estimate approval','Customer received the estimate yesterday.','open','normal',now() + interval '5 hours',now() + interval '4 hours','40000000-0000-4000-8000-000000000001',null,null,null,'a0000000-0000-4000-8000-000000000002'),
  ('c0000000-0000-4000-8000-000000000005','00000000-0000-4000-8000-000000000001','Photograph MINI Cooper','Capture exterior, interior, wheels and service history.','open','normal',now() + interval '2 days',now() + interval '1 day',null,'20000000-0000-4000-8000-000000000009',null,null,null),
  ('c0000000-0000-4000-8000-000000000006','00000000-0000-4000-8000-000000000001','Review Qashqai preparation checklist','Confirm tyres, service and cosmetic work.','in_progress','normal',now() + interval '1 day',null,null,'20000000-0000-4000-8000-000000000008',null,null,null),
  ('c0000000-0000-4000-8000-000000000007','00000000-0000-4000-8000-000000000001','Follow up Golf test drive','Confirm Saturday time with Noah.','open','high',now() + interval '1 day',now() + interval '20 hours','40000000-0000-4000-8000-000000000002','20000000-0000-4000-8000-000000000003','50000000-0000-4000-8000-000000000002',null,null),
  ('c0000000-0000-4000-8000-000000000008','00000000-0000-4000-8000-000000000001','Reconcile June vehicle costs','Check transport and warranty invoices.','completed','low',now() - interval '2 days',null,null,null,null,null,null)
on conflict (id) do update
set
  title = excluded.title,
  status = excluded.status,
  priority = excluded.priority,
  due_at = excluded.due_at,
  deleted_at = null;

insert into public.lead_activities (
  id,
  organisation_id,
  lead_id,
  activity_type,
  direction,
  summary,
  body,
  occurred_at
)
values
  ('51000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000001','50000000-0000-4000-8000-000000000001','phone_call','outbound','Viewing requirements discussed','Customer would like a quiet weekday appointment.',now() - interval '3 hours'),
  ('51000000-0000-4000-8000-000000000002','00000000-0000-4000-8000-000000000001','50000000-0000-4000-8000-000000000002','email','outbound','Test-drive availability sent','Saturday morning options supplied.',now() - interval '8 hours'),
  ('51000000-0000-4000-8000-000000000003','00000000-0000-4000-8000-000000000001','50000000-0000-4000-8000-000000000006','note','internal','Search criteria confirmed','Customer approved the Lexus candidate profile.',now() - interval '1 day')
on conflict (id) do update
set
  summary = excluded.summary,
  body = excluded.body,
  occurred_at = excluded.occurred_at;

insert into public.website_pages (
  id,
  organisation_id,
  page_type,
  slug,
  title,
  status,
  content,
  seo_title,
  seo_description,
  requires_legal_review,
  published_at
)
values
  ('d0000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000001','homepage','home','Home','published','{"hero":{"headline":"Better cars. Clearer advice. Proper aftercare.","primaryCta":"Browse our cars","secondaryCta":"Source a car"}}','Used cars, vehicle sourcing and repairs','Carefully selected used cars, personal sourcing and trusted repair support.',false,now() - interval '60 days'),
  ('d0000000-0000-4000-8000-000000000002','00000000-0000-4000-8000-000000000001','about','about','About us','published','{"intro":"Independent advice, careful preparation and long-term customer relationships.","values":["Straight answers","Thoughtful preparation","Useful aftercare"]}','About our dealership','Meet the team and learn how we select, prepare and support every vehicle.',false,now() - interval '60 days'),
  ('d0000000-0000-4000-8000-000000000003','00000000-0000-4000-8000-000000000001','privacy','privacy','Privacy policy','draft','{"notice":"This draft requires professional legal review before publication."}','Privacy policy','How customer information is handled.','true',null),
  ('d0000000-0000-4000-8000-000000000004','00000000-0000-4000-8000-000000000001','terms','terms','Terms of use','draft','{"notice":"This draft requires professional legal review before publication."}','Website terms','Terms governing use of this website.','true',null)
on conflict (id) do update
set
  title = excluded.title,
  status = excluded.status,
  content = excluded.content,
  seo_title = excluded.seo_title,
  seo_description = excluded.seo_description,
  requires_legal_review = excluded.requires_legal_review,
  published_at = excluded.published_at,
  deleted_at = null;

insert into public.integration_settings (
  id,
  organisation_id,
  provider,
  status,
  public_configuration,
  last_error_code,
  last_error_message
)
values
  ('e0000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000001','vehicle_lookup','not_configured','{"provider":"mock","manual_fallback":true}',null,null),
  ('e0000000-0000-4000-8000-000000000002','00000000-0000-4000-8000-000000000001','autotrader','not_configured','{"advertiser_id":null,"manual_stock_supported":true}',null,null),
  ('e0000000-0000-4000-8000-000000000003','00000000-0000-4000-8000-000000000001','email','not_configured','{"provider":"console"}',null,null),
  ('e0000000-0000-4000-8000-000000000004','00000000-0000-4000-8000-000000000001','sms','disabled','{"provider":"disabled"}',null,null)
on conflict (id) do update
set
  status = excluded.status,
  public_configuration = excluded.public_configuration;

insert into public.notifications (
  id,
  organisation_id,
  recipient_user_id,
  notification_type,
  title,
  body,
  action_url,
  entity_type,
  entity_id,
  created_at
)
values
  ('f0000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000001',null,'new_lead','New high-priority callback','Isla would like an update on the reserved XC40.','/admin/leads','lead','50000000-0000-4000-8000-000000000003',now() - interval '5 hours'),
  ('f0000000-0000-4000-8000-000000000002','00000000-0000-4000-8000-000000000001',null,'repair_awaiting_approval','Repair estimate awaiting approval','The Ford Focus brake estimate is ready for customer approval.','/admin/repairs','repair_job','a0000000-0000-4000-8000-000000000002',now() - interval '1 day'),
  ('f0000000-0000-4000-8000-000000000003','00000000-0000-4000-8000-000000000001',null,'task_overdue','Overdue task','The XC40 callback task is overdue.','/admin/tasks','task','c0000000-0000-4000-8000-000000000001',now() - interval '1 hour')
on conflict (id) do update
set
  title = excluded.title,
  body = excluded.body,
  created_at = excluded.created_at;

commit;
