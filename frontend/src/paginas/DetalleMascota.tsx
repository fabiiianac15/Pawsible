import { useEffect, useRef, useState, type FormEvent } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { adopcionesApi, ApiError, mascotasApi, type Mascota, type Vivienda } from "../api";
import { DoodleMascota } from "../componentes/Doodles";
import { Cargando, ErrorVista, Vacio } from "../componentes/Estados";
import { SelloMascota } from "../componentes/Sello";
import { ESPECIES, edad, SEXOS, TAMANOS, VIVIENDAS } from "../formato";
import { usarDatos } from "../usarDatos";

type Errores = Partial<Record<"nombre" | "email" | "telefono" | "ciudad" | "motivacion", string>>;
const MINIMO_MOTIVACION = 20;

function validar(f: FormData): Errores {
  const errores: Errores = {};
  const texto = (k: string) => String(f.get(k) ?? "").trim();
  if (texto("nombre").length < 3) errores.nombre = "Escribe tu nombre completo.";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(texto("email"))) errores.email = "Escribe un correo válido, como laura@correo.co.";
  if (!/^\+?[0-9 ]{7,20}$/.test(texto("telefono"))) errores.telefono = "Escribe solo números, mínimo 7.";
  if (texto("ciudad").length < 2) errores.ciudad = "Indica la ciudad donde vives.";
  if (texto("motivacion").length < MINIMO_MOTIVACION)
    errores.motivacion = `Cuéntanos un poco más: mínimo ${MINIMO_MOTIVACION} caracteres.`;
  return errores;
}

function Campo({ nombre, etiqueta, error, children }: { nombre: string; etiqueta: string; error?: string; children: React.ReactNode }) {
  return (
    <div className="campo">
      <label htmlFor={nombre}>{etiqueta}</label>
      {children}
      {error && (
        <p className="error-campo" id={`${nombre}-error`}>
          {error}
        </p>
      )}
    </div>
  );
}

function Formulario({ mascota }: { mascota: Mascota }) {
  const navegar = useNavigate();
  const formulario = useRef<HTMLFormElement>(null);
  const [errores, setErrores] = useState<Errores>({});
  const [errorGeneral, setErrorGeneral] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [editado, setEditado] = useState(false);
  const [motivacion, setMotivacion] = useState("");

  useEffect(() => {
    if (!editado) return;
    const avisar = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", avisar);
    return () => window.removeEventListener("beforeunload", avisar);
  }, [editado]);

  const enviar = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const datos = new FormData(e.currentTarget);
    const encontrados = validar(datos);
    setErrores(encontrados);
    setErrorGeneral(null);
    const primero = Object.keys(encontrados)[0];
    if (primero) {
      formulario.current?.querySelector<HTMLElement>(`[name="${primero}"]`)?.focus();
      return;
    }
    setEnviando(true);
    try {
      const solicitud = await adopcionesApi.crear({
        mascota_id: mascota.id,
        solicitante_nombre: String(datos.get("nombre")).trim(),
        solicitante_email: String(datos.get("email")).trim(),
        solicitante_telefono: String(datos.get("telefono")).trim(),
        ciudad: String(datos.get("ciudad")).trim(),
        vivienda: datos.get("vivienda") as Vivienda,
        tiene_otras_mascotas: datos.get("otras") === "on",
        motivacion: String(datos.get("motivacion")).trim(),
      });
      setEditado(false);
      navegar(`/solicitudes/${solicitud.id}?nueva=1`);
    } catch (error) {
      setErrorGeneral(error instanceof ApiError ? error.message : "No pudimos enviar la solicitud. Intenta de nuevo.");
      setEnviando(false);
    }
  };

  const propsCampo = (nombre: keyof Errores) => ({
    id: nombre,
    name: nombre,
    "aria-invalid": Boolean(errores[nombre]),
    "aria-describedby": errores[nombre] ? `${nombre}-error` : undefined,
  });

  return (
    <form ref={formulario} className="formulario" noValidate onSubmit={enviar} onChange={() => setEditado(true)}>
      <h2>Solicita adoptar a {mascota.nombre}</h2>
      {errorGeneral && (
        <p className="alerta" role="alert">
          {errorGeneral}
        </p>
      )}
      <Campo nombre="nombre" etiqueta="Nombre completo" error={errores.nombre}>
        <input {...propsCampo("nombre")} autoComplete="name" placeholder="Laura Sanjuán…" />
      </Campo>
      <div className="dos-columnas">
        <Campo nombre="email" etiqueta="Correo" error={errores.email}>
          <input {...propsCampo("email")} type="email" autoComplete="email" spellCheck={false} placeholder="laura@correo.co…" />
        </Campo>
        <Campo nombre="telefono" etiqueta="Teléfono" error={errores.telefono}>
          <input {...propsCampo("telefono")} type="tel" autoComplete="tel" inputMode="tel" placeholder="315 123 4567…" />
        </Campo>
      </div>
      <Campo nombre="ciudad" etiqueta="Ciudad" error={errores.ciudad}>
        <input {...propsCampo("ciudad")} autoComplete="address-level2" placeholder="Ocaña…" />
      </Campo>
      <fieldset className="opciones">
        <legend>¿Dónde vivirá {mascota.nombre}?</legend>
        {Object.entries(VIVIENDAS).map(([valor, texto], i) => (
          <label key={valor} className="opcion">
            <input type="radio" name="vivienda" value={valor} defaultChecked={i === 0} />
            <span>{texto}</span>
          </label>
        ))}
      </fieldset>
      <label className="casilla">
        <input type="checkbox" name="otras" />
        <span>Tengo otras mascotas en casa</span>
      </label>
      <Campo nombre="motivacion" etiqueta={`¿Por qué quieres adoptar a ${mascota.nombre}?`} error={errores.motivacion}>
        <textarea
          {...propsCampo("motivacion")}
          rows={5}
          maxLength={1000}
          value={motivacion}
          onChange={(e) => setMotivacion(e.target.value)}
          placeholder="Tengo patio cerrado y tiempo para paseos todos los días…"
        />
        <p className="ayuda datos">{motivacion.trim().length} de 1000 caracteres</p>
      </Campo>
      <button type="submit" className="boton boton-primario" disabled={enviando}>
        {enviando ? "Enviando solicitud…" : "Enviar solicitud"}
      </button>
    </form>
  );
}

export function DetalleMascota() {
  const { id = "" } = useParams();
  const { datos: mascota, error, recargar } = usarDatos(() => mascotasApi.obtener(id), [id]);

  useEffect(() => {
    if (mascota) document.title = `${mascota.nombre} · Pawsible`;
  }, [mascota]);

  if (error && (error as ApiError).status === 404 || error && (error as ApiError).status === 422) {
    return (
      <Vacio titulo="No encontramos esa mascota">
        <Link className="boton" to="/">
          Ver las mascotas
        </Link>
      </Vacio>
    );
  }
  if (error) return <ErrorVista mensaje={error.message} reintentar={recargar} />;
  if (!mascota) return <Cargando texto="Buscando la ficha…" />;

  return (
    <article className="detalle">
      <div className="detalle-ficha">
        <Link to="/" className="volver">
          Volver a las mascotas
        </Link>
        <div className="ficha-dibujo detalle-dibujo">
          <DoodleMascota especie={mascota.especie} semilla={mascota.nombre} />
          <SelloMascota estado={mascota.estado} />
        </div>
        <h1>{mascota.nombre}</h1>
        <dl className="hechos">
          <div>
            <dt>Especie</dt>
            <dd>{ESPECIES[mascota.especie]}</dd>
          </div>
          {mascota.raza && (
            <div>
              <dt>Raza</dt>
              <dd>{mascota.raza}</dd>
            </div>
          )}
          <div>
            <dt>Edad</dt>
            <dd>{edad(mascota.edad_meses)}</dd>
          </div>
          <div>
            <dt>Tamaño</dt>
            <dd>{TAMANOS[mascota.tamano]}</dd>
          </div>
          <div>
            <dt>Sexo</dt>
            <dd>{SEXOS[mascota.sexo]}</dd>
          </div>
        </dl>
        <p className="detalle-descripcion">{mascota.descripcion}</p>
      </div>

      {mascota.estado === "disponible" ? (
        <Formulario mascota={mascota} />
      ) : (
        <div className="no-disponible">
          <h2>
            {mascota.estado === "adoptada"
              ? `${mascota.nombre} ya encontró hogar`
              : `${mascota.nombre} se está recuperando`}
          </h2>
          <p>
            {mascota.estado === "adoptada"
              ? "Esta adopción ya fue aprobada, así que no recibimos más solicitudes."
              : "Podrás enviar tu solicitud cuando termine su tratamiento."}
          </p>
          <Link className="boton" to="/">
            Conocer otras mascotas
          </Link>
        </div>
      )}
    </article>
  );
}
