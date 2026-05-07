-- Add availability flag for buses (defaults to available).

ALTER TABLE buses
  ADD COLUMN IF NOT EXISTS availability VARCHAR(20) NOT NULL DEFAULT 'available';

UPDATE buses
SET availability = 'available'
WHERE availability IS NULL;
