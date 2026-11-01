-- Esquema propio del servicio de Mascotas.
CREATE SCHEMA IF NOT EXISTS mascotas;

CREATE TABLE mascotas.mascotas (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre                text NOT NULL CHECK (char_length(nombre) BETWEEN 1 AND 80),
  especie               text NOT NULL CHECK (especie IN ('perro', 'gato', 'conejo')),
  raza                  text,
  edad_meses            integer NOT NULL CHECK (edad_meses BETWEEN 0 AND 360),
  tamano                text NOT NULL CHECK (tamano IN ('pequeno', 'mediano', 'grande')),
  sexo                  text NOT NULL CHECK (sexo IN ('macho', 'hembra')),
  descripcion           text NOT NULL CHECK (char_length(descripcion) BETWEEN 1 AND 1000),
  foto_url              text,
  estado                text NOT NULL DEFAULT 'disponible'
                        CHECK (estado IN ('disponible', 'en_tratamiento', 'adoptada')),
  -- Identificador de la solicitud que adoptó a la mascota. No es llave foránea:
  -- la solicitud vive en el esquema del otro servicio.
  solicitud_adopcion_id uuid,
  creado_en             timestamptz NOT NULL DEFAULT now(),
  actualizado_en        timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT adoptada_tiene_solicitud
    CHECK ((estado = 'adoptada') = (solicitud_adopcion_id IS NOT NULL))
);

CREATE INDEX mascotas_estado_idx ON mascotas.mascotas (estado, creado_en DESC);
