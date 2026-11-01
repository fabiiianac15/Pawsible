import secrets

from fastapi import Depends, HTTPException, status
from fastapi.security import APIKeyHeader

from .config import settings

_admin = APIKeyHeader(name="X-Admin-Key", auto_error=False, description="Clave del panel de la fundación.")


def requiere_admin(clave: str | None = Depends(_admin)) -> None:
    if clave is None or not secrets.compare_digest(clave.encode(), settings.admin_api_key.encode()):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Clave de administración inválida.")
