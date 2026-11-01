import { useEffect } from "react";
import { Link, NavLink, Route, Routes, useLocation } from "react-router-dom";
import { URL_ADOPCIONES, URL_MASCOTAS } from "./api";
import { Huella } from "./componentes/Doodles";
import { Vacio } from "./componentes/Estados";
import { Catalogo } from "./paginas/Catalogo";
import { DetalleMascota } from "./paginas/DetalleMascota";
import { Panel } from "./paginas/Panel";
import { Seguimiento } from "./paginas/Seguimiento";
import { VerSolicitud } from "./paginas/VerSolicitud";

export function App() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);

  return (
    <>
      <a className="saltar" href="#contenido">
        Saltar al contenido
      </a>
      <header className="cabecera">
        <Link to="/" className="marca">
          <Huella className="marca-huella" />
          <span translate="no">Pawsible</span>
        </Link>
        <nav aria-label="Principal" className="nav">
          <NavLink to="/" end>
            Mascotas
          </NavLink>
          <NavLink to="/seguimiento">Mi solicitud</NavLink>
          <NavLink to="/panel">Fundación</NavLink>
        </nav>
      </header>
      <main id="contenido" tabIndex={-1}>
        <Routes>
          <Route path="/" element={<Catalogo />} />
          <Route path="/mascotas/:id" element={<DetalleMascota />} />
          <Route path="/seguimiento" element={<Seguimiento />} />
          <Route path="/solicitudes/:id" element={<VerSolicitud />} />
          <Route path="/panel" element={<Panel />} />
          <Route
            path="*"
            element={
              <Vacio titulo="Este camino no lleva a ninguna parte">
                <Link className="boton" to="/">
                  Ver las mascotas
                </Link>
              </Vacio>
            }
          />
        </Routes>
      </main>
      <footer className="pie">
        <p>Fundación Huellas de Esperanza</p>
        <p className="pie-enlaces">
          Documentación: <a href={`${URL_MASCOTAS}/docs`}>API de Mascotas</a> ·{" "}
          <a href={`${URL_ADOPCIONES}/docs`}>API de Adopciones</a>
        </p>
      </footer>
    </>
  );
}
