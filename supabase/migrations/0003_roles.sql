-- Un rol de base de datos por servicio: ninguno puede leer el esquema del otro.
-- Las contraseñas no van en el repositorio; se asignan aparte con ALTER ROLE.
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'mascotas_svc') THEN
    CREATE ROLE mascotas_svc LOGIN;
  END IF;
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'adopciones_svc') THEN
    CREATE ROLE adopciones_svc LOGIN;
  END IF;
END $$;

REVOKE ALL ON SCHEMA mascotas FROM PUBLIC;
REVOKE ALL ON SCHEMA adopciones FROM PUBLIC;

GRANT USAGE ON SCHEMA mascotas TO mascotas_svc;
GRANT SELECT, INSERT, UPDATE ON mascotas.mascotas TO mascotas_svc;

GRANT USAGE ON SCHEMA adopciones TO adopciones_svc;
GRANT SELECT, INSERT, UPDATE ON adopciones.solicitudes TO adopciones_svc;
