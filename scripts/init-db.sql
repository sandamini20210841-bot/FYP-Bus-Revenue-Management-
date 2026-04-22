-- Create tables for bus ticketing system

-- Users table
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  public_id VARCHAR(10) UNIQUE NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  phone_number VARCHAR(20),
  full_name VARCHAR(255),
  role VARCHAR(50) DEFAULT 'rider' CHECK (role IN ('rider', 'bus_owner', 'accountant', 'admin', 'time_keeper')),
  password_hash VARCHAR(255),
  profile_photo_url TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  last_login TIMESTAMP,
  is_active BOOLEAN DEFAULT TRUE
);

-- Password reset tokens table
CREATE TABLE password_reset_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash VARCHAR(255) NOT NULL,
  expires_at TIMESTAMP NOT NULL,
  used BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_password_reset_tokens_user_id ON password_reset_tokens(user_id);
CREATE INDEX idx_password_reset_tokens_token_hash ON password_reset_tokens(token_hash);

-- Routes table
CREATE TABLE routes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  route_number VARCHAR(50) NOT NULL,
  bus_number VARCHAR(50) NOT NULL,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  description TEXT,
  latitude DECIMAL(10, 7),
  longitude DECIMAL(10, 7),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Stops table
CREATE TABLE stops (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  route_id UUID NOT NULL REFERENCES routes(id) ON DELETE CASCADE,
  stop_name VARCHAR(255) NOT NULL,
  sequence_order INTEGER NOT NULL,
  distance_km DECIMAL(10, 2),
  amount DECIMAL(10, 2),
  coordinates POINT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tickets table
CREATE TABLE tickets (
  ticket_number VARCHAR(9) PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  route_id UUID REFERENCES routes(id) ON DELETE SET NULL,
  bus_number VARCHAR(50),
  departure_date DATE,
  departure_time TIME,
  from_stop_id UUID REFERENCES stops(id) ON DELETE SET NULL,
  to_stop_id UUID REFERENCES stops(id) ON DELETE SET NULL,
  purchase_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  amount DECIMAL(10, 2) NOT NULL,
  status VARCHAR(50) DEFAULT 'active' CHECK (status IN ('active', 'used', 'cancelled')),
  qr_code_hash VARCHAR(255),
  valid_until TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Transactions table
CREATE TABLE transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  ticket_id VARCHAR(9) REFERENCES tickets(ticket_number) ON DELETE SET NULL,
  amount DECIMAL(10, 2) NOT NULL,
  transaction_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  payment_method VARCHAR(50),
  status VARCHAR(50) DEFAULT 'completed' CHECK (status IN ('completed', 'pending', 'failed')),
  currency VARCHAR(3) DEFAULT 'LKR',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Discrepancies table
CREATE TABLE discrepancies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  route_id UUID REFERENCES routes(id) ON DELETE SET NULL,
  bus_number VARCHAR(50),
  transaction_date DATE,
  expected_revenue DECIMAL(10, 2),
  actual_revenue DECIMAL(10, 2),
  loss_amount DECIMAL(10, 2),
  status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'investigating', 'resolved')),
  updated_by UUID REFERENCES users(id) ON DELETE SET NULL,
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Reports table
CREATE TABLE reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_type VARCHAR(50) NOT NULL CHECK (report_type IN ('daily', 'all_time', 'ticket_sales')),
  date_from DATE,
  date_to DATE,
  data JSONB,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  export_format VARCHAR(10) DEFAULT 'csv',
  file_path TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Alert Settings table
CREATE TABLE alert_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  alert_type VARCHAR(50) CHECK (alert_type IN ('email', 'sms', 'in_app')),
  enabled BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- User access permissions table (back-office feature visibility/edit rights)
CREATE TABLE user_access_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  module_name VARCHAR(50) NOT NULL CHECK (module_name IN ('dashboard', 'discrepancies', 'routes', 'buses', 'summary', 'timetable', 'reports', 'users', 'audit_logs')),
  can_create BOOLEAN NOT NULL DEFAULT FALSE,
  can_view BOOLEAN NOT NULL DEFAULT FALSE,
  can_edit BOOLEAN NOT NULL DEFAULT FALSE,
  can_delete BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (user_id, module_name)
);

-- Buses table
CREATE TABLE buses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  route_id UUID NOT NULL REFERENCES routes(id) ON DELETE CASCADE,
  bus_number VARCHAR(50) NOT NULL,
  owner_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (route_id, bus_number)
);

-- Timetable setup per route
CREATE TABLE timetable_setups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  route_id UUID NOT NULL UNIQUE REFERENCES routes(id) ON DELETE CASCADE,
  total_turns INT NOT NULL CHECK (total_turns > 0 AND total_turns <= 200),
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Timetable entries per date/turn
CREATE TABLE timetable_entries (
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

-- Audit logs table
CREATE TABLE audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  action VARCHAR(50) NOT NULL,
  resource VARCHAR(100),
  details TEXT,
  ip_address VARCHAR(64),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for performance
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_phone ON users(phone_number);
CREATE INDEX idx_tickets_user_id ON tickets(user_id);
CREATE INDEX idx_tickets_route_id ON tickets(route_id);
CREATE INDEX idx_tickets_from_stop_id ON tickets(from_stop_id);
CREATE INDEX idx_tickets_to_stop_id ON tickets(to_stop_id);
CREATE INDEX idx_transactions_user_id ON transactions(user_id);
CREATE INDEX idx_transactions_ticket_id ON transactions(ticket_id);
CREATE INDEX idx_transactions_date ON transactions(transaction_date);
CREATE INDEX idx_discrepancies_route_id ON discrepancies(route_id);
CREATE INDEX idx_discrepancies_date ON discrepancies(transaction_date);
CREATE INDEX idx_discrepancies_status ON discrepancies(status);
CREATE INDEX idx_user_access_permissions_user_id ON user_access_permissions(user_id);
CREATE INDEX idx_stops_route_id ON stops(route_id);
CREATE INDEX idx_buses_route_id ON buses(route_id);
CREATE INDEX idx_buses_owner_user_id ON buses(owner_user_id);
CREATE INDEX idx_timetable_entries_route_date ON timetable_entries(route_id, service_date);
CREATE INDEX idx_audit_logs_created_at ON audit_logs(created_at);
CREATE INDEX idx_audit_logs_user_id ON audit_logs(user_id);
