import type { ReactNode } from "react";
import { Huella } from "./Doodles";

export function Cargando({ texto }: { texto: string }) {
  return (
    <div className="estado-vista" role="status">
      <div className="rastro-carga" aria-hidden="true">
        <Huella className="huella-carga" />
        <Huella className="huella-carga" />
        <Huella className="huella-carga" />
      </div>
      <p>{texto}</p>
    </div>
  );
}

export function ErrorVista({ mensaje, reintentar }: { mensaje: string; reintentar?: () => void }) {
  return (
    <div className="estado-vista" role="alert">
      <h2>No pudimos cargar esto</h2>
      <p>{mensaje}</p>
      {reintentar && (
        <button type="button" className="boton" onClick={reintentar}>
          Intentar de nuevo
        </button>
      )}
    </div>
  );
}

export function Vacio({ titulo, children }: { titulo: string; children?: ReactNode }) {
  return (
    <div className="estado-vista">
      <Huella className="huella-vacia" llena={false} />
      <h2>{titulo}</h2>
      {children}
    </div>
  );
}
