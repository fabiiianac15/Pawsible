"""Cliente HTTP de la API de Mascotas: la única vía de este servicio hacia esos datos."""
import uuid
from dataclasses import dataclass

import httpx

from .config import settings


class MascotaNoEncontrada(Exception):
    pass


class MascotaNoDisponible(Exception):
    def __init__(self, detalle: str) -> None:
        super().__init__(detalle)
        self.detalle = detalle


class MascotasNoResponde(Exception):
    pass


@dataclass(frozen=True)
class Disponibilidad:
    nombre: str
    estado: str
    disponible: bool


def _pedir(metodo: str, ruta: str, **kwargs) -> httpx.Response:
    """Reintenta una vez: todas las operaciones de este cliente son idempotentes."""
    ultimo_error: Exception | None = None
    with httpx.Client(
        base_url=settings.mascotas_api_url,
        timeout=settings.mascotas_timeout_segundos,
        headers={"X-Service-Key": settings.internal_api_key},
    ) as cliente:
        for _ in range(2):
            try:
                respuesta = cliente.request(metodo, ruta, **kwargs)
            except httpx.TransportError as error:
                ultimo_error = error
                continue
            if respuesta.status_code >= 500:
                ultimo_error = httpx.HTTPStatusError("5xx", request=respuesta.request, response=respuesta)
                continue
            return respuesta
    raise MascotasNoResponde from ultimo_error


def _validar(respuesta: httpx.Response) -> httpx.Response:
    if respuesta.status_code == 404:
        raise MascotaNoEncontrada
    if respuesta.status_code == 409:
        raise MascotaNoDisponible(respuesta.json().get("detail", "La mascota no está disponible."))
    if respuesta.is_error:
        # 401 o 422: error de configuración o de contrato entre servicios, no del usuario.
        raise MascotasNoResponde(f"Mascotas respondió {respuesta.status_code}")
    return respuesta


def consultar_disponibilidad(mascota_id: uuid.UUID) -> Disponibilidad:
    datos = _validar(_pedir("GET", f"/mascotas/{mascota_id}/disponibilidad")).json()
    return Disponibilidad(nombre=datos["nombre"], estado=datos["estado"], disponible=datos["disponible"])


def registrar_adopcion(mascota_id: uuid.UUID, solicitud_id: uuid.UUID) -> None:
    _validar(_pedir("PUT", f"/mascotas/{mascota_id}/adopcion", json={"solicitud_id": str(solicitud_id)}))


def revertir_adopcion(mascota_id: uuid.UUID, solicitud_id: uuid.UUID) -> None:
    _validar(_pedir("DELETE", f"/mascotas/{mascota_id}/adopcion", params={"solicitud_id": str(solicitud_id)}))
