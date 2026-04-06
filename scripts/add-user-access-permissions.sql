-- Add user access permission support for back-office admin controls

CREATE TABLE IF NOT EXISTS user_access_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  module_name VARCHAR(50) NOT NULL CHECK (module_name IN ('dashboard', 'discrepancies', 'routes', 'buses', 'summary', 'reports', 'users', 'audit_logs')),
  can_create BOOLEAN NOT NULL DEFAULT FALSE,
  can_view BOOLEAN NOT NULL DEFAULT FALSE,
  can_edit BOOLEAN NOT NULL DEFAULT FALSE,
  can_delete BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (user_id, module_name)
);

ALTER TABLE user_access_permissions
  ADD COLUMN IF NOT EXISTS can_create BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE user_access_permissions
  ADD COLUMN IF NOT EXISTS can_delete BOOLEAN NOT NULL DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS idx_user_access_permissions_user_id ON user_access_permissions(user_id);
