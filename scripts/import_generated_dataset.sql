-- MySQL 8+ SQL import script for generated ticket dataset
-- File: scripts/import_generated_dataset.sql
--
-- Important:
-- 1) SQL engines do not natively read multi-sheet .xlsx files in pure SQL.
-- 2) Export/prepare one combined CSV from the workbook first (ticket rows only, no DAY TOTAL rows).
-- 3) Then run this script to load + insert into your core tables.
--
-- Expected CSV columns (same order):
-- Date,Route,Bus Number,Ticket Number,Trip Ref,Transaction DateTime,Start Stop,End Stop,
-- Start Section,End Section,Travelled Sections,Fare (LKR),Tickets Sold,Revenue (LKR),
-- Payment Method,Status,Currency

START TRANSACTION;

-- 1) Staging table (raw import from CSV)
DROP TABLE IF EXISTS staging_generated_tickets;
CREATE TABLE staging_generated_tickets (
  service_date VARCHAR(20),
  route_number VARCHAR(30),
  bus_number VARCHAR(50),
  ticket_number VARCHAR(20),
  trip_ref VARCHAR(60),
  transaction_datetime VARCHAR(30),
  start_stop VARCHAR(255),
  end_stop VARCHAR(255),
  start_section INT,
  end_section INT,
  travelled_sections INT,
  fare_lkr DECIMAL(10,2),
  tickets_sold INT,
  revenue_lkr NUMERIC(10,2),
  payment_method TEXT,
  tx_status TEXT,
  currency TEXT
);

-- 2) Load data from CSV into staging
-- Update the path to your exported CSV file.
-- Use forward slashes or escaped backslashes on Windows.
-- Example: C:/FYP-Bus-Revenue-Management-/datasets/bus_revenue_2025_flat.csv
LOAD DATA LOCAL INFILE 'C:/FYP-Bus-Revenue-Management-/datasets/bus_revenue_2025_flat.csv'
INTO TABLE staging_generated_tickets
FIELDS TERMINATED BY ','
OPTIONALLY ENCLOSED BY '"'
LINES TERMINATED BY '\n'
IGNORE 1 LINES
(
  service_date,
  route_number,
  bus_number,
  ticket_number,
  trip_ref,
  transaction_datetime,
  start_stop,
  end_stop,
  start_section,
  end_section,
  travelled_sections,
  fare_lkr,
  tickets_sold,
  revenue_lkr,
  payment_method,
  tx_status,
  currency
);

-- 3) Cleanup: keep only real ticket rows
DELETE FROM staging_generated_tickets
WHERE ticket_number IS NULL
   OR TRIM(ticket_number) = ''
   OR UPPER(TRIM(trip_ref)) = 'DAY TOTAL';

-- 4) Resolve one route id (matching your dataset route number like 138/2)
-- If multiple route IDs exist for same route_number, latest ID is used.
SET @route_id := (
  SELECT id
  FROM routes
  WHERE LOWER(route_number) = LOWER((SELECT route_number FROM staging_generated_tickets LIMIT 1))
  ORDER BY created_at DESC
  LIMIT 1
);

-- 5) Resolve one default user for imported rows
SET @default_user_id := (
  SELECT id
  FROM users
  ORDER BY created_at ASC
  LIMIT 1
);

-- Safety checks
-- If these return NULL, fix route/users first before proceeding.
SELECT @route_id AS resolved_route_id, @default_user_id AS resolved_user_id;

-- 6) Insert tickets (one row = one ticket; Tickets Sold is expected to be 1)
-- Uses LEFT JOIN to avoid duplicates if re-run.
INSERT INTO tickets (
  ticket_number,
  user_id,
  route_id,
  bus_number,
  departure_date,
  departure_time,
  from_stop_id,
  to_stop_id,
  purchase_date,
  amount,
  status,
  valid_until,
  created_at
)
SELECT
  s.ticket_number,
  @default_user_id,
  @route_id,
  s.bus_number,
  STR_TO_DATE(s.service_date, '%Y-%m-%d') AS departure_date,
  TIME(STR_TO_DATE(s.transaction_datetime, '%Y-%m-%d %H:%i:%s')) AS departure_time,
  (
    SELECT st.id
    FROM stops st
    WHERE st.route_id = @route_id
      AND (
        LOWER(TRIM(st.stop_name)) = LOWER(TRIM(s.start_stop))
        OR LOWER(TRIM(SUBSTRING_INDEX(st.stop_name, ' - ', -1))) = LOWER(TRIM(s.start_stop))
      )
    ORDER BY st.sequence_order ASC
    LIMIT 1
  ) AS from_stop_id,
  (
    SELECT st.id
    FROM stops st
    WHERE st.route_id = @route_id
      AND (
        LOWER(TRIM(st.stop_name)) = LOWER(TRIM(s.end_stop))
        OR LOWER(TRIM(SUBSTRING_INDEX(st.stop_name, ' - ', -1))) = LOWER(TRIM(s.end_stop))
      )
    ORDER BY st.sequence_order ASC
    LIMIT 1
  ) AS to_stop_id,
  STR_TO_DATE(s.transaction_datetime, '%Y-%m-%d %H:%i:%s') AS purchase_date,
  s.fare_lkr,
  'active' AS status,
  DATE_ADD(STR_TO_DATE(s.transaction_datetime, '%Y-%m-%d %H:%i:%s'), INTERVAL 2 HOUR) AS valid_until,
  STR_TO_DATE(s.transaction_datetime, '%Y-%m-%d %H:%i:%s') AS created_at
FROM staging_generated_tickets s
LEFT JOIN tickets t ON t.ticket_number = s.ticket_number
WHERE t.ticket_number IS NULL
  AND COALESCE(s.tickets_sold, 0) = 1;

-- 7) Insert transactions (skip existing by ticket_id)
INSERT INTO transactions (
  user_id,
  ticket_id,
  amount,
  transaction_date,
  payment_method,
  status,
  currency,
  created_at
)
SELECT
  @default_user_id,
  s.ticket_number,
  s.revenue_lkr,
  STR_TO_DATE(s.transaction_datetime, '%Y-%m-%d %H:%i:%s') AS transaction_date,
  COALESCE(NULLIF(TRIM(s.payment_method), ''), 'cash') AS payment_method,
  COALESCE(NULLIF(TRIM(s.tx_status), ''), 'completed') AS status,
  COALESCE(NULLIF(TRIM(s.currency), ''), 'LKR') AS currency,
  STR_TO_DATE(s.transaction_datetime, '%Y-%m-%d %H:%i:%s') AS created_at
FROM staging_generated_tickets s
LEFT JOIN transactions tr ON tr.ticket_id = s.ticket_number
WHERE tr.ticket_id IS NULL
  AND COALESCE(s.tickets_sold, 0) = 1;

-- 8) Optional QA checks
SELECT COUNT(*) AS staging_rows FROM staging_generated_tickets;
SELECT COUNT(*) AS imported_tickets FROM tickets WHERE route_id = @route_id;
SELECT COUNT(*) AS imported_transactions FROM transactions WHERE ticket_id IN (
  SELECT ticket_number FROM staging_generated_tickets
);

COMMIT;

-- Optional cleanup after import validation
-- DROP TABLE staging_generated_tickets;
