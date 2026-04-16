-- Fix inconsistent tickets.route_id constraint.
-- route_id must be nullable if FK uses ON DELETE SET NULL.
ALTER TABLE tickets
  ALTER COLUMN route_id DROP NOT NULL;
