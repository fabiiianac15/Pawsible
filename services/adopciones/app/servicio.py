"""Reglas del proceso de adopción. Coordina la base local y la API de Mascotas."""
import logging
import uuid
from datetime import UTC, datetime

from fastapi import HTTPException, status
from sqlalchemy import select, text, update
from sqlalchemy.exc import IntegrityError, SQLAlchemyError
from sqlalchemy.orm import Session

from . import mascotas_client as mascotas
from .models import Solicitud
from .schemas import EstadoSolicitud, SolicitudCrear

log = logging.getLogger("adopciones")

MOTIVO_OTRA_APROBADA = "La mascota fue adoptada por medio de otra solicitud."
MENSAJE_MASCOTAS_CAIDA = "El servicio de mascotas no responde. No se hizo ningún cambio; intenta de nuevo."


def _bloquear_mascota(db: Session, mascota_id: uuid.UUID) -> None:
    """Serializa las operaciones sobre una misma mascota hasta el fin de la transacción.

    Es válido con el pooler en modo transacción porque el bloqueo es de transacción. Evita además
    un interbloqueo: sin él, dos aprobaciones simultáneas se esperarían entre el índice único y
    el rechazo automático de las demás solicitudes pendientes.
    """
    db.execute(text("SELECT pg_advisory_xact_lock(hashtextextended(:k, 0))"), {"k": str(mascota_id)})


def crear_solicitud(db: Session, datos: SolicitudCrear) -> Solicitud:
    _bloquear_mascota(db, datos.mascota_id)
    try:
        mascota = mascotas.consultar_disponibilidad(datos.mascota_id)
    except mascotas.MascotaNoEncontrada:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "La mascota no existe.") from None
    except mascotas.MascotasNoResponde:
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, MENSAJE_MASCOTAS_CAIDA) from None
    if not mascota.disponible:
        raise HTTPException(status.HTTP_409_CONFLICT, f"{mascota.nombre} no está disponible para adopción.")

    solicitud = Solicitud(**datos.model_dump(), mascota_nombre=mascota.nombre)
    db.add(solicitud)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status.HTTP_409_CONFLICT, f"Ya tienes una solicitud pendiente para {mascota.nombre}."
        ) from None
    db.refresh(solicitud)
    return solicitud


def _pendiente_bloqueada(db: Session, solicitud_id: uuid.UUID, mascota_id: uuid.UUID) -> Solicitud:
    _bloquear_mascota(db, mascota_id)
    solicitud = db.scalar(select(Solicitud).where(Solicitud.id == solicitud_id).with_for_update())
    if solicitud.estado != EstadoSolicitud.pendiente:
        raise HTTPException(status.HTTP_409_CONFLICT, f"La solicitud ya fue {solicitud.estado}.")
    return solicitud


def _mascota_de(db: Session, solicitud_id: uuid.UUID) -> uuid.UUID:
    mascota_id = db.scalar(select(Solicitud.mascota_id).where(Solicitud.id == solicitud_id))
    if mascota_id is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "La solicitud no existe.")
    return mascota_id


def aprobar(db: Session, solicitud_id: uuid.UUID) -> Solicitud:
    mascota_id = _mascota_de(db, solicitud_id)
    solicitud = _pendiente_bloqueada(db, solicitud_id, mascota_id)
    ahora = datetime.now(UTC)

    # 1. Aprobación local sin confirmar: el índice único rechaza aquí una segunda aprobación.
    solicitud.estado = EstadoSolicitud.aprobada
    solicitud.decidido_en = ahora
    try:
        db.flush()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status.HTTP_409_CONFLICT, "La mascota ya tiene una adopción aprobada.") from None

    # 2. La API de Mascotas decide si la mascota sigue disponible y la marca como adoptada.
    try:
        mascotas.registrar_adopcion(mascota_id, solicitud_id)
    except mascotas.MascotaNoDisponible as error:
        db.rollback()
        raise HTTPException(status.HTTP_409_CONFLICT, error.detalle) from None
    except mascotas.MascotaNoEncontrada:
        db.rollback()
        raise HTTPException(status.HTTP_409_CONFLICT, "La mascota ya no existe en el catálogo.") from None
    except mascotas.MascotasNoResponde:
        db.rollback()
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, MENSAJE_MASCOTAS_CAIDA) from None

    # 3. Las demás solicitudes pendientes de esa mascota se cierran en la misma transacción.
    db.execute(
        update(Solicitud)
        .where(
            Solicitud.mascota_id == mascota_id,
            Solicitud.estado == EstadoSolicitud.pendiente,
            Solicitud.id != solicitud_id,
        )
        .values(estado=EstadoSolicitud.rechazada, motivo_rechazo=MOTIVO_OTRA_APROBADA, decidido_en=ahora)
    )

    # 4. Si la confirmación local falla, se compensa liberando la mascota.
    try:
        db.commit()
    except SQLAlchemyError:
        db.rollback()
        _compensar(mascota_id, solicitud_id)
        raise HTTPException(
            status.HTTP_503_SERVICE_UNAVAILABLE, "No se pudo guardar la aprobación. Intenta de nuevo."
        ) from None
    return solicitud


def _compensar(mascota_id: uuid.UUID, solicitud_id: uuid.UUID) -> None:
    try:
        mascotas.revertir_adopcion(mascota_id, solicitud_id)
    except (mascotas.MascotasNoResponde, mascotas.MascotaNoEncontrada):
        # Queda adoptada sin aprobación local. Al reintentar la aprobación, el PUT idempotente
        # con la misma solicitud_id responde 200, de modo que el sistema se recupera solo.
        log.error("Compensación fallida: mascota=%s solicitud=%s", mascota_id, solicitud_id)


def rechazar(db: Session, solicitud_id: uuid.UUID, motivo: str) -> Solicitud:
    mascota_id = _mascota_de(db, solicitud_id)
    solicitud = _pendiente_bloqueada(db, solicitud_id, mascota_id)
    solicitud.estado = EstadoSolicitud.rechazada
    solicitud.motivo_rechazo = motivo
    solicitud.decidido_en = datetime.now(UTC)
    db.commit()
    return solicitud
