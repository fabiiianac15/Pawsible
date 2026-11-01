-- Esquema propio del servicio de Adopciones.
CREATE SCHEMA IF NOT EXISTS adopciones;

CREATE TABLE adopciones.solicitudes (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Referencia lógica a mascotas.mascotas. Se valida por HTTP contra la API de Mascotas.
  mascota_id           uuid NOT NULL,
  -- Copia del nombre para listar solicitudes aunque la API de Mascotas no responda.
  mascota_nombre       text NOT NULL,
  solicitante_nombre   text NOT NULL CHECK (char_length(solicitante_nombre) BETWEEN 3 AND 120),
  solicitante_email    text NOT NULL,
  solicitante_telefono text NOT NULL,
  ciudad               text NOT NULL,
  vivienda             text NOT NULL CHECK (vivienda IN ('casa', 'apartamento', 'finca')),
  tiene_otras_mascotas boolean NOT NULL DEFAULT false,
  motivacion           text NOT NULL CHECK (char_length(motivacion) BETWEEN 20 AND 1000),
  estado               text NOT NULL DEFAULT 'pendiente'
                       CHECK (estado IN ('pendiente', 'aprobada', 'rechazada')),
  motivo_rechazo       text,
  creado_en            timestamptz NOT NULL DEFAULT now(),
  decidido_en          timestamptz,
  CONSTRAINT rechazo_tiene_motivo
    CHECK (estado <> 'rechazada' OR motivo_rechazo IS NOT NULL),
  CONSTRAINT decision_tiene_fecha
    CHECK ((estado = 'pendiente') = (decidido_en IS NULL))
);

-- La regla central del negocio: una mascota no puede tener dos adopciones aprobadas.
CREATE UNIQUE INDEX una_aprobada_por_mascota
  ON adopciones.solicitudes (mascota_id)
  WHERE estado = 'aprobada';

-- Una persona no puede tener dos solicitudes pendientes por la misma mascota.
CREATE UNIQUE INDEX una_pendiente_por_persona
  ON adopciones.solicitudes (mascota_id, lower(solicitante_email))
  WHERE estado = 'pendiente';

CREATE INDEX solicitudes_estado_idx ON adopciones.solicitudes (estado, creado_en DESC);
