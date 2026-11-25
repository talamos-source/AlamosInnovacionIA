-- Colabora · fase 3: resultados de las conexiones, procedencia de visitas,
-- autorización de LinkedIn por versión y gestión de solicitudes de apoyo. Idempotente.

-- Resultado declarado por cada parte de una conexión aceptada
ALTER TABLE colabora.contact_requests ADD COLUMN IF NOT EXISTS requester_outcome text;
ALTER TABLE colabora.contact_requests ADD COLUMN IF NOT EXISTS owner_outcome text;
ALTER TABLE colabora.contact_requests ADD COLUMN IF NOT EXISTS outcome_updated_at timestamptz;

-- Visitas a fichas por día y procedencia (sin datos personales ni contactos en la URL)
CREATE TABLE IF NOT EXISTS colabora.listing_views (
  listing_id uuid NOT NULL REFERENCES colabora.listings(id) ON DELETE CASCADE,
  day date NOT NULL DEFAULT current_date,
  source text NOT NULL,
  views integer NOT NULL DEFAULT 0,
  PRIMARY KEY (listing_id, day, source)
);

-- LinkedIn: qué texto (título + resumen) se autorizó y cuándo
ALTER TABLE colabora.listings ADD COLUMN IF NOT EXISTS linkedin_authorized_at timestamptz;
ALTER TABLE colabora.listings ADD COLUMN IF NOT EXISTS linkedin_authorized_text text;

-- Solicitudes de apoyo profesional: pendiente / en el CRM / descartada
ALTER TABLE colabora.listings ADD COLUMN IF NOT EXISTS support_status text NOT NULL DEFAULT 'pendiente';

GRANT SELECT, INSERT, UPDATE, DELETE ON colabora.listing_views TO colabora_app;

-- Autorizaciones de LinkedIn anteriores a esta fase: se toman sobre el texto actual
UPDATE colabora.listings
   SET linkedin_authorized_at = COALESCE(published_at, updated_at),
       linkedin_authorized_text = title || E'\n' || summary
 WHERE linkedin_authorized AND linkedin_authorized_text IS NULL;
