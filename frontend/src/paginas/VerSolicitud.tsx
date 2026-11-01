import { useEffect, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { adopcionesApi, ApiError, type Solicitud } from "../api";
import { Huella } from "../componentes/Doodles";
import { Cargando, ErrorVista, Vacio } from "../componentes/Estados";
import { SelloSolicitud } from "../componentes/Sello";
import { fecha } from "../formato";
import { usarDatos } from "../usarDatos";

/** El avance de la solicitud se lee como un rastro de huellas. */
function Rastro({ solicitud }: { solicitud: Solicitud }) {
  const decidida = solicitud.estado !== "pendiente";
  const pasos = [
    { titulo: "Recibida", detalle: fecha(solicitud.creado_en), hecho: true },
    {
      titulo: "En revisión",
      detalle: decidida ? "Revisada por la fundación" : "La fundación está leyendo tu solicitud",
      hecho: true,
      actual: !decidida,
    },
    {
      titulo: solicitud.estado === "aprobada" ? "Aprobada" : solicitud.estado === "rechazada" ? "Rechazada" : "Decisión",
      detalle: solicitud.decidido_en ? fecha(solicitud.decidido_en) : "Todavía sin decidir",
      hecho: decidida,
    },
  ];
  return (
    <ol className="rastro-solicitud" data-estado={solicitud.estado}>
      {pasos.map((paso, i) => (
        <li key={paso.titulo} className={paso.hecho ? "hecho" : "por-venir"} aria-current={paso.actual ? "step" : undefined} style={{ "--i": i } as React.CSSProperties}>
          <Huella className="huella-paso" llena={paso.hecho} />
          <div>
            <strong>{paso.titulo}</strong>
            <span className="datos">{paso.detalle}</span>
          </div>
        </li>
      ))}
    </ol>
  );
}

function CopiarCodigo({ codigo }: { codigo: string }) {
  const [copiado, setCopiado] = useState(false);
  const copiar = async () => {
    await navigator.clipboard.writeText(codigo);
    setCopiado(true);
    setTimeout(() => setCopiado(false), 2000);
  };
  return (
    <div className="codigo">
      <code translate="no">{codigo}</code>
      <button type="button" className="boton boton-chico" onClick={copiar}>
        Copiar código
      </button>
      <span aria-live="polite" className="datos">
        {copiado ? "Copiado" : ""}
      </span>
    </div>
  );
}

export function VerSolicitud() {
  const { id = "" } = useParams();
  const [params] = useSearchParams();
  const { datos: solicitud, error, recargar } = usarDatos(() => adopcionesApi.obtener(id), [id]);

  useEffect(() => {
    document.title = "Tu solicitud · Pawsible";
  }, []);

  if (error && [404, 422].includes((error as ApiError).status)) {
    return (
      <Vacio titulo="No encontramos esa solicitud">
        <p>Revisa que el código esté completo.</p>
        <Link className="boton" to="/seguimiento">
          Escribir otro código
        </Link>
      </Vacio>
    );
  }
  if (error) return <ErrorVista mensaje={error.message} reintentar={recargar} />;
  if (!solicitud) return <Cargando texto="Buscando tu solicitud…" />;

  return (
    <section className="pagina-angosta">
      <div className="titulo-con-sello">
        <h1>
          {params.get("nueva")
            ? `Recibimos tu solicitud para ${solicitud.mascota_nombre}`
            : `Tu solicitud para ${solicitud.mascota_nombre}`}
        </h1>
        <SelloSolicitud estado={solicitud.estado} />
      </div>

      <Rastro solicitud={solicitud} />

      {solicitud.estado === "aprobada" && (
        <p className="nota nota-buena">
          La fundación te contactará al {solicitud.solicitante_telefono} para coordinar la entrega de{" "}
          {solicitud.mascota_nombre}.
        </p>
      )}
      {solicitud.estado === "rechazada" && (
        <div className="nota">
          <p>
            <strong>Motivo:</strong> {solicitud.motivo_rechazo}
          </p>
          <Link to="/">Conocer otras mascotas</Link>
        </div>
      )}

      <h2>Tu código</h2>
      <p>Guárdalo: con él vuelves a consultar esta página.</p>
      <CopiarCodigo codigo={solicitud.id} />
    </section>
  );
}
