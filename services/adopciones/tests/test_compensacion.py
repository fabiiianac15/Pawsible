"""Fallo que no se provoca desde fuera: la base falla al confirmar después de marcar la mascota."""
import os
import uuid
from unittest.mock import MagicMock

import pytest
from fastapi import HTTPException
from sqlalchemy.exc import OperationalError

os.environ.setdefault("DATABASE_URL", "postgresql://u:p@localhost:1/x")
os.environ.setdefault("MASCOTAS_API_URL", "http://mascotas.invalid")
os.environ.setdefault("ADMIN_API_KEY", "clave-admin-de-pruebas")
os.environ.setdefault("INTERNAL_API_KEY", "clave-interna-de-pruebas")

from app import mascotas_client, servicio  # noqa: E402
from app.schemas import EstadoSolicitud  # noqa: E402


def _sesion_que_falla_al_confirmar(mascota_id: uuid.UUID) -> MagicMock:
    solicitud = MagicMock(estado=EstadoSolicitud.pendiente)
    db = MagicMock()
    db.scalar.side_effect = [mascota_id, solicitud]
    db.commit.side_effect = OperationalError("COMMIT", {}, Exception("conexión perdida"))
    return db


def test_compensa_si_la_confirmacion_local_falla(monkeypatch):
    mascota_id, solicitud_id = uuid.uuid4(), uuid.uuid4()
    registrar, revertir = MagicMock(), MagicMock()
    monkeypatch.setattr(mascotas_client, "registrar_adopcion", registrar)
    monkeypatch.setattr(mascotas_client, "revertir_adopcion", revertir)
    db = _sesion_que_falla_al_confirmar(mascota_id)

    with pytest.raises(HTTPException) as error:
        servicio.aprobar(db, solicitud_id)

    assert error.value.status_code == 503
    registrar.assert_called_once_with(mascota_id, solicitud_id)
    revertir.assert_called_once_with(mascota_id, solicitud_id)
    db.rollback.assert_called_once()


def test_si_la_compensacion_tambien_falla_devuelve_el_mismo_error(monkeypatch):
    mascota_id, solicitud_id = uuid.uuid4(), uuid.uuid4()
    monkeypatch.setattr(mascotas_client, "registrar_adopcion", MagicMock())
    monkeypatch.setattr(mascotas_client, "revertir_adopcion", MagicMock(side_effect=mascotas_client.MascotasNoResponde))

    with pytest.raises(HTTPException) as error:
        servicio.aprobar(_sesion_que_falla_al_confirmar(mascota_id), solicitud_id)

    assert error.value.status_code == 503
