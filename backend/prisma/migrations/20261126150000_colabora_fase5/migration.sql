-- Colabora · fase 5: seguimiento de conexiones y revocación. Idempotente.

-- Resultado declarado: fecha de cada parte (la especificación pide fecha y parte que declara)
ALTER TABLE colabora.contact_requests ADD COLUMN IF NOT EXISTS requester_outcome_at timestamptz;
ALTER TABLE colabora.contact_requests ADD COLUMN IF NOT EXISTS owner_outcome_at timestamptz;

-- Valores de la especificación: «Seguimos hablando», «Hemos acordado colaborar»,
-- «Hemos presentado la propuesta», «Concedida», «No concedida», «No ha habido encaje».
-- Los dos valores anteriores que cambian de nombre se traducen.
UPDATE colabora.contact_requests
   SET requester_outcome = CASE requester_outcome WHEN 'preparando' THEN 'acordado' WHEN 'no_seguimos' THEN 'sin_encaje' ELSE requester_outcome END,
       requester_outcome_at = COALESCE(requester_outcome_at, outcome_updated_at)
 WHERE requester_outcome IS NOT NULL;
UPDATE colabora.contact_requests
   SET owner_outcome = CASE owner_outcome WHEN 'preparando' THEN 'acordado' WHEN 'no_seguimos' THEN 'sin_encaje' ELSE owner_outcome END,
       owner_outcome_at = COALESCE(owner_outcome_at, outcome_updated_at)
 WHERE owner_outcome IS NOT NULL;

-- Revocación: cualquiera de las dos partes puede cortar una conexión aceptada
ALTER TABLE colabora.contact_requests ADD COLUMN IF NOT EXISTS revoked_at timestamptz;
ALTER TABLE colabora.contact_requests ADD COLUMN IF NOT EXISTS revoked_by uuid;
ALTER TABLE colabora.contact_requests DROP CONSTRAINT IF EXISTS contact_requests_status_check;
ALTER TABLE colabora.contact_requests ADD CONSTRAINT contact_requests_status_check
  CHECK (status IN ('pendiente', 'aceptada', 'rechazada', 'retirada', 'caducada', 'revocada'));

-- Recordatorios de seguimiento (14 días tras aceptar y al cerrar la convocatoria)
ALTER TABLE colabora.profiles ADD COLUMN IF NOT EXISTS followup_reminders boolean NOT NULL DEFAULT true;
ALTER TABLE colabora.accounts ADD COLUMN IF NOT EXISTS reminder_token text;
CREATE UNIQUE INDEX IF NOT EXISTS accounts_reminder_token_idx ON colabora.accounts (reminder_token) WHERE reminder_token IS NOT NULL;
CREATE TABLE IF NOT EXISTS colabora.followups (
  request_id uuid NOT NULL REFERENCES colabora.contact_requests(id) ON DELETE CASCADE,
  account_id uuid NOT NULL REFERENCES colabora.accounts(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('14d', 'cierre')),
  sent_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (request_id, account_id, kind)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON colabora.followups TO colabora_app;
