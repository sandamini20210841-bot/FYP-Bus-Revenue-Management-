BEGIN;

-- Add departure-related ticket columns (safe on existing DBs).
ALTER TABLE tickets
    ADD COLUMN IF NOT EXISTS bus_number VARCHAR(50),
    ADD COLUMN IF NOT EXISTS departure_date DATE,
    ADD COLUMN IF NOT EXISTS departure_time TIME;

COMMIT;
