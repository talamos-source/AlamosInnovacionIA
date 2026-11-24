-- Colabora · fase 2: solicitudes de contacto, bloqueos y denuncias.
-- Idempotente. Mismo esquema aislado "colabora"; la web accede con el usuario
-- restringido colabora_app (sin acceso a las tablas del CRM).

CREATE TABLE IF NOT EXISTS colabora.contact_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Si el anuncio se elimina, la solicitud se conserva como evidencia (sin anuncio)
  listing_id uuid REFERENCES colabora.listings(id) ON DELETE SET NULL,
  requester_id uuid NOT NULL REFERENCES colabora.accounts(id) ON DELETE CASCADE,
  owner_id uuid NOT NULL REFERENCES colabora.accounts(id) ON DELETE CASCADE,
  message text NOT NULL,
  status text NOT NULL DEFAULT 'pendiente'
    CHECK (status IN ('pendiente', 'aceptada', 'rechazada', 'retirada', 'caducada')),
  listing_title text,
  call_id text,
  call_title text,
  -- Versión de los datos que comparte cada parte (solicitante al enviar, autor al aceptar)
  requester_share jsonb NOT NULL DEFAULT '{}'::jsonb,
  owner_share jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  responded_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Como máximo una solicitud activa (pendiente o aceptada) por cuenta y anuncio:
-- un doble clic o un reintento no duplica solicitudes ni conexiones.
CREATE UNIQUE INDEX IF NOT EXISTS contact_requests_one_active
  ON colabora.contact_requests (listing_id, requester_id)
  WHERE status IN ('pendiente', 'aceptada');
CREATE INDEX IF NOT EXISTS contact_requests_owner_idx ON colabora.contact_requests (owner_id, status);
CREATE INDEX IF NOT EXISTS contact_requests_requester_idx ON colabora.contact_requests (requester_id, created_at DESC);
CREATE INDEX IF NOT EXISTS contact_requests_listing_idx ON colabora.contact_requests (listing_id, status);

CREATE TABLE IF NOT EXISTS colabora.blocks (
  blocker_id uuid NOT NULL REFERENCES colabora.accounts(id) ON DELETE CASCADE,
  blocked_id uuid NOT NULL REFERENCES colabora.accounts(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (blocker_id, blocked_id)
);

CREATE TABLE IF NOT EXISTS colabora.reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id uuid REFERENCES colabora.accounts(id) ON DELETE SET NULL,
  request_id uuid REFERENCES colabora.contact_requests(id) ON DELETE SET NULL,
  listing_id uuid REFERENCES colabora.listings(id) ON DELETE SET NULL,
  reason text NOT NULL,
  status text NOT NULL DEFAULT 'abierta' CHECK (status IN ('abierta', 'revisada')),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS reports_status_idx ON colabora.reports (status, created_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON colabora.contact_requests, colabora.blocks, colabora.reports TO colabora_app;
