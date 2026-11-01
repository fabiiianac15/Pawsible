export const URL_MASCOTAS = import.meta.env.VITE_MASCOTAS_API_URL ?? "http://localhost:8001";
export const URL_ADOPCIONES = import.meta.env.VITE_ADOPCIONES_API_URL ?? "http://localhost:8002";

export type Especie = "perro" | "gato" | "conejo";
export type Tamano = "pequeno" | "mediano" | "grande";
export type Sexo = "macho" | "hembra";
export type EstadoMascota = "disponible" | "en_tratamiento" | "adoptada";
export type EstadoSolicitud = "pendiente" | "aprobada" | "rechazada";
export type Vivienda = "casa" | "apartamento" | "finca";

export interface Mascota {
  id: string;
  nombre: string;
  especie: Especie;
  raza: string | null;
  edad_meses: number;
  tamano: Tamano;
  sexo: Sexo;
  descripcion: string;
  foto_url: string | null;
  estado: EstadoMascota;
}

export interface MascotaNueva {
  nombre: string;
  especie: Especie;
  raza: string | null;
  edad_meses: number;
  tamano: Tamano;
  sexo: Sexo;
  descripcion: string;
}

export interface Solicitud {
  id: string;
  mascota_id: string;
  mascota_nombre: string;
  solicitante_nombre: string;
  solicitante_email: string;
  solicitante_telefono: string;
  ciudad: string;
  vivienda: Vivienda;
  tiene_otras_mascotas: boolean;
  motivacion: string;
  estado: EstadoSolicitud;
  motivo_rechazo: string | null;
  creado_en: string;
  decidido_en: string | null;
}

export type SolicitudNueva = Pick<
  Solicitud,
  | "mascota_id"
  | "solicitante_nombre"
  | "solicitante_email"
  | "solicitante_telefono"
  | "ciudad"
  | "vivienda"
  | "tiene_otras_mascotas"
  | "motivacion"
>;

interface Pagina<T> {
  items: T[];
  total: number;
}

export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

async function pedir<T>(base: string, ruta: string, init: RequestInit = {}, clave?: string): Promise<T> {
  let respuesta: Response;
  try {
    respuesta = await fetch(base + ruta, {
      ...init,
      headers: {
        ...(init.body ? { "Content-Type": "application/json" } : {}),
        ...(clave ? { "X-Admin-Key": clave } : {}),
      },
    });
  } catch {
    throw new ApiError(0, "No hay conexión con el servicio. Revisa tu internet e intenta de nuevo.");
  }
  if (respuesta.ok) return (respuesta.status === 204 ? undefined : await respuesta.json()) as T;

  const cuerpo = await respuesta.json().catch(() => null);
  const detalle = typeof cuerpo?.detail === "string" ? cuerpo.detail : null;
  throw new ApiError(respuesta.status, detalle ?? "Los datos enviados no son válidos. Revísalos e intenta de nuevo.");
}

const consulta = (filtros: Record<string, string | number | undefined>) => {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(filtros)) if (v !== undefined && v !== "") p.set(k, String(v));
  const texto = p.toString();
  return texto ? `?${texto}` : "";
};

export const mascotasApi = {
  listar: (filtros: { estado?: string; especie?: string; tamano?: string; q?: string; limit?: number }) =>
    pedir<Pagina<Mascota>>(URL_MASCOTAS, `/mascotas${consulta(filtros)}`),
  obtener: (id: string) => pedir<Mascota>(URL_MASCOTAS, `/mascotas/${id}`),
  crear: (datos: MascotaNueva, clave: string) =>
    pedir<Mascota>(URL_MASCOTAS, "/mascotas", { method: "POST", body: JSON.stringify(datos) }, clave),
  cambiarEstado: (id: string, estado: EstadoMascota, clave: string) =>
    pedir<Mascota>(URL_MASCOTAS, `/mascotas/${id}`, { method: "PATCH", body: JSON.stringify({ estado }) }, clave),
};

export const adopcionesApi = {
  crear: (datos: SolicitudNueva) =>
    pedir<Solicitud>(URL_ADOPCIONES, "/solicitudes", { method: "POST", body: JSON.stringify(datos) }),
  obtener: (id: string) => pedir<Solicitud>(URL_ADOPCIONES, `/solicitudes/${id}`),
  listar: (filtros: { estado?: string; limit?: number }, clave: string) =>
    pedir<Pagina<Solicitud>>(URL_ADOPCIONES, `/solicitudes${consulta(filtros)}`, {}, clave),
  aprobar: (id: string, clave: string) =>
    pedir<Solicitud>(URL_ADOPCIONES, `/solicitudes/${id}/aprobar`, { method: "POST" }, clave),
  rechazar: (id: string, motivo: string, clave: string) =>
    pedir<Solicitud>(
      URL_ADOPCIONES,
      `/solicitudes/${id}/rechazar`,
      { method: "POST", body: JSON.stringify({ motivo }) },
      clave,
    ),
};
