-- Colabora · fase 6: recordatorio de solicitudes sin responder, aviso antes de que
-- un anuncio deje de aceptar solicitudes y alertas de nuevos anuncios por convocatoria.
-- Idempotente.

-- Recordatorio al autor de solicitudes pendientes (una vez por solicitud)
ALTER TABLE colabora.followups DROP CONSTRAINT IF EXISTS followups_kind_check;
ALTER TABLE colabora.followups ADD CONSTRAINT followups_kind_check CHECK (kind IN ('14d', 'cierre', 'pendiente'));

-- Aviso al autor antes de la fecha límite: se guarda para qué fecha se avisó
-- (si el autor la amplía, se le puede volver a avisar con la nueva)
ALTER TABLE colabora.listings ADD COLUMN IF NOT EXISTS expiry_notice_for date;

-- Alertas: «Avísame si alguien publica en esta convocatoria»
CREATE TABLE IF NOT EXISTS colabora.call_alerts (
  account_id uuid NOT NULL REFERENCES colabora.accounts(id) ON DELETE CASCADE,
  call_id text NOT NULL,
  call_title text,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_notified_at timestamptz,
  PRIMARY KEY (account_id, call_id)
);
CREATE INDEX IF NOT EXISTS call_alerts_call_idx ON colabora.call_alerts (call_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON colabora.call_alerts TO colabora_app;
