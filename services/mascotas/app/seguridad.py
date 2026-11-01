import secrets

from fastapi import Depends, HTTPException, status
from fastapi.security import APIKeyHeader

from .config import settings

_admin = APIKeyHeader(name="X-Admin-Key", auto_error=False, description="Clave del panel de la fundación.")
_servicio = APIKeyHeader(name="X-Service-Key", auto_error=False, description="Clave entre servicios.")


def _coincide(recibida: str | None, esperada: str) -> bool:
    return recibida is not None and secrets.compare_digest(recibida.encode(), esperada.encode())


def requiere_admin(clave: str | None = Depends(_admin)) -> None:
    if not _coincide(clave, settings.admin_api_key):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Clave de administración inválida.")


def requiere_servicio(clave: str | None = Depends(_servicio)) -> None:
    if not _coincide(clave, settings.internal_api_key):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Clave de servicio inválida.")
