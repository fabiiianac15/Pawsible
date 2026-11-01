import { defineConfig } from "@playwright/test";

const PG = "localhost:54329/pawsible";
export const CLAVE_ADMIN = "clave-admin-de-pruebas";
const CLAVE_INTERNA = "clave-interna-de-pruebas";
const python = "../../.venv/bin/python";
const entorno = { ADMIN_API_KEY: CLAVE_ADMIN, INTERNAL_API_KEY: CLAVE_INTERNA, CORS_ORIGINS: "http://localhost:4173" };

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  workers: 1,
  reporter: [["list"], ["junit", { outputFile: "../docs/evidencias/e2e.xml" }]],
  use: { baseURL: "http://localhost:4173", viewport: { width: 1280, height: 800 }, screenshot: "only-on-failure" },
  webServer: [
    {
      command: `${python} -m uvicorn app.main:app --port 8001 --log-level warning`,
      cwd: "../services/mascotas",
      env: { ...entorno, DATABASE_URL: `postgresql://mascotas_svc:mascotas_local@${PG}` },
      url: "http://localhost:8001/health",
      reuseExistingServer: false,
    },
    {
      command: `${python} -m uvicorn app.main:app --port 8002 --log-level warning`,
      cwd: "../services/adopciones",
      env: {
        ...entorno,
        DATABASE_URL: `postgresql://adopciones_svc:adopciones_local@${PG}`,
        MASCOTAS_API_URL: "http://localhost:8001",
      },
      url: "http://localhost:8002/health",
      reuseExistingServer: false,
    },
    {
      command: "npx vite build && npx vite preview --port 4173 --strictPort",
      env: { VITE_MASCOTAS_API_URL: "http://localhost:8001", VITE_ADOPCIONES_API_URL: "http://localhost:8002" },
      url: "http://localhost:4173",
      reuseExistingServer: false,
    },
  ],
});
