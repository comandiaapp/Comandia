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

CREATE TABLE IF NOT EXISTS categorias (
  id UUID PRIMARY KEY,
  restaurante_id UUID NOT NULL REFERENCES restaurantes(id) ON DELETE CASCADE,
  nombre VARCHAR(100) NOT NULL,
  descripcion TEXT,
  imagen_url TEXT,
  color VARCHAR(7),
  orden INTEGER NOT NULL DEFAULT 0,
  activa BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS productos (
  id UUID PRIMARY KEY,
  restaurante_id UUID NOT NULL REFERENCES restaurantes(id) ON DELETE CASCADE,
  categoria_id UUID REFERENCES categorias(id) ON DELETE SET NULL,
  nombre VARCHAR(255) NOT NULL,
  descripcion TEXT,
  imagen_url TEXT,
  precio DECIMAL(12,2) NOT NULL,
  costo DECIMAL(12,2),
  tipo VARCHAR(20) NOT NULL DEFAULT 'producto'
    CHECK (tipo IN ('producto', 'combo', 'modificador')),
  disponible BOOLEAN NOT NULL DEFAULT true,
  disponible_para VARCHAR(20) NOT NULL DEFAULT 'todos'
    CHECK (disponible_para IN ('todos', 'mesa', 'delivery', 'barra')),
  tiempo_preparacion INTEGER,
  orden INTEGER NOT NULL DEFAULT 0,
  activo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS modificadores_grupo (
  id UUID PRIMARY KEY,
  restaurante_id UUID NOT NULL REFERENCES restaurantes(id) ON DELETE CASCADE,
  nombre VARCHAR(100) NOT NULL,
  requerido BOOLEAN NOT NULL DEFAULT false,
  seleccion_multiple BOOLEAN NOT NULL DEFAULT false,
  minimo INTEGER NOT NULL DEFAULT 0,
  maximo INTEGER NOT NULL DEFAULT 1,
  activo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS modificadores_opciones (
  id UUID PRIMARY KEY,
  grupo_id UUID NOT NULL REFERENCES modificadores_grupo(id) ON DELETE CASCADE,
  restaurante_id UUID NOT NULL REFERENCES restaurantes(id) ON DELETE CASCADE,
  nombre VARCHAR(100) NOT NULL,
  precio_extra DECIMAL(12,2) NOT NULL DEFAULT 0,
  activo BOOLEAN NOT NULL DEFAULT true,
  orden INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS productos_modificadores (
  producto_id UUID NOT NULL REFERENCES productos(id) ON DELETE CASCADE,
  grupo_id UUID NOT NULL REFERENCES modificadores_grupo(id) ON DELETE CASCADE,
  PRIMARY KEY (producto_id, grupo_id)
);

CREATE TABLE IF NOT EXISTS areas (
  id UUID PRIMARY KEY,
  restaurante_id UUID NOT NULL REFERENCES restaurantes(id) ON DELETE CASCADE,
  nombre VARCHAR(100) NOT NULL,
  descripcion TEXT,
  activa BOOLEAN NOT NULL DEFAULT true,
  orden INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS mesas (
  id UUID PRIMARY KEY,
  restaurante_id UUID NOT NULL REFERENCES restaurantes(id) ON DELETE CASCADE,
  area_id UUID REFERENCES areas(id) ON DELETE SET NULL,
  numero VARCHAR(20) NOT NULL,
  nombre VARCHAR(100),
  capacidad INTEGER NOT NULL DEFAULT 4,
  estado VARCHAR(20) NOT NULL DEFAULT 'libre'
    CHECK (estado IN ('libre', 'ocupada', 'cuenta_pedida', 'reservada', 'bloqueada')),
  posicion_x DECIMAL(5,2) NOT NULL DEFAULT 0,
  posicion_y DECIMAL(5,2) NOT NULL DEFAULT 0,
  activa BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (numero, restaurante_id)
);

CREATE TABLE IF NOT EXISTS pedidos (
  id UUID PRIMARY KEY,
  restaurante_id UUID NOT NULL REFERENCES restaurantes(id) ON DELETE CASCADE,
  sucursal_id UUID REFERENCES sucursales(id),
  mesa_id UUID REFERENCES mesas(id) ON DELETE SET NULL,
  jornada_id UUID REFERENCES jornadas(id) ON DELETE SET NULL,
  usuario_id UUID NOT NULL REFERENCES usuarios(id),
  numero SERIAL,
  tipo VARCHAR(20) NOT NULL DEFAULT 'mesa'
    CHECK (tipo IN ('mesa', 'barra', 'delivery', 'take_away')),
  estado VARCHAR(20) NOT NULL DEFAULT 'abierto'
    CHECK (estado IN ('abierto', 'enviado_cocina', 'listo', 'cuenta_pedida', 'pagado', 'cancelado')),
  notas TEXT,
  subtotal DECIMAL(12,2) NOT NULL DEFAULT 0,
  descuento DECIMAL(12,2) NOT NULL DEFAULT 0,
  impuesto DECIMAL(12,2) NOT NULL DEFAULT 0,
  propina DECIMAL(12,2) NOT NULL DEFAULT 0,
  total DECIMAL(12,2) NOT NULL DEFAULT 0,
  pagado_con VARCHAR(20)
    CHECK (pagado_con IS NULL OR pagado_con IN ('efectivo', 'tarjeta', 'qr', 'mixto')),
  monto_recibido DECIMAL(12,2),
  cambio DECIMAL(12,2),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS pedido_items (
  id UUID PRIMARY KEY,
  pedido_id UUID NOT NULL REFERENCES pedidos(id) ON DELETE CASCADE,
  restaurante_id UUID NOT NULL REFERENCES restaurantes(id) ON DELETE CASCADE,
  producto_id UUID REFERENCES productos(id) ON DELETE SET NULL,
  nombre_producto VARCHAR(255) NOT NULL,
  precio_unitario DECIMAL(12,2) NOT NULL,
  cantidad INTEGER NOT NULL DEFAULT 1,
  subtotal DECIMAL(12,2) NOT NULL,
  notas TEXT,
  estado VARCHAR(20) NOT NULL DEFAULT 'pendiente'
    CHECK (estado IN ('pendiente', 'en_preparacion', 'listo', 'entregado', 'cancelado')),
  enviado_cocina_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS pedido_item_modificadores (
  id UUID PRIMARY KEY,
  pedido_item_id UUID NOT NULL REFERENCES pedido_items(id) ON DELETE CASCADE,
  modificador_opcion_id UUID REFERENCES modificadores_opciones(id),
  nombre_opcion VARCHAR(100),
  precio_extra DECIMAL(12,2) NOT NULL DEFAULT 0
);

-- Indices
CREATE INDEX IF NOT EXISTS idx_sucursales_restaurante_id ON sucursales(restaurante_id);

CREATE INDEX IF NOT EXISTS idx_usuarios_restaurante_id ON usuarios(restaurante_id);
CREATE INDEX IF NOT EXISTS idx_usuarios_email ON usuarios(email);

CREATE INDEX IF NOT EXISTS idx_jornadas_restaurante_id ON jornadas(restaurante_id);
CREATE INDEX IF NOT EXISTS idx_jornadas_estado ON jornadas(estado);

CREATE INDEX IF NOT EXISTS idx_audit_log_restaurante_id ON audit_log(restaurante_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_created_at ON audit_log(created_at);

CREATE INDEX IF NOT EXISTS idx_categorias_restaurante_id ON categorias(restaurante_id);
CREATE INDEX IF NOT EXISTS idx_categorias_activa ON categorias(activa);

CREATE INDEX IF NOT EXISTS idx_productos_restaurante_id ON productos(restaurante_id);
CREATE INDEX IF NOT EXISTS idx_productos_categoria_id ON productos(categoria_id);
CREATE INDEX IF NOT EXISTS idx_productos_disponible ON productos(disponible);
CREATE INDEX IF NOT EXISTS idx_productos_activo ON productos(activo);

CREATE INDEX IF NOT EXISTS idx_modificadores_grupo_restaurante_id ON modificadores_grupo(restaurante_id);

CREATE INDEX IF NOT EXISTS idx_areas_restaurante_id ON areas(restaurante_id);

CREATE INDEX IF NOT EXISTS idx_mesas_restaurante_id ON mesas(restaurante_id);
CREATE INDEX IF NOT EXISTS idx_mesas_area_id ON mesas(area_id);
CREATE INDEX IF NOT EXISTS idx_mesas_estado ON mesas(estado);

CREATE INDEX IF NOT EXISTS idx_pedidos_restaurante_id ON pedidos(restaurante_id);
CREATE INDEX IF NOT EXISTS idx_pedidos_mesa_id ON pedidos(mesa_id);
CREATE INDEX IF NOT EXISTS idx_pedidos_estado ON pedidos(estado);
CREATE INDEX IF NOT EXISTS idx_pedidos_jornada_id ON pedidos(jornada_id);
CREATE INDEX IF NOT EXISTS idx_pedidos_created_at ON pedidos(created_at);

-- Garantiza a nivel de base de datos que una mesa no pueda tener dos
-- pedidos activos al mismo tiempo, incluso si dos peticiones concurrentes
-- intentan crear uno (dos clicks casi simultáneos en "Abrir mesa").
CREATE UNIQUE INDEX IF NOT EXISTS idx_pedidos_mesa_activo
  ON pedidos(mesa_id)
  WHERE estado IN ('abierto', 'enviado_cocina', 'listo', 'cuenta_pedida');

CREATE INDEX IF NOT EXISTS idx_pedido_items_pedido_id ON pedido_items(pedido_id);
CREATE INDEX IF NOT EXISTS idx_pedido_items_estado ON pedido_items(estado);
CREATE INDEX IF NOT EXISTS idx_pedido_items_restaurante_id ON pedido_items(restaurante_id);
