import type { EstadoMascota, EstadoSolicitud } from "../api";
import { ESTADOS_MASCOTA, ESTADOS_SOLICITUD } from "../formato";

export function SelloMascota({ estado }: { estado: EstadoMascota }) {
  return <span className={`sello sello-${estado}`}>{ESTADOS_MASCOTA[estado]}</span>;
}

export function SelloSolicitud({ estado }: { estado: EstadoSolicitud }) {
  return <span className={`sello sello-${estado}`}>{ESTADOS_SOLICITUD[estado]}</span>;
}
