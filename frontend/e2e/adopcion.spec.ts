import { expect, request, test, type Page } from "@playwright/test";

const CLAVE = "clave-admin-de-pruebas";
const EVIDENCIAS = "../docs/evidencias";
const API_MASCOTAS = "http://localhost:8001";

async function crearMascota(nombre: string) {
  const api = await request.newContext();
  const respuesta = await api.post(`${API_MASCOTAS}/mascotas`, {
    headers: { "X-Admin-Key": CLAVE },
    data: { nombre, especie: "perro", edad_meses: 30, tamano: "mediano", sexo: "hembra", descripcion: "Creada por la prueba de punta a punta." },
  });
  expect(respuesta.status()).toBe(201);
  return (await respuesta.json()) as { id: string };
}

async function solicitar(page: Page, nombreMascota: string, id: string, correo: string) {
  await page.goto(`/?q=${nombreMascota}`);
  await page.getByRole("link", { name: new RegExp(nombreMascota) }).click();
  await expect(page).toHaveURL(new RegExp(`/mascotas/${id}`));
  await expect(page.getByText("Disponible", { exact: true })).toBeVisible();

  await page.getByLabel("Nombre completo").fill("Natalia Ascanio");
  await page.getByLabel("Correo").fill(correo);
  await page.getByLabel("Teléfono").fill("3159876543");
  await page.getByLabel("Ciudad").fill("Ocaña");
  await page.getByLabel(/¿Por qué quieres adoptar/).fill("Tengo patio cerrado y tiempo para paseos todos los días.");
  await page.getByRole("button", { name: "Enviar solicitud" }).click();

  await expect(page.getByRole("heading", { name: `Recibimos tu solicitud para ${nombreMascota}` })).toBeVisible();
  return page.url();
}

async function entrarAlPanel(page: Page) {
  await page.goto("/panel");
  await page.getByLabel("Clave de administración").fill(CLAVE);
  await page.getByRole("button", { name: "Entrar al panel" }).click();
  await expect(page.getByRole("heading", { name: "Panel de la fundación" })).toBeVisible();
}

test("proceso completo: consultar, solicitar, aprobar y ver la mascota adoptada", async ({ page }) => {
  const nombre = `Mango${Date.now()}`;
  const { id } = await crearMascota(nombre);
  const seguimiento = await solicitar(page, nombre, id, `natalia${Date.now()}@correo.co`);
  await page.screenshot({ path: `${EVIDENCIAS}/02-solicitud-recibida.png`, fullPage: true, animations: "disabled" });

  await entrarAlPanel(page);
  await page.getByRole("button", { name: new RegExp(`Revisar la solicitud de Natalia Ascanio para ${nombre}`) }).click();
  await expect(page.getByText(`Aprobar marca a ${nombre} como adoptada`)).toBeVisible();
  await page.screenshot({ path: `${EVIDENCIAS}/03-revision-en-panel.png`, animations: "disabled" });
  await page.getByRole("button", { name: "Aprobar adopción" }).click();
  await expect(page.getByRole("status").getByText(`Aprobaste la adopción de ${nombre}.`)).toBeVisible();

  await page.goto(seguimiento.replace("?nueva=1", ""));
  await expect(page.getByText("Aprobada", { exact: true }).first()).toBeVisible();
  await page.screenshot({ path: `${EVIDENCIAS}/04-solicitud-aprobada.png`, fullPage: true, animations: "disabled" });

  await page.goto(`/mascotas/${id}`);
  await expect(page.getByRole("heading", { name: `${nombre} ya encontró hogar` })).toBeVisible();
  await expect(page.getByRole("button", { name: "Enviar solicitud" })).toHaveCount(0);

  await page.goto(`/?q=${nombre}`);
  await expect(page.getByText("Ninguna mascota coincide")).toBeVisible();
  await page.goto(`/?q=${nombre}&todas=1`);
  await expect(page.getByText("Adoptada", { exact: true })).toBeVisible();
});

test("rechazo: exige motivo, lo muestra en el seguimiento y la mascota sigue disponible", async ({ page }) => {
  const nombre = `Guama${Date.now()}`;
  const { id } = await crearMascota(nombre);
  const seguimiento = await solicitar(page, nombre, id, `natalia${Date.now()}@correo.co`);

  await entrarAlPanel(page);
  await page.getByRole("button", { name: new RegExp(`para ${nombre}`) }).click();
  await page.getByRole("button", { name: "Rechazar" }).click();
  await page.getByRole("button", { name: "Confirmar rechazo" }).click();
  await expect(page.getByText("Explica el motivo")).toBeVisible();
  await page.getByLabel("Motivo del rechazo").fill("La vivienda no tiene espacio suficiente.");
  await page.getByRole("button", { name: "Confirmar rechazo" }).click();
  await expect(page.getByRole("status").getByText("Rechazaste la solicitud")).toBeVisible();

  await page.goto(seguimiento);
  await expect(page.getByText("La vivienda no tiene espacio suficiente.")).toBeVisible();
  await page.goto(`/mascotas/${id}`);
  await expect(page.getByRole("button", { name: "Enviar solicitud" })).toBeVisible();
});

test("si la mascota deja de estar disponible mientras se llena el formulario, la API rechaza la solicitud", async ({ page }) => {
  const nombre = `Lulo${Date.now()}`;
  const { id } = await crearMascota(nombre);
  await page.goto(`/mascotas/${id}`);
  await page.getByLabel("Nombre completo").fill("Yeimy Carrascal");
  await page.getByLabel("Correo").fill(`yeimy${Date.now()}@correo.co`);
  await page.getByLabel("Teléfono").fill("3001234567");
  await page.getByLabel("Ciudad").fill("Ocaña");
  await page.getByLabel(/¿Por qué quieres adoptar/).fill("Vivo con mi familia y tenemos experiencia con perros.");

  const api = await request.newContext();
  const cambio = await api.patch(`${API_MASCOTAS}/mascotas/${id}`, {
    headers: { "X-Admin-Key": CLAVE },
    data: { estado: "en_tratamiento" },
  });
  expect(cambio.ok()).toBeTruthy();

  await page.getByRole("button", { name: "Enviar solicitud" }).click();
  await expect(page.getByRole("alert")).toContainText("no está disponible");
});

test("validación: muestra el error junto al campo y enfoca el primero", async ({ page }) => {
  const nombre = `Pera${Date.now()}`;
  const { id } = await crearMascota(nombre);
  await page.goto(`/mascotas/${id}`);
  await page.getByRole("button", { name: "Enviar solicitud" }).click();
  await expect(page.getByText("Escribe tu nombre completo.")).toBeVisible();
  await expect(page.getByLabel("Nombre completo")).toBeFocused();
});

test("el panel rechaza una clave incorrecta", async ({ page }) => {
  await page.goto("/panel");
  await page.getByLabel("Clave de administración").fill("clave-equivocada");
  await page.getByRole("button", { name: "Entrar al panel" }).click();
  await expect(page.getByText("Esa clave no es correcta")).toBeVisible();
});

test("catálogo en escritorio y teléfono, sin desbordes horizontales", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("hogar");
  await expect(page.getByRole("heading", { name: "Canela" })).toBeVisible();
  await page.screenshot({ path: `${EVIDENCIAS}/01-catalogo.png`, animations: "disabled" });

  for (const ancho of [375, 320]) {
    await page.setViewportSize({ width: ancho, height: 760 });
    const desborde = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(desborde).toBeLessThanOrEqual(0);
  }
  await page.setViewportSize({ width: 375, height: 760 });
  await page.screenshot({ path: `${EVIDENCIAS}/01-catalogo-telefono.png`, animations: "disabled" });
});
