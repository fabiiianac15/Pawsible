import { useEffect, useRef, useState, type FormEvent } from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  adopcionesApi,
  ApiError,
  mascotasApi,
  type Especie,
  type EstadoMascota,
  type Mascota,
  type Sexo,
  type Solicitud,
  type Tamano,
} from "../api";
import { Cargando, ErrorVista, Vacio } from "../componentes/Estados";
import { SelloMascota, SelloSolicitud } from "../componentes/Sello";
import { ESPECIES, ESTADOS_MASCOTA, ESTADOS_SOLICITUD, edad, fecha, SEXOS, TAMANOS, VIVIENDAS } from "../formato";
import { usarDatos } from "../usarDatos";

const LLAVE_SESION = "pawsible.clave";

function leerClave(): string {
  try {
    return sessionStorage.getItem(LLAVE_SESION) ?? "";
  } catch {
    return "";
  }
}

function Ingreso({ alEntrar }: { alEntrar: (clave: string) => void }) {
  const [error, setError] = useState<string | null>(null);
  const [verificando, setVerificando] = useState(false);

  const enviar = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const clave = String(new FormData(e.currentTarget).get("clave") ?? "");
    setVerificando(true);
    setError(null);
    try {
      await adopcionesApi.listar({ limit: 1 }, clave);
      alEntrar(clave);
    } catch (err) {
      setError(
        (err as ApiError).status === 401
          ? "Esa clave no es correcta. Pídela a la coordinación de la fundación."
          : (err as Error).message,
      );
      setVerificando(false);
    }
  };

  return (
    <section className="pagina-angosta">
      <h1>Panel de la fundación</h1>
      <p>Aquí se revisan las solicitudes y se administran las mascotas.</p>
      <form className="formulario" onSubmit={enviar}>
        <div className="campo">
          <label htmlFor="clave">Clave de administración</label>
          <input
            id="clave"
            name="clave"
            type="password"
            required
            autoComplete="current-password"
            aria-invalid={Boolean(error)}
            aria-describedby={error ? "clave-error" : undefined}
          />
          {error && (
            <p className="error-campo" id="clave-error">
              {error}
            </p>
          )}
        </div>
        <button type="submit" className="boton boton-primario" disabled={verificando}>
          {verificando ? "Verificando…" : "Entrar al panel"}
        </button>
      </form>
    </section>
  );
}

function RevisarSolicitud({
  solicitud,
  otrasPendientes,
  clave,
  alCerrar,
  alDecidir,
}: {
  solicitud: Solicitud;
  otrasPendientes: number;
  clave: string;
  alCerrar: () => void;
  alDecidir: (mensaje: string) => void;
}) {
  const dialogo = useRef<HTMLDialogElement>(null);
  const [rechazando, setRechazando] = useState(false);
  const [motivo, setMotivo] = useState("");
  const [errorMotivo, setErrorMotivo] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);

  useEffect(() => {
    dialogo.current?.showModal();
  }, []);

  const ejecutar = async (accion: () => Promise<unknown>, mensaje: string) => {
    setOcupado(true);
    setError(null);
    try {
      await accion();
      alDecidir(mensaje);
    } catch (err) {
      setError((err as Error).message);
      setOcupado(false);
    }
  };

  const rechazar = (e: FormEvent) => {
    e.preventDefault();
    if (motivo.trim().length < 5) {
      setErrorMotivo("Explica el motivo: quien solicitó lo verá en su seguimiento.");
      return;
    }
    void ejecutar(
      () => adopcionesApi.rechazar(solicitud.id, motivo.trim(), clave),
      `Rechazaste la solicitud de ${solicitud.solicitante_nombre}.`,
    );
  };

  return (
    <dialog ref={dialogo} className="dialogo" onClose={alCerrar} aria-labelledby="titulo-revision">
      <h2 id="titulo-revision">
        {solicitud.solicitante_nombre} quiere adoptar a {solicitud.mascota_nombre}
      </h2>
      <dl className="hechos">
        <div>
          <dt>Correo</dt>
          <dd>
            <a href={`mailto:${solicitud.solicitante_email}`}>{solicitud.solicitante_email}</a>
          </dd>
        </div>
        <div>
          <dt>Teléfono</dt>
          <dd>
            <a href={`tel:${solicitud.solicitante_telefono.replace(/ /g, "")}`}>{solicitud.solicitante_telefono}</a>
          </dd>
        </div>
        <div>
          <dt>Vivienda</dt>
          <dd>
            {VIVIENDAS[solicitud.vivienda]} en {solicitud.ciudad}
          </dd>
        </div>
        <div>
          <dt>Otras mascotas</dt>
          <dd>{solicitud.tiene_otras_mascotas ? "Sí" : "No"}</dd>
        </div>
      </dl>
      <blockquote className="motivacion">{solicitud.motivacion}</blockquote>

      {error && (
        <p className="alerta" role="alert">
          {error}
        </p>
      )}

      {rechazando ? (
        <form onSubmit={rechazar} noValidate>
          <div className="campo">
            <label htmlFor="motivo">Motivo del rechazo</label>
            <textarea
              id="motivo"
              rows={3}
              maxLength={500}
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              aria-invalid={Boolean(errorMotivo)}
              aria-describedby={errorMotivo ? "motivo-error" : undefined}
              placeholder="La vivienda no tiene espacio para un perro grande…"
            />
            {errorMotivo && (
              <p className="error-campo" id="motivo-error">
                {errorMotivo}
              </p>
            )}
          </div>
          <div className="acciones">
            <button type="button" className="boton" onClick={() => setRechazando(false)} disabled={ocupado}>
              Volver
            </button>
            <button type="submit" className="boton boton-peligro" disabled={ocupado}>
              {ocupado ? "Rechazando…" : "Confirmar rechazo"}
            </button>
          </div>
        </form>
      ) : (
        <>
          <p className="aviso-aprobar">
            Aprobar marca a {solicitud.mascota_nombre} como adoptada
            {otrasPendientes > 0
              ? ` y rechaza ${otrasPendientes === 1 ? "la otra solicitud pendiente" : `las otras ${otrasPendientes} solicitudes pendientes`}`
              : ""}
            . No se puede deshacer.
          </p>
          <div className="acciones">
            <button type="button" className="boton" onClick={() => dialogo.current?.close()} disabled={ocupado}>
              Cerrar
            </button>
            <button type="button" className="boton boton-peligro-suave" onClick={() => setRechazando(true)} disabled={ocupado}>
              Rechazar
            </button>
            <button
              type="button"
              className="boton boton-primario"
              disabled={ocupado}
              onClick={() =>
                void ejecutar(
                  () => adopcionesApi.aprobar(solicitud.id, clave),
                  `Aprobaste la adopción de ${solicitud.mascota_nombre}.`,
                )
              }
            >
              {ocupado ? "Aprobando…" : "Aprobar adopción"}
            </button>
          </div>
        </>
      )}
    </dialog>
  );
}

function VistaSolicitudes({ clave, avisar, alExpirar }: { clave: string; avisar: (m: string) => void; alExpirar: () => void }) {
  const [params, setParams] = useSearchParams();
  const estado = params.get("estado") ?? "pendiente";
  const [abierta, setAbierta] = useState<Solicitud | null>(null);
  const { datos, error, recargar } = usarDatos(
    () => adopcionesApi.listar({ estado: estado === "todas" ? undefined : estado, limit: 100 }, clave),
    [estado, clave],
  );

  useEffect(() => {
    if ((error as ApiError | null)?.status === 401) alExpirar();
  }, [error, alExpirar]);

  const filtros = [...Object.entries(ESTADOS_SOLICITUD), ["todas", "Todas"]] as [string, string][];
  const contarOtras = (s: Solicitud) =>
    datos?.items.filter((o) => o.mascota_id === s.mascota_id && o.estado === "pendiente" && o.id !== s.id).length ?? 0;

  return (
    <>
      <div className="pestanas-chicas" role="group" aria-label="Filtrar por estado">
        {filtros.map(([valor, texto]) => (
          <button
            key={valor}
            type="button"
            className="filtro"
            aria-pressed={estado === valor}
            onClick={() => {
              const nuevos = new URLSearchParams(params);
              nuevos.set("estado", valor);
              setParams(nuevos, { replace: true });
            }}
          >
            {texto}
          </button>
        ))}
      </div>
      {error && !datos ? (
        <ErrorVista mensaje={error.message} reintentar={recargar} />
      ) : !datos ? (
        <Cargando texto="Cargando solicitudes…" />
      ) : datos.items.length === 0 ? (
        <Vacio titulo={estado === "pendiente" ? "No hay solicitudes por revisar" : "No hay solicitudes en este estado"} />
      ) : (
        <div className="tabla-contenedor">
          <table className="tabla">
            <thead>
              <tr>
                <th scope="col">Mascota</th>
                <th scope="col">Solicitante</th>
                <th scope="col">Recibida</th>
                <th scope="col">Estado</th>
                <th scope="col">
                  <span className="visualmente-oculto">Acción</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {datos.items.map((s) => (
                <tr key={s.id}>
                  <td data-titulo="Mascota">
                    <Link to={`/mascotas/${s.mascota_id}`}>{s.mascota_nombre}</Link>
                  </td>
                  <td data-titulo="Solicitante">
                    {s.solicitante_nombre}
                    <span className="datos fila-secundaria">
                      {VIVIENDAS[s.vivienda]} en {s.ciudad}
                    </span>
                  </td>
                  <td data-titulo="Recibida" className="datos">
                    {fecha(s.creado_en)}
                  </td>
                  <td data-titulo="Estado">
                    <SelloSolicitud estado={s.estado} />
                  </td>
                  <td className="celda-accion">
                    {s.estado === "pendiente" ? (
                      <button
                        type="button"
                        className="boton boton-chico"
                        onClick={() => setAbierta(s)}
                        aria-label={`Revisar la solicitud de ${s.solicitante_nombre} para ${s.mascota_nombre}`}
                      >
                        Revisar
                      </button>
                    ) : (
                      <Link to={`/solicitudes/${s.id}`} className="enlace-chico">
                        Ver seguimiento
                      </Link>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {abierta && (
        <RevisarSolicitud
          solicitud={abierta}
          otrasPendientes={contarOtras(abierta)}
          clave={clave}
          alCerrar={() => setAbierta(null)}
          alDecidir={(mensaje) => {
            setAbierta(null);
            avisar(mensaje);
            void recargar();
          }}
        />
      )}
    </>
  );
}

function RegistrarMascota({ clave, alCrear }: { clave: string; alCrear: (m: Mascota) => void }) {
  const [error, setError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);

  const enviar = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formulario = e.currentTarget;
    const f = new FormData(formulario);
    setGuardando(true);
    setError(null);
    try {
      const creada = await mascotasApi.crear(
        {
          nombre: String(f.get("nombre")).trim(),
          especie: f.get("especie") as Especie,
          raza: String(f.get("raza")).trim() || null,
          edad_meses: Number(f.get("edad")),
          tamano: f.get("tamano") as Tamano,
          sexo: f.get("sexo") as Sexo,
          descripcion: String(f.get("descripcion")).trim(),
        },
        clave,
      );
      formulario.reset();
      alCrear(creada);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setGuardando(false);
    }
  };

  return (
    <details className="registrar">
      <summary>Registrar una mascota</summary>
      <form className="formulario" onSubmit={enviar}>
        {error && (
          <p className="alerta" role="alert">
            {error}
          </p>
        )}
        <div className="dos-columnas">
          <div className="campo">
            <label htmlFor="m-nombre">Nombre</label>
            <input id="m-nombre" name="nombre" required maxLength={80} autoComplete="off" placeholder="Guayaba…" />
          </div>
          <div className="campo">
            <label htmlFor="m-raza">Raza (opcional)</label>
            <input id="m-raza" name="raza" maxLength={80} autoComplete="off" placeholder="Criolla…" />
          </div>
          <div className="campo">
            <label htmlFor="m-especie">Especie</label>
            <select id="m-especie" name="especie">
              {Object.entries(ESPECIES).map(([v, t]) => (
                <option key={v} value={v}>
                  {t}
                </option>
              ))}
            </select>
          </div>
          <div className="campo">
            <label htmlFor="m-edad">Edad en meses</label>
            <input id="m-edad" name="edad" type="number" inputMode="numeric" min={0} max={360} required placeholder="18…" />
          </div>
          <div className="campo">
            <label htmlFor="m-tamano">Tamaño</label>
            <select id="m-tamano" name="tamano">
              {Object.entries(TAMANOS).map(([v, t]) => (
                <option key={v} value={v}>
                  {t}
                </option>
              ))}
            </select>
          </div>
          <div className="campo">
            <label htmlFor="m-sexo">Sexo</label>
            <select id="m-sexo" name="sexo">
              {Object.entries(SEXOS).map(([v, t]) => (
                <option key={v} value={v}>
                  {t}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="campo">
          <label htmlFor="m-descripcion">Descripción</label>
          <textarea id="m-descripcion" name="descripcion" rows={3} required maxLength={1000} placeholder="De dónde viene, cómo se comporta y qué necesita…" />
        </div>
        <button type="submit" className="boton boton-primario" disabled={guardando}>
          {guardando ? "Guardando…" : "Registrar mascota"}
        </button>
      </form>
    </details>
  );
}

function VistaMascotas({ clave, avisar }: { clave: string; avisar: (m: string) => void }) {
  const { datos, error, recargar } = usarDatos(() => mascotasApi.listar({ limit: 100 }), []);
  const [errorEstado, setErrorEstado] = useState<string | null>(null);

  const cambiarEstado = async (mascota: Mascota, estado: EstadoMascota) => {
    setErrorEstado(null);
    try {
      await mascotasApi.cambiarEstado(mascota.id, estado, clave);
      avisar(`${mascota.nombre} ahora está: ${ESTADOS_MASCOTA[estado].toLowerCase()}.`);
    } catch (err) {
      setErrorEstado((err as Error).message);
    }
    void recargar();
  };

  return (
    <>
      <RegistrarMascota
        clave={clave}
        alCrear={(m) => {
          avisar(`Registraste a ${m.nombre}. Ya aparece en el catálogo.`);
          void recargar();
        }}
      />
      {errorEstado && (
        <p className="alerta" role="alert">
          {errorEstado}
        </p>
      )}
      {error && !datos ? (
        <ErrorVista mensaje={error.message} reintentar={recargar} />
      ) : !datos ? (
        <Cargando texto="Cargando mascotas…" />
      ) : (
        <div className="tabla-contenedor">
          <table className="tabla">
            <thead>
              <tr>
                <th scope="col">Nombre</th>
                <th scope="col">Especie</th>
                <th scope="col">Edad</th>
                <th scope="col">Disponibilidad</th>
              </tr>
            </thead>
            <tbody>
              {datos.items.map((m) => (
                <tr key={m.id}>
                  <td data-titulo="Nombre">
                    <Link to={`/mascotas/${m.id}`}>{m.nombre}</Link>
                  </td>
                  <td data-titulo="Especie">{ESPECIES[m.especie]}</td>
                  <td data-titulo="Edad" className="datos">
                    {edad(m.edad_meses)}
                  </td>
                  <td data-titulo="Disponibilidad">
                    {m.estado === "adoptada" ? (
                      <SelloMascota estado={m.estado} />
                    ) : (
                      <select
                        aria-label={`Disponibilidad de ${m.nombre}`}
                        value={m.estado}
                        onChange={(e) => void cambiarEstado(m, e.target.value as EstadoMascota)}
                      >
                        <option value="disponible">Disponible</option>
                        <option value="en_tratamiento">En tratamiento</option>
                      </select>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

export function Panel() {
  const [clave, setClave] = useState(leerClave);
  const [params, setParams] = useSearchParams();
  const [aviso, setAviso] = useState("");
  const vista = params.get("vista") === "mascotas" ? "mascotas" : "solicitudes";

  useEffect(() => {
    document.title = "Panel de la fundación · Pawsible";
  }, []);

  useEffect(() => {
    if (!aviso) return;
    const espera = setTimeout(() => setAviso(""), 6000);
    return () => clearTimeout(espera);
  }, [aviso]);

  const guardarClave = (nueva: string) => {
    try {
      if (nueva) sessionStorage.setItem(LLAVE_SESION, nueva);
      else sessionStorage.removeItem(LLAVE_SESION);
    } catch {
      // Sin almacenamiento la clave solo dura hasta recargar la página.
    }
    setClave(nueva);
  };

  if (!clave) return <Ingreso alEntrar={guardarClave} />;

  return (
    <section className="panel">
      <div className="panel-cabecera">
        <h1>Panel de la fundación</h1>
        <button type="button" className="boton boton-chico" onClick={() => guardarClave("")}>
          Salir
        </button>
      </div>
      <nav className="pestanas" aria-label="Secciones del panel">
        <Link to="?vista=solicitudes" aria-current={vista === "solicitudes" ? "page" : undefined}>
          Solicitudes
        </Link>
        <Link to="?vista=mascotas" aria-current={vista === "mascotas" ? "page" : undefined}>
          Mascotas
        </Link>
      </nav>
      {vista === "solicitudes" ? (
        <VistaSolicitudes
          clave={clave}
          avisar={setAviso}
          alExpirar={() => {
            guardarClave("");
            setParams({}, { replace: true });
          }}
        />
      ) : (
        <VistaMascotas clave={clave} avisar={setAviso} />
      )}
      <p className="aviso" role="status" aria-live="polite" data-visible={Boolean(aviso)}>
        {aviso}
      </p>
    </section>
  );
}
