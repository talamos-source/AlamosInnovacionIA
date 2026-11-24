-- ============================================================
-- Colabora · Fase 0/1
-- Espacio de datos AISLADO del CRM:
--   · esquema propio "colabora" (las tablas del CRM siguen en "public")
--   · usuario de base de datos "colabora_app" con permisos SOLO sobre
--     este esquema: no puede leer AppData (clientes, proyectos, facturas…),
--     ni User, ni ninguna otra tabla del CRM.
-- La contraseña de colabora_app NO está aquí: se genera desde el CRM
-- (Administración de Colabora → Configuración) y se guarda en Vercel.
-- ============================================================

CREATE SCHEMA IF NOT EXISTS colabora;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'colabora_app') THEN
    CREATE ROLE colabora_app NOLOGIN;
  END IF;
END $$;

ALTER ROLE colabora_app CONNECTION LIMIT 20;
ALTER ROLE colabora_app SET statement_timeout = '10s';
ALTER ROLE colabora_app SET search_path = colabora;

-- Cuentas externas (una por correo verificado)
CREATE TABLE IF NOT EXISTS colabora.accounts (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email              text NOT NULL UNIQUE,
  email_verified_at  timestamptz,
  status             text NOT NULL DEFAULT 'active',   -- active | suspended
  created_at         timestamptz NOT NULL DEFAULT now(),
  last_login_at      timestamptz
);

-- Perfil privado (se reutiliza en cada anuncio)
CREATE TABLE IF NOT EXISTS colabora.profiles (
  account_id         uuid PRIMARY KEY REFERENCES colabora.accounts(id) ON DELETE CASCADE,
  contact_name       text NOT NULL DEFAULT '',
  represents_entity  boolean NOT NULL DEFAULT true,
  entity_name        text,
  entity_type        text,                              -- empresa | universidad | centro | otra | profesional
  country            text,
  contact_email      text,
  phone              text,
  specialties        text[] NOT NULL DEFAULT '{}',
  language           text NOT NULL DEFAULT 'es',
  notify_email       boolean NOT NULL DEFAULT true,
  updated_at         timestamptz NOT NULL DEFAULT now()
);

-- Enlaces de acceso por correo (se guarda solo el hash)
CREATE TABLE IF NOT EXISTS colabora.login_tokens (
  token_hash   text PRIMARY KEY,
  email        text NOT NULL,
  return_to    text,
  ip_hash      text,
  created_at   timestamptz NOT NULL DEFAULT now(),
  expires_at   timestamptz NOT NULL,
  used_at      timestamptz
);
CREATE INDEX IF NOT EXISTS login_tokens_email_idx ON colabora.login_tokens (email, created_at);
CREATE INDEX IF NOT EXISTS login_tokens_ip_idx ON colabora.login_tokens (ip_hash, created_at);

-- Sesiones (cookie httpOnly en la web; se guarda solo el hash)
CREATE TABLE IF NOT EXISTS colabora.sessions (
  token_hash    text PRIMARY KEY,
  account_id    uuid NOT NULL REFERENCES colabora.accounts(id) ON DELETE CASCADE,
  created_at    timestamptz NOT NULL DEFAULT now(),
  expires_at    timestamptz NOT NULL,
  last_seen_at  timestamptz
);
CREATE INDEX IF NOT EXISTS sessions_account_idx ON colabora.sessions (account_id);

-- Anuncios (búsquedas y ofertas) vinculados a una convocatoria del Mapa de ayudas
CREATE TABLE IF NOT EXISTS colabora.listings (
  id                     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  public_id              text NOT NULL UNIQUE,         -- id corto para URLs, sin nombres
  account_id             uuid NOT NULL REFERENCES colabora.accounts(id),
  -- convocatoria (id estable del catálogo + instantánea para no perder contexto)
  call_id                text NOT NULL,                -- 'EU_PORTAL::HORIZON-…' | 'BDNS::123456'
  call_title             text NOT NULL,
  call_programme         text,
  call_body              text,
  call_ambito            text,
  call_close_date        text,
  call_url               text,
  -- contenido
  mode                   text NOT NULL,                -- busco | ofrezco
  collab_type            text NOT NULL,                -- consorcio | tecnica | talento
  title                  text NOT NULL,
  summary                text NOT NULL,
  details                text,
  specialties            text[] NOT NULL DEFAULT '{}',
  phase                  text,                         -- explorando | preparando | completando
  target_contact_date    date,
  accept_until           timestamptz,
  collaborator_country   text,
  conditions             text,
  extra                  jsonb NOT NULL DEFAULT '{}',  -- campos según tipo de colaboración
  -- autor (privado; tipo y país solo si show_author_meta)
  author_entity_type     text,
  author_country         text,
  show_author_meta       boolean NOT NULL DEFAULT true,
  entity_label           text,                         -- entidad representada en ESTE anuncio
  contact_name           text,
  contact_email          text,
  contact_phone          text,
  represents_authorized  boolean NOT NULL DEFAULT false,
  wants_support          boolean NOT NULL DEFAULT false,
  linkedin_authorized    boolean NOT NULL DEFAULT false,
  -- ciclo de vida
  state                  text NOT NULL DEFAULT 'borrador', -- borrador | pendiente | publicado | pausado | cerrado | rechazado
  close_reason           text,
  review_flags           text[] NOT NULL DEFAULT '{}',
  review_pending         boolean NOT NULL DEFAULT false,   -- edición pendiente de revisión
  published_snapshot     jsonb,                            -- última versión pública aprobada
  language               text NOT NULL DEFAULT 'es',
  version                integer NOT NULL DEFAULT 1,
  created_at             timestamptz NOT NULL DEFAULT now(),
  updated_at             timestamptz NOT NULL DEFAULT now(),
  published_at           timestamptz,
  closed_at              timestamptz
);
CREATE INDEX IF NOT EXISTS listings_call_state_idx ON colabora.listings (call_id, state);
CREATE INDEX IF NOT EXISTS listings_account_idx ON colabora.listings (account_id);
CREATE INDEX IF NOT EXISTS listings_state_idx ON colabora.listings (state, updated_at);

-- Registro de acciones relevantes (usuarios, administración, sistema)
CREATE TABLE IF NOT EXISTS colabora.events (
  id          bigserial PRIMARY KEY,
  actor       text NOT NULL,
  action      text NOT NULL,
  resource    text,
  detail      jsonb,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS events_created_idx ON colabora.events (created_at);

-- Versión pública de un anuncio: SOLO campos sin identidad.
-- La usan la web (al publicar) y el CRM (al aprobar) para que sea idéntica.
CREATE OR REPLACE FUNCTION colabora.public_snapshot(l colabora.listings)
RETURNS jsonb LANGUAGE sql STABLE AS $$
  SELECT jsonb_build_object(
    'title', l.title,
    'summary', l.summary,
    'details', l.details,
    'specialties', to_jsonb(l.specialties),
    'mode', l.mode,
    'collabType', l.collab_type,
    'phase', l.phase,
    'targetContactDate', l.target_contact_date,
    'acceptUntil', l.accept_until,
    'collaboratorCountry', l.collaborator_country,
    'conditions', l.conditions,
    'extra', l.extra,
    'authorEntityType', CASE WHEN l.show_author_meta THEN l.author_entity_type END,
    'authorCountry', CASE WHEN l.show_author_meta THEN l.author_country END,
    'language', l.language
  )
$$;

-- Permisos: colabora_app trabaja SOLO dentro del esquema colabora
GRANT USAGE ON SCHEMA colabora TO colabora_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA colabora TO colabora_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA colabora TO colabora_app;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA colabora TO colabora_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA colabora GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO colabora_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA colabora GRANT USAGE, SELECT ON SEQUENCES TO colabora_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA colabora GRANT EXECUTE ON FUNCTIONS TO colabora_app;
