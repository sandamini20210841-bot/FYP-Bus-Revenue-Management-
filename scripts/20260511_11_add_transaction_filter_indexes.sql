-- Adds indexes to speed up common filtering in /api/v1/transactions
-- Safe to run multiple times.

CREATE INDEX IF NOT EXISTS idx_tickets_bus_number ON tickets(bus_number);
CREATE INDEX IF NOT EXISTS idx_routes_bus_number ON routes(bus_number);
CREATE INDEX IF NOT EXISTS idx_routes_route_number ON routes(route_number);
