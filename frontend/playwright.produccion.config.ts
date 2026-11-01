import { defineConfig } from "@playwright/test";

// Prueba el sistema desplegado. Requiere ADMIN_API_KEY en el entorno.
export default defineConfig({
  testDir: "./e2e-produccion",
  workers: 1,
  timeout: 90_000,
  expect: { timeout: 20_000 },
  reporter: [["list"], ["junit", { outputFile: "../docs/evidencias/produccion.xml" }]],
  use: { baseURL: "https://pawsible-two.vercel.app", viewport: { width: 1280, height: 800 } },
});
