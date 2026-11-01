"""Levanta las dos APIs como procesos reales contra Postgres, sin simular la comunicación HTTP."""
import os
import socket
import subprocess
import sys
import time
from collections.abc import Iterator
from pathlib import Path

import httpx
import psycopg
import pytest

RAIZ = Path(__file__).resolve().parents[2]
PG = "localhost:54329/pawsible"
ADMIN = "clave-admin-de-pruebas"
INTERNA = "clave-interna-de-pruebas"
PUERTO_MASCOTAS = 8101
PUERTO_ADOPCIONES = 8102
URL_MASCOTAS = f"http://127.0.0.1:{PUERTO_MASCOTAS}"
URL_ADOPCIONES = f"http://127.0.0.1:{PUERTO_ADOPCIONES}"
HEADERS_ADMIN = {"X-Admin-Key": ADMIN}


def _esperar(url: str, proceso: subprocess.Popen) -> None:
    for _ in range(100):
        if proceso.poll() is not None:
            raise RuntimeError(f"El proceso de {url} terminó con código {proceso.returncode}")
        try:
            if httpx.get(f"{url}/health", timeout=1).status_code == 200:
                return
        except httpx.TransportError:
            time.sleep(0.1)
    raise RuntimeError(f"{url} no inició")


def iniciar_mascotas() -> subprocess.Popen:
    entorno = {
        **os.environ,
        "DATABASE_URL": f"postgresql://mascotas_svc:mascotas_local@{PG}",
        "ADMIN_API_KEY": ADMIN,
        "INTERNAL_API_KEY": INTERNA,
    }
    proceso = subprocess.Popen(
        [sys.executable, "-m", "uvicorn", "app.main:app", "--port", str(PUERTO_MASCOTAS), "--log-level", "warning"],
        cwd=RAIZ / "services/mascotas",
        env=entorno,
    )
    _esperar(URL_MASCOTAS, proceso)
    return proceso


def iniciar_adopciones() -> subprocess.Popen:
    entorno = {
        **os.environ,
        "DATABASE_URL": f"postgresql://adopciones_svc:adopciones_local@{PG}",
        "MASCOTAS_API_URL": URL_MASCOTAS,
        "ADMIN_API_KEY": ADMIN,
        "INTERNAL_API_KEY": INTERNA,
        "MASCOTAS_TIMEOUT_SEGUNDOS": "2",
    }
    proceso = subprocess.Popen(
        [sys.executable, "-m", "uvicorn", "app.main:app", "--port", str(PUERTO_ADOPCIONES), "--log-level", "warning"],
        cwd=RAIZ / "services/adopciones",
        env=entorno,
    )
    _esperar(URL_ADOPCIONES, proceso)
    return proceso


@pytest.fixture(scope="session", autouse=True)
def base_de_datos() -> None:
    try:
        socket.create_connection(("localhost", 54329), timeout=1).close()
    except OSError:
        pytest.exit("Postgres no está activo. Ejecuta: docker compose up -d --wait db", returncode=2)


@pytest.fixture(scope="session")
def servicios() -> Iterator[dict]:
    procesos = {"mascotas": iniciar_mascotas(), "adopciones": iniciar_adopciones()}
    yield procesos
    for proceso in procesos.values():
        proceso.terminate()
        proceso.wait(timeout=10)


@pytest.fixture
def api_mascotas(servicios) -> Iterator[httpx.Client]:
    with httpx.Client(base_url=URL_MASCOTAS, timeout=15) as cliente:
        yield cliente


@pytest.fixture
def api_adopciones(servicios) -> Iterator[httpx.Client]:
    with httpx.Client(base_url=URL_ADOPCIONES, timeout=15) as cliente:
        yield cliente


@pytest.fixture
def mascota(api_mascotas: httpx.Client) -> dict:
    respuesta = api_mascotas.post(
        "/mascotas",
        headers=HEADERS_ADMIN,
        json={
            "nombre": "Guayaba",
            "especie": "perro",
            "edad_meses": 20,
            "tamano": "mediano",
            "sexo": "hembra",
            "descripcion": "Mascota creada por una prueba de integración.",
        },
    )
    assert respuesta.status_code == 201, respuesta.text
    return respuesta.json()


@pytest.fixture
def nueva_solicitud(api_adopciones: httpx.Client):
    contador = iter(range(1, 1000))

    def crear(mascota_id: str, **cambios) -> httpx.Response:
        cuerpo = {
            "mascota_id": mascota_id,
            "solicitante_nombre": "Camilo Quintero",
            "solicitante_email": f"camilo{next(contador)}@correo.co",
            "solicitante_telefono": "3151234567",
            "ciudad": "Ocaña",
            "vivienda": "casa",
            "tiene_otras_mascotas": False,
            "motivacion": "Tengo patio cerrado y tiempo para paseos todos los días.",
            **cambios,
        }
        return api_adopciones.post("/solicitudes", json=cuerpo)

    return crear


@pytest.fixture
def conexion_servicio():
    def conectar(usuario: str, clave: str) -> psycopg.Connection:
        return psycopg.connect(f"postgresql://{usuario}:{clave}@{PG}")

    return conectar
