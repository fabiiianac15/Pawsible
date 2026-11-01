import uuid
from typing import Annotated

from fastapi import Depends, FastAPI, HTTPException, Query, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, RedirectResponse
from sqlalchemy import func, select
from sqlalchemy.exc import OperationalError
from sqlalchemy.orm import Session

from . import servicio
from .config import settings
from .db import get_db
from .models import Solicitud
from .schemas import Error, EstadoSolicitud, SolicitudCrear, SolicitudOut, SolicitudPagina, SolicitudRechazar
from .seguridad import requiere_admin

app = FastAPI(
    title="Pawsible · API de Adopciones",
    version="1.0.0",
    description=(
        "Registra, consulta y gestiona las solicitudes de adopción. Se comunica con la API de "
        "Mascotas por HTTP/REST para verificar la disponibilidad y actualizar el estado. "
        "Una mascota nunca tiene dos adopciones aprobadas."
    ),
    openapi_tags=[
        {"name": "Solicitudes", "description": "Registro y seguimiento."},
        {"name": "Gestión", "description": "Decisiones de la fundación."},
        {"name": "Sistema", "description": "Estado del servicio."},
    ],
)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_methods=["GET", "POST"],
    allow_headers=["Content-Type", "X-Admin-Key"],
)

Db = Annotated[Session, Depends(get_db)]
NO_ENCONTRADA = {404: {"model": Error, "description": "La solicitud no existe."}}
SIN_CLAVE = {401: {"model": Error, "description": "Falta la clave o es inválida."}}
MASCOTAS_CAIDA = {503: {"model": Error, "description": "La API de Mascotas no responde; no hubo cambios."}}


@app.exception_handler(OperationalError)
def base_de_datos_caida(_: Request, __: OperationalError) -> JSONResponse:
    return JSONResponse({"detail": "La base de datos no responde. Intenta de nuevo."}, status_code=503)


@app.get("/", include_in_schema=False)
def raiz() -> RedirectResponse:
    return RedirectResponse("/docs")


@app.get("/health", tags=["Sistema"], summary="Comprueba que el servicio esté activo")
def health() -> dict[str, str]:
    return {"servicio": "adopciones", "estado": "ok"}


@app.post(
    "/solicitudes",
    response_model=SolicitudOut,
    status_code=status.HTTP_201_CREATED,
    responses={
        404: {"model": Error, "description": "La mascota no existe."},
        409: {"model": Error, "description": "La mascota no está disponible o ya hay una solicitud pendiente."},
        **MASCOTAS_CAIDA,
    },
    tags=["Solicitudes"],
    summary="Registra una solicitud",
    description="Antes de guardar consulta la disponibilidad en la API de Mascotas.",
)
def crear(datos: SolicitudCrear, db: Db) -> Solicitud:
    return servicio.crear_solicitud(db, datos)


@app.get(
    "/solicitudes/{solicitud_id}",
    response_model=SolicitudOut,
    responses=NO_ENCONTRADA,
    tags=["Solicitudes"],
    summary="Consulta una solicitud por su código",
    description="El código es un UUID que solo conoce quien hizo la solicitud y la fundación.",
)
def obtener(solicitud_id: uuid.UUID, db: Db) -> Solicitud:
    solicitud = db.get(Solicitud, solicitud_id)
    if solicitud is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "La solicitud no existe.")
    return solicitud


@app.get(
    "/solicitudes",
    response_model=SolicitudPagina,
    responses=SIN_CLAVE,
    dependencies=[Depends(requiere_admin)],
    tags=["Gestión"],
    summary="Lista las solicitudes",
)
def listar(
    db: Db,
    estado: EstadoSolicitud | None = None,
    mascota_id: uuid.UUID | None = None,
    limit: Annotated[int, Query(ge=1, le=100)] = 50,
    offset: Annotated[int, Query(ge=0)] = 0,
) -> SolicitudPagina:
    filtros = []
    if estado:
        filtros.append(Solicitud.estado == estado)
    if mascota_id:
        filtros.append(Solicitud.mascota_id == mascota_id)
    total = db.scalar(select(func.count()).select_from(Solicitud).where(*filtros)) or 0
    items = db.scalars(
        select(Solicitud).where(*filtros).order_by(Solicitud.creado_en.desc()).limit(limit).offset(offset)
    ).all()
    return SolicitudPagina(items=[SolicitudOut.model_validate(s) for s in items], total=total)


@app.post(
    "/solicitudes/{solicitud_id}/aprobar",
    response_model=SolicitudOut,
    responses={
        **NO_ENCONTRADA,
        **SIN_CLAVE,
        409: {"model": Error, "description": "La solicitud ya se decidió o la mascota no está disponible."},
        **MASCOTAS_CAIDA,
    },
    dependencies=[Depends(requiere_admin)],
    tags=["Gestión"],
    summary="Aprueba una solicitud",
    description=(
        "Marca la mascota como adoptada en la API de Mascotas y rechaza las demás "
        "solicitudes pendientes de esa mascota."
    ),
)
def aprobar(solicitud_id: uuid.UUID, db: Db) -> Solicitud:
    return servicio.aprobar(db, solicitud_id)


@app.post(
    "/solicitudes/{solicitud_id}/rechazar",
    response_model=SolicitudOut,
    responses={
        **NO_ENCONTRADA,
        **SIN_CLAVE,
        409: {"model": Error, "description": "La solicitud ya se decidió."},
    },
    dependencies=[Depends(requiere_admin)],
    tags=["Gestión"],
    summary="Rechaza una solicitud",
    description="La mascota sigue disponible para otras solicitudes.",
)
def rechazar(solicitud_id: uuid.UUID, datos: SolicitudRechazar, db: Db) -> Solicitud:
    return servicio.rechazar(db, solicitud_id, datos.motivo)
