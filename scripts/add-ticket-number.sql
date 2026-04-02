-- Migration: replace tickets.id primary key with tickets.ticket_number
-- and switch transactions.ticket_id reference to ticket_number.

ALTER TABLE tickets
ADD COLUMN IF NOT EXISTS ticket_number VARCHAR(9);

WITH numbered AS (
	SELECT id, ROW_NUMBER() OVER (ORDER BY created_at, id) AS rn
	FROM tickets
	WHERE ticket_number IS NULL
)
UPDATE tickets t
SET ticket_number = 'TKT-' || LPAD((numbered.rn % 100000)::text, 5, '0')
FROM numbered
WHERE t.id = numbered.id;

DO $$
BEGIN
	IF EXISTS (SELECT 1 FROM tickets WHERE ticket_number IS NULL) THEN
		RAISE EXCEPTION 'tickets.ticket_number contains NULL values';
	END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS idx_tickets_ticket_number_unique
ON tickets(ticket_number);

DO $$
BEGIN
	IF NOT EXISTS (
		SELECT 1
		FROM pg_constraint
		WHERE conname = 'tickets_ticket_number_key'
			AND conrelid = 'tickets'::regclass
	) THEN
		ALTER TABLE tickets
		ADD CONSTRAINT tickets_ticket_number_key UNIQUE (ticket_number);
	END IF;
END $$;

ALTER TABLE tickets
ALTER COLUMN ticket_number SET NOT NULL;

ALTER TABLE transactions
ADD COLUMN IF NOT EXISTS ticket_number_ref VARCHAR(9);

UPDATE transactions tr
SET ticket_number_ref = t.ticket_number
FROM tickets t
WHERE tr.ticket_id::text = t.id::text
	AND tr.ticket_id IS NOT NULL
	AND tr.ticket_number_ref IS NULL;

ALTER TABLE transactions
DROP CONSTRAINT IF EXISTS transactions_ticket_id_fkey;

ALTER TABLE transactions
DROP COLUMN IF EXISTS ticket_id;

ALTER TABLE transactions
RENAME COLUMN ticket_number_ref TO ticket_id;

ALTER TABLE transactions
ADD CONSTRAINT transactions_ticket_id_fkey
FOREIGN KEY (ticket_id) REFERENCES tickets(ticket_number) ON DELETE SET NULL;

ALTER TABLE tickets
DROP CONSTRAINT IF EXISTS tickets_pkey;

ALTER TABLE tickets
ADD CONSTRAINT tickets_pkey PRIMARY KEY (ticket_number);

ALTER TABLE tickets
DROP COLUMN IF EXISTS id;
