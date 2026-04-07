BEGIN;

CREATE TABLE IF NOT EXISTS timetable_setups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  route_id UUID NOT NULL UNIQUE REFERENCES routes(id) ON DELETE CASCADE,
  total_turns INT NOT NULL CHECK (total_turns > 0 AND total_turns <= 200),
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS timetable_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  route_id UUID NOT NULL REFERENCES routes(id) ON DELETE CASCADE,
  service_date DATE NOT NULL,
  turn_number INT NOT NULL CHECK (turn_number > 0),
  bus_number VARCHAR(50) NOT NULL,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (route_id, service_date, turn_number)
);

CREATE INDEX IF NOT EXISTS idx_timetable_entries_route_date ON timetable_entries(route_id, service_date);

COMMIT;
