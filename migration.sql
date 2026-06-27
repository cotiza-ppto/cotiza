-- ============================================================
-- migration.sql — Tablas adicionales para COTIZA en Supabase
-- Ejecutar en el SQL Editor de Supabase ANTES del primer deploy
-- ============================================================

-- Tabla de sesiones (reemplaza $_SESSION de PHP, compatible con Vercel serverless)
CREATE TABLE IF NOT EXISTS sessions (
    token       VARCHAR(64)  PRIMARY KEY,
    username    VARCHAR(100) NOT NULL,
    expires_at  TIMESTAMP    NOT NULL,
    created_at  TIMESTAMP    DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_sessions_expires  ON sessions (expires_at);
CREATE INDEX IF NOT EXISTS idx_sessions_username ON sessions (username);

-- Tabla de configuración (reemplaza settings.json, compatible con Vercel read-only filesystem)
CREATE TABLE IF NOT EXISTS configuracion (
    clave      VARCHAR(100) PRIMARY KEY,
    valor      TEXT         NOT NULL,
    updated_at TIMESTAMP    DEFAULT NOW()
);

-- Opcional: limpieza automática de sesiones expiradas (requiere pg_cron habilitado en Supabase)
-- SELECT cron.schedule('clean-expired-sessions', '0 * * * *', 'DELETE FROM sessions WHERE expires_at < NOW()');
