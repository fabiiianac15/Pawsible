import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { mascotasApi, type Mascota } from "../api";
import { DoodleMascota, Huella, Subrayado } from "../componentes/Doodles";
import { Cargando, ErrorVista, Vacio } from "../componentes/Estados";
import { SelloMascota } from "../componentes/Sello";
import { ESPECIES, edad, SEXOS, TAMANOS } from "../formato";
import { usarDatos } from "../usarDatos";

const POR_PAGINA = 24;

function Ficha({ mascota, indice }: { mascota: Mascota; indice: number }) {
  return (
    <li className="ficha" data-inclinacion={indice % 3} data-estado={mascota.estado}>
      <Link to={`/mascotas/${mascota.id}`} className="ficha-enlace">
        <div className="ficha-dibujo">
          <DoodleMascota especie={mascota.especie} semilla={mascota.nombre} />
          <SelloMascota estado={mascota.estado} />
        </div>
        <h3>{mascota.nombre}</h3>
        <p className="datos">
          {ESPECIES[mascota.especie]} · {edad(mascota.edad_meses)}
          <br />
          {TAMANOS[mascota.tamano]} · {SEXOS[mascota.sexo]}
        </p>
        <p className="ficha-descripcion">{mascota.descripcion}</p>
      </Link>
    </li>
  );
}

export function Catalogo() {
  const [params, setParams] = useSearchParams();
  const especie = params.get("especie") ?? "";
  const tamano = params.get("tamano") ?? "";
  const todas = params.get("todas") === "1";
  const q = params.get("q") ?? "";
  const [busqueda, setBusqueda] = useState(q);
  const [limite, setLimite] = useState(POR_PAGINA);

  useEffect(() => {
    document.title = "Mascotas en adopción · Pawsible";
  }, []);

  const cambiar = (clave: string, valor: string) => {
    setLimite(POR_PAGINA);
    setParams(
      (actuales) => {
        const nuevos = new URLSearchParams(actuales);
        if (valor) nuevos.set(clave, valor);
        else nuevos.delete(clave);
        return nuevos;
      },
      { replace: true },
    );
  };

  // La búsqueda espera a que la persona deje de escribir para no llamar a la API en cada tecla.
  useEffect(() => {
    if (busqueda === q) return;
    const espera = setTimeout(() => cambiar("q", busqueda.trim()), 250);
    return () => clearTimeout(espera);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [busqueda]);

  const { datos, error, cargando, recargar } = usarDatos(
    () => mascotasApi.listar({ especie, tamano, q, estado: todas ? undefined : "disponible", limit: limite }),
    [especie, tamano, q, todas, limite],
  );
  const esperando = usarDatos(() => mascotasApi.listar({ estado: "disponible", limit: 1 }), []);
  const hayFiltros = Boolean(especie || tamano || q || todas);

  return (
    <>
      <section className="portada">
        <div className="portada-texto">
          <h1>
            {esperando.datos ? (
              <>
                <span className="cifra">{esperando.datos.total}</span>{" "}
                {esperando.datos.total === 1 ? "animal busca" : "animales buscan"}{" "}
              </>
            ) : (
              "Ellos buscan "
            )}
            <span className="con-subrayado">
              hogar
              <Subrayado />
            </span>{" "}
            en Ocaña
          </h1>
          <p>
            Conoce a los animales de la Fundación Huellas de Esperanza y envía tu solicitud. La fundación la revisa y
            puedes seguirla con tu código, sin llamar ni hacer filas.
          </p>
        </div>
        <div className="portada-dibujo" aria-hidden="true">
          <DoodleMascota especie="gato" semilla="b" className="portada-gato" />
          <DoodleMascota especie="perro" semilla="Canela!" className="portada-perro" />
          <Huella className="rastro r1" />
          <Huella className="rastro r2" />
          <Huella className="rastro r3" />
        </div>
      </section>

      <section aria-labelledby="titulo-catalogo" className="catalogo">
        <h2 id="titulo-catalogo" className="visualmente-oculto">
          Catálogo de mascotas
        </h2>
        <form className="filtros" role="search" onSubmit={(e) => e.preventDefault()}>
          <label className="campo campo-busqueda">
            <span>Nombre</span>
            <input
              type="search"
              name="q"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              placeholder="Canela…"
              autoComplete="off"
              spellCheck={false}
            />
          </label>
          <label className="campo">
            <span>Especie</span>
            <select name="especie" value={especie} onChange={(e) => cambiar("especie", e.target.value)}>
              <option value="">Todas</option>
              {Object.entries(ESPECIES).map(([valor, texto]) => (
                <option key={valor} value={valor}>
                  {texto}
                </option>
              ))}
            </select>
          </label>
          <label className="campo">
            <span>Tamaño</span>
            <select name="tamano" value={tamano} onChange={(e) => cambiar("tamano", e.target.value)}>
              <option value="">Todos</option>
              {Object.entries(TAMANOS).map(([valor, texto]) => (
                <option key={valor} value={valor}>
                  {texto}
                </option>
              ))}
            </select>
          </label>
          <label className="casilla">
            <input type="checkbox" checked={todas} onChange={(e) => cambiar("todas", e.target.checked ? "1" : "")} />
            <span>Incluir adoptadas y en tratamiento</span>
          </label>
        </form>

        {error && !datos ? (
          <ErrorVista mensaje={error.message} reintentar={recargar} />
        ) : !datos ? (
          <Cargando texto="Buscando mascotas…" />
        ) : datos.items.length === 0 ? (
          <Vacio titulo={hayFiltros ? "Ninguna mascota coincide con esa búsqueda" : "Hoy no hay mascotas disponibles"}>
            {hayFiltros ? (
              <button
                type="button"
                className="boton"
                onClick={() => {
                  setBusqueda("");
                  setParams({}, { replace: true });
                }}
              >
                Quitar filtros
              </button>
            ) : (
              <p>La fundación publica nuevos animales apenas terminan su valoración.</p>
            )}
          </Vacio>
        ) : (
          <>
            <p className="conteo datos" aria-live="polite">
              {datos.total} {datos.total === 1 ? "mascota" : "mascotas"}
            </p>
            <ul className="fichas" aria-busy={cargando}>
              {datos.items.map((mascota, i) => (
                <Ficha key={mascota.id} mascota={mascota} indice={i} />
              ))}
            </ul>
            {datos.items.length < datos.total && (
              <button type="button" className="boton ver-mas" onClick={() => setLimite((l) => l + POR_PAGINA)}>
                Ver más mascotas
              </button>
            )}
          </>
        )}
      </section>
    </>
  );
}
