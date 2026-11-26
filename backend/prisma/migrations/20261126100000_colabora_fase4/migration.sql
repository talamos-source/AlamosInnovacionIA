-- Colabora · fase 4: conservación de datos. Idempotente.
-- Aviso previo (30 días) antes de borrar una cuenta inactiva.
ALTER TABLE colabora.accounts ADD COLUMN IF NOT EXISTS inactivity_notice_at timestamptz;
CREATE INDEX IF NOT EXISTS accounts_activity_idx ON colabora.accounts (last_login_at, created_at);
CREATE INDEX IF NOT EXISTS contact_requests_created_idx ON colabora.contact_requests (created_at);
CREATE INDEX IF NOT EXISTS reports_created_idx ON colabora.reports (created_at);
