-- Migration: Add CHECK constraint on cars.category and cars_rent.category
--
-- Using CHECK constraint over ENUM so values can be added/renamed in future
-- migrations without needing to drop and recreate a type.
--
-- Canonical category list (compiled from DB data + app UI):
--   SUV         - 895 in cars, 31 in cars_rent
--   Sedan       - 310 in cars, 20 in cars_rent
--   Hatchback   - 108 in cars,  1 in cars_rent
--   Coupe       -  93 in cars,  1 in cars_rent
--   Convertible -  56 in cars,  0 in cars_rent
--   Sports      -  20 in cars,  0 in cars_rent
--   Wagon       -  11 in cars,  0 in cars_rent  (DB only, missing from app UI)
--   Truck       -   8 in cars,  0 in cars_rent
--   Pickup      -   0 in cars,  0 in cars_rent  (app UI only, distinct from Truck)
--   Classic     -   1 in cars,  0 in cars_rent
--   Motorcycle  -   0 in cars,  0 in cars_rent  (app UI only, no current listings)

-- Drop constraints if they already exist (idempotent)
ALTER TABLE cars       DROP CONSTRAINT IF EXISTS cars_category_valid;
ALTER TABLE cars_rent  DROP CONSTRAINT IF EXISTS cars_rent_category_valid;

-- Add CHECK constraints
ALTER TABLE cars
  ADD CONSTRAINT cars_category_valid
  CHECK (category IN (
    'SUV', 'Sedan', 'Hatchback', 'Coupe', 'Convertible',
    'Sports', 'Wagon', 'Truck', 'Pickup', 'Classic', 'Motorcycle'
  ));

ALTER TABLE cars_rent
  ADD CONSTRAINT cars_rent_category_valid
  CHECK (category IN (
    'SUV', 'Sedan', 'Hatchback', 'Coupe', 'Convertible',
    'Sports', 'Wagon', 'Truck', 'Pickup', 'Classic', 'Motorcycle'
  ));
