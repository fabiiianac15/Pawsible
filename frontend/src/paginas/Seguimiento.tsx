import { useEffect, useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function Seguimiento() {
  const navegar = useNavigate();
  const [codigo, setCodigo] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    document.title = "Sigue tu solicitud · Pawsible";
  }, []);

  const enviar = (e: FormEvent) => {
    e.preventDefault();
    const limpio = codigo.trim();
    if (!UUID.test(limpio)) {
      setError("Ese código no está completo. Tiene 36 caracteres; cópialo de la página que viste al enviar tu solicitud.");
      return;
    }
    navegar(`/solicitudes/${limpio}`);
  };

  return (
    <section className="pagina-angosta">
      <h1>Sigue tu solicitud</h1>
      <p>Escribe el código que recibiste al enviar la solicitud.</p>
      <form className="formulario" noValidate onSubmit={enviar}>
        <div className="campo">
          <label htmlFor="codigo">Código de solicitud</label>
          <input
            id="codigo"
            name="codigo"
            className="datos"
            value={codigo}
            onChange={(e) => setCodigo(e.target.value)}
            autoComplete="off"
            spellCheck={false}
            aria-invalid={Boolean(error)}
            aria-describedby={error ? "codigo-error" : undefined}
            placeholder="3f2a9c1e-5b7d-4e8a-9c21-7d4e5f6a8b90…"
          />
          {error && (
            <p className="error-campo" id="codigo-error">
              {error}
            </p>
          )}
        </div>
        <button type="submit" className="boton boton-primario">
          Ver mi solicitud
        </button>
      </form>
    </section>
  );
}
