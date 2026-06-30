-- Comandia: esquema de base de datos PostgreSQL
-- Los IDs son UUID generados en Node con la libreria uuid (uuidv4), no con
-- gen_random_uuid() de Postgres, para mantener compatibilidad con el modo
-- offline (SQLite no tiene gen_random_uuid()).

CREATE TABLE IF NOT EXISTS restaurantes (
  id UUID PRIMARY KEY,
  nombre VARCHAR(255) NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  telefono VARCHAR(50),
  direccion TEXT,
  logo_url TEXT,
  modo_operacion VARCHAR(20) NOT NULL DEFAULT 'todo_en_uno'
    CHECK (modo_operacion IN ('todo_en_uno', 'multi_estacion')),
  plan VARCHAR(20) NOT NULL DEFAULT 'basico'
    CHECK (plan IN ('basico', 'profesional', 'empresarial')),
  activo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS sucursales (
  id UUID PRIMARY KEY,
  restaurante_id UUID NOT NULL REFERENCES restaurantes(id) ON DELETE CASCADE,
  nombre VARCHAR(255) NOT NULL,
  direccion TEXT,
  telefono VARCHAR(50),
  activa BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS usuarios (
  id UUID PRIMARY KEY,
  restaurante_id UUID NOT NULL REFERENCES restaurantes(id) ON DELETE CASCADE,
  sucursal_id UUID REFERENCES sucursales(id),
  nombre VARCHAR(255) NOT NULL,
  email VARCHAR(255) NOT NULL,
  password_hash TEXT NOT NULL,
  rol VARCHAR(30) NOT NULL
    CHECK (rol IN ('superadmin', 'admin', 'gerente', 'cajero', 'mesero', 'cocina')),
  activo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (email, restaurante_id)
);

CREATE TABLE IF NOT EXISTS jornadas (
  id UUID PRIMARY KEY,
  restaurante_id UUID NOT NULL REFERENCES restaurantes(id) ON DELETE CASCADE,
  sucursal_id UUID NOT NULL REFERENCES sucursales(id) ON DELETE CASCADE,
  usuario_apertura_id UUID NOT NULL REFERENCES usuarios(id),
  usuario_cierre_id UUID REFERENCES usuarios(id),
  fecha_apertura TIMESTAMPTZ NOT NULL DEFAULT now(),
  fecha_cierre TIMESTAMPTZ,
  monto_apertura DECIMAL(12,2) NOT NULL DEFAULT 0,
  monto_cierre_esperado DECIMAL(12,2),
  monto_cierre_real DECIMAL(12,2),
  estado VARCHAR(20) NOT NULL DEFAULT 'abierta'
    CHECK (estado IN ('abierta', 'cerrada', 'reabierta')),
  notas TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS audit_log (
  id UUID PRIMARY KEY,
  restaurante_id UUID,
  usuario_id UUID,
  accion VARCHAR(100) NOT NULL,
  tabla_afectada VARCHAR(100),
  registro_id UUID,
  datos_anteriores JSONB,
  datos_nuevos JSONB,
  ip VARCHAR(50),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indices
CREATE INDEX IF NOT EXISTS idx_sucursales_restaurante_id ON sucursales(restaurante_id);

CREATE INDEX IF NOT EXISTS idx_usuarios_restaurante_id ON usuarios(restaurante_id);
CREATE INDEX IF NOT EXISTS idx_usuarios_email ON usuarios(email);

CREATE INDEX IF NOT EXISTS idx_jornadas_restaurante_id ON jornadas(restaurante_id);
CREATE INDEX IF NOT EXISTS idx_jornadas_estado ON jornadas(estado);

CREATE INDEX IF NOT EXISTS idx_audit_log_restaurante_id ON audit_log(restaurante_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_created_at ON audit_log(created_at);
