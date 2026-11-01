import { useCallback, useEffect, useRef, useState } from "react";

/** Carga datos, ignora respuestas viejas y expone un reintento. */
export function usarDatos<T>(cargar: () => Promise<T>, dependencias: unknown[]) {
  const [datos, setDatos] = useState<T | null>(null);
  const [error, setError] = useState<(Error & { status?: number }) | null>(null);
  const [cargando, setCargando] = useState(true);
  const turno = useRef(0);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const recargar = useCallback(async () => {
    const actual = ++turno.current;
    setCargando(true);
    try {
      const resultado = await cargar();
      if (actual === turno.current) {
        setDatos(resultado);
        setError(null);
      }
    } catch (e) {
      if (actual === turno.current) setError(e as Error);
    } finally {
      if (actual === turno.current) setCargando(false);
    }
  }, dependencias);

  useEffect(() => {
    void recargar();
  }, [recargar]);

  return { datos, error, cargando, recargar };
}
