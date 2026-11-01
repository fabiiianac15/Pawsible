import type { Especie, EstadoMascota, EstadoSolicitud, Sexo, Tamano, Vivienda } from "./api";

export const ESPECIES: Record<Especie, string> = { perro: "Perro", gato: "Gato", conejo: "Conejo" };
export const TAMANOS: Record<Tamano, string> = { pequeno: "Pequeño", mediano: "Mediano", grande: "Grande" };
export const SEXOS: Record<Sexo, string> = { macho: "Macho", hembra: "Hembra" };
export const VIVIENDAS: Record<Vivienda, string> = { casa: "Casa", apartamento: "Apartamento", finca: "Finca" };
export const ESTADOS_MASCOTA: Record<EstadoMascota, string> = {
  disponible: "Disponible",
  en_tratamiento: "En tratamiento",
  adoptada: "Adoptada",
};
export const ESTADOS_SOLICITUD: Record<EstadoSolicitud, string> = {
  pendiente: "Pendiente",
  aprobada: "Aprobada",
  rechazada: "Rechazada",
};

export function edad(meses: number): string {
  if (meses < 12) return `${meses} ${meses === 1 ? "mes" : "meses"}`;
  const anios = Math.floor(meses / 12);
  const resto = meses % 12;
  const texto = `${anios} ${anios === 1 ? "año" : "años"}`;
  return resto ? `${texto} y ${resto} ${resto === 1 ? "mes" : "meses"}` : texto;
}

const fechaLarga = new Intl.DateTimeFormat("es-CO", { dateStyle: "medium", timeStyle: "short" });
export const fecha = (iso: string) => fechaLarga.format(new Date(iso));
