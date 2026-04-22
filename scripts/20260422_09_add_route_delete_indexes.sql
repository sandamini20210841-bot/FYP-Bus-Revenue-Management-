-- Speed up route deletion and related FK maintenance operations.
-- These indexes help PostgreSQL find dependent rows quickly when:
-- 1) Deleting routes cascades to stops
-- 2) Deleting stops triggers ON DELETE SET NULL on tickets.from_stop_id/to_stop_id
-- 3) Fallback ticket deletes trigger ON DELETE SET NULL on transactions.ticket_id

CREATE INDEX IF NOT EXISTS idx_stops_route_id ON stops(route_id);
CREATE INDEX IF NOT EXISTS idx_tickets_from_stop_id ON tickets(from_stop_id);
CREATE INDEX IF NOT EXISTS idx_tickets_to_stop_id ON tickets(to_stop_id);
CREATE INDEX IF NOT EXISTS idx_transactions_ticket_id ON transactions(ticket_id);
