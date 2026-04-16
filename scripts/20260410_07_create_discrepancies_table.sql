CREATE TABLE IF NOT EXISTS discrepancies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    route_id UUID REFERENCES routes(id) ON DELETE SET NULL,
    bus_number VARCHAR(50) NOT NULL DEFAULT '',
    transaction_date DATE NOT NULL,
    expected_revenue NUMERIC(12,2) NOT NULL DEFAULT 0,
    actual_revenue NUMERIC(12,2) NOT NULL DEFAULT 0,
    loss_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
    status VARCHAR(20) NOT NULL DEFAULT 'pending',
    severity VARCHAR(20) NOT NULL DEFAULT 'medium',
    expected_daily_revenue NUMERIC(12,2) NOT NULL DEFAULT 0,
    expected_weekly_revenue NUMERIC(12,2) NOT NULL DEFAULT 0,
    expected_monthly_revenue NUMERIC(12,2) NOT NULL DEFAULT 0,
    actual_weekly_revenue NUMERIC(12,2) NOT NULL DEFAULT 0,
    actual_monthly_revenue NUMERIC(12,2) NOT NULL DEFAULT 0,
    anomaly_score NUMERIC(12,4) NOT NULL DEFAULT 0,
    detection_method VARCHAR(100) NOT NULL DEFAULT 'timeseries_residual_v1',
    detection_run_at TIMESTAMP,
    is_system_generated BOOLEAN NOT NULL DEFAULT true,
    notes TEXT NOT NULL DEFAULT '',
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT discrepancies_status_check CHECK (status IN ('pending', 'investigating', 'escalated', 'resolved')),
    CONSTRAINT discrepancies_severity_check CHECK (severity IN ('low', 'medium', 'high', 'critical'))
);

ALTER TABLE discrepancies ADD COLUMN IF NOT EXISTS severity VARCHAR(20) NOT NULL DEFAULT 'medium';
ALTER TABLE discrepancies ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE discrepancies ADD COLUMN IF NOT EXISTS expected_daily_revenue NUMERIC(12,2) NOT NULL DEFAULT 0;
ALTER TABLE discrepancies ADD COLUMN IF NOT EXISTS expected_weekly_revenue NUMERIC(12,2) NOT NULL DEFAULT 0;
ALTER TABLE discrepancies ADD COLUMN IF NOT EXISTS expected_monthly_revenue NUMERIC(12,2) NOT NULL DEFAULT 0;
ALTER TABLE discrepancies ADD COLUMN IF NOT EXISTS actual_weekly_revenue NUMERIC(12,2) NOT NULL DEFAULT 0;
ALTER TABLE discrepancies ADD COLUMN IF NOT EXISTS actual_monthly_revenue NUMERIC(12,2) NOT NULL DEFAULT 0;
ALTER TABLE discrepancies ADD COLUMN IF NOT EXISTS anomaly_score NUMERIC(12,4) NOT NULL DEFAULT 0;
ALTER TABLE discrepancies ADD COLUMN IF NOT EXISTS detection_method VARCHAR(100) NOT NULL DEFAULT 'timeseries_residual_v1';
ALTER TABLE discrepancies ADD COLUMN IF NOT EXISTS detection_run_at TIMESTAMP;
ALTER TABLE discrepancies ADD COLUMN IF NOT EXISTS is_system_generated BOOLEAN NOT NULL DEFAULT true;

CREATE INDEX IF NOT EXISTS idx_discrepancies_route_id ON discrepancies(route_id);
CREATE INDEX IF NOT EXISTS idx_discrepancies_bus_number ON discrepancies(bus_number);
CREATE INDEX IF NOT EXISTS idx_discrepancies_transaction_date ON discrepancies(transaction_date);
CREATE INDEX IF NOT EXISTS idx_discrepancies_status ON discrepancies(status);
CREATE UNIQUE INDEX IF NOT EXISTS uq_discrepancies_bus_date ON discrepancies(bus_number, transaction_date);
