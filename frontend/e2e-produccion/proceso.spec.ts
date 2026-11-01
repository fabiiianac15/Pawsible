import { expect, request, test } from "@playwright/test";

const MASCOTAS = "https://pawsible-mascotas.vercel.app";
const ADOPCIONES = "https://pawsible-adopciones.vercel.app";
const CLAVE = process.env.ADMIN_API_KEY ?? "";
const EVIDENCIAS = "../docs/evidencias";
const encabezados = { "X-Admin-Key": CLAVE };

async function crearMascota(nombre: string) {
  const api = await request.newContext();
  const r = await api.post(`${MASCOTAS}/mascotas`, {
    headers: encabezados,
    data: { nombre, especie: "gato", edad_meses: 12, tamano: "pequeno", sexo: "macho", descripcion: "Mascota temporal de una prueba en producción." },
  });
  expect(r.status()).toBe(201);
  return { api, id: (await r.json()).id as string };
}

test("proceso completo en la nube, desde el navegador", async ({ page }) => {
  expect(CLAVE, "falta ADMIN_API_KEY").not.toBe("");
  const nombre = `PruebaProd${Date.now()}`;
  const { id } = await crearMascota(nombre);
  const errores: string[] = [];
  page.on("console", (m) => m.type() === "error" && errores.push(m.text()));

  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Canela" })).toBeVisible();
  await page.screenshot({ path: `${EVIDENCIAS}/produccion-1-catalogo.png`, animations: "disabled" });

  await page.goto(`/?q=${nombre}`);
  await page.getByRole("link", { name: new RegExp(nombre) }).click();
  await page.getByLabel("Nombre completo").fill("Andrés Ropero");
  await page.getByLabel("Correo").fill(`andres${Date.now()}@correo.co`);
  await page.getByLabel("Teléfono").fill("3107654321");
  await page.getByLabel("Ciudad").fill("Ocaña");
  await page.getByLabel(/¿Por qué quieres adoptar/).fill("Vivo con mi familia y tengo experiencia cuidando gatos.");
  await page.getByRole("button", { name: "Enviar solicitud" }).click();
  await expect(page.getByRole("heading", { name: `Recibimos tu solicitud para ${nombre}` })).toBeVisible();
  const seguimiento = page.url().replace("?nueva=1", "");

  await page.goto("/panel");
  await page.getByLabel("Clave de administración").fill(CLAVE);
  await page.getByRole("button", { name: "Entrar al panel" }).click();
  await page.getByRole("button", { name: new RegExp(`para ${nombre}`) }).click();
  await page.getByRole("button", { name: "Aprobar adopción" }).click();
  await expect(page.getByRole("status").getByText(`Aprobaste la adopción de ${nombre}.`)).toBeVisible();

  await page.goto(seguimiento);
  await expect(page.getByText("Aprobada", { exact: true }).first()).toBeVisible();
  await page.screenshot({ path: `${EVIDENCIAS}/produccion-2-aprobada.png`, fullPage: true, animations: "disabled" });

  await page.goto(`/mascotas/${id}`);
  await expect(page.getByRole("heading", { name: `${nombre} ya encontró hogar` })).toBeVisible();
  expect(errores).toEqual([]);
});

test("aprobaciones simultáneas en la nube: solo una gana", async () => {
  const { api, id } = await crearMascota(`PruebaProd${Date.now()}`);
  const solicitudes: string[] = [];
  for (let i = 0; i < 5; i++) {
    const r = await api.post(`${ADOPCIONES}/solicitudes`, {
      data: {
        mascota_id: id,
        solicitante_nombre: "Diego Pacheco",
        solicitante_email: `diego${i}.${Date.now()}@correo.co`,
        solicitante_telefono: "3001112233",
        ciudad: "Ocaña",
        vivienda: "casa",
        motivacion: "Prueba de concurrencia en el sistema desplegado.",
      },
    });
    expect(r.status()).toBe(201);
    solicitudes.push((await r.json()).id);
  }
  const respuestas = await Promise.all(
    solicitudes.map((s) => api.post(`${ADOPCIONES}/solicitudes/${s}/aprobar`, { headers: encabezados })),
  );
  const codigos = respuestas.map((r) => r.status());
  expect(codigos.filter((c) => c === 200), String(codigos)).toHaveLength(1);
  expect(codigos.filter((c) => c === 409), String(codigos)).toHaveLength(4);
  expect((await (await api.get(`${MASCOTAS}/mascotas/${id}`)).json()).estado).toBe("adoptada");
});

test("Swagger de las dos APIs se muestra con sus operaciones", async ({ page }) => {
  await page.goto(`${MASCOTAS}/docs`);
  await expect(page.getByText("/mascotas/{mascota_id}/adopcion").first()).toBeVisible();
  await page.screenshot({ path: `${EVIDENCIAS}/produccion-3-swagger-mascotas.png`, animations: "disabled" });
  await page.goto(`${ADOPCIONES}/docs`);
  await expect(page.getByText("/solicitudes/{solicitud_id}/aprobar").first()).toBeVisible();
  await page.screenshot({ path: `${EVIDENCIAS}/produccion-4-swagger-adopciones.png`, animations: "disabled" });
});

test("la gestión exige clave y CORS solo admite el frontend", async () => {
  const api = await request.newContext();
  expect((await api.get(`${ADOPCIONES}/solicitudes`)).status()).toBe(401);
  const ajeno = await api.get(`${MASCOTAS}/mascotas?limit=1`, { headers: { Origin: "https://sitio-ajeno.example" } });
  expect(ajeno.headers()["access-control-allow-origin"]).toBeUndefined();
  const propio = await api.get(`${MASCOTAS}/mascotas?limit=1`, { headers: { Origin: "https://pawsible-two.vercel.app" } });
  expect(propio.headers()["access-control-allow-origin"]).toBe("https://pawsible-two.vercel.app");
});
