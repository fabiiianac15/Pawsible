import uuid
from typing import Annotated

from fastapi import Depends, FastAPI, HTTPException, Query, Request, Response, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, RedirectResponse
from sqlalchemy import case, func, select, update
from sqlalchemy.exc import OperationalError
from sqlalchemy.orm import Session

from .config import settings
from .db import get_db
from .models import Mascota
from .schemas import (
    AdopcionRegistrar,
    Disponibilidad,
    Error,
    Especie,
    Estado,
    MascotaActualizar,
    MascotaCrear,
    MascotaOut,
    MascotaPagina,
    Tamano,
)
from .seguridad import requiere_admin, requiere_servicio

app = FastAPI(
    title="Pawsible · API de Mascotas",
    version="1.0.0",
    description=(
        "Administra el registro, la consulta y la disponibilidad de los animales de la "
        "Fundación Huellas de Esperanza. El estado `adoptada` solo cambia a través del "
        "recurso de adopción, que consume la API de Adopciones."
    ),
    openapi_tags=[
        {"name": "Mascotas", "description": "Catálogo público y administración."},
        {"name": "Entre servicios", "description": "Operaciones que usa la API de Adopciones."},
        {"name": "Sistema", "description": "Estado del servicio."},
    ],
)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_methods=["GET", "POST", "PATCH"],
    allow_headers=["Content-Type", "X-Admin-Key"],
)

Db = Annotated[Session, Depends(get_db)]
NO_ENCONTRADA = {404: {"model": Error, "description": "La mascota no existe."}}
SIN_CLAVE = {401: {"model": Error, "description": "Falta la clave o es inválida."}}


@app.exception_handler(OperationalError)
def base_de_datos_caida(_: Request, __: OperationalError) -> JSONResponse:
    return JSONResponse({"detail": "La base de datos no responde. Intenta de nuevo."}, status_code=503)


def _buscar(db: Session, mascota_id: uuid.UUID) -> Mascota:
    mascota = db.get(Mascota, mascota_id)
    if mascota is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "La mascota no existe.")
    return mascota


@app.get("/", include_in_schema=False)
def raiz() -> RedirectResponse:
    return RedirectResponse("/docs")


@app.get("/health", tags=["Sistema"], summary="Comprueba que el servicio esté activo")
def health() -> dict[str, str]:
    return {"servicio": "mascotas", "estado": "ok"}


@app.get("/mascotas", response_model=MascotaPagina, tags=["Mascotas"], summary="Lista y filtra mascotas")
def listar(
    db: Db,
    estado: Estado | None = None,
    especie: Especie | None = None,
    tamano: Tamano | None = None,
    q: Annotated[str | None, Query(max_length=80, description="Busca por nombre.")] = None,
    limit: Annotated[int, Query(ge=1, le=100)] = 24,
    offset: Annotated[int, Query(ge=0)] = 0,
) -> MascotaPagina:
    filtros = []
    if estado:
        filtros.append(Mascota.estado == estado)
    if especie:
        filtros.append(Mascota.especie == especie)
    if tamano:
        filtros.append(Mascota.tamano == tamano)
    if q and q.strip():
        filtros.append(Mascota.nombre.icontains(q.strip(), autoescape=True))

    total = db.scalar(select(func.count()).select_from(Mascota).where(*filtros)) or 0
    disponibles_primero = case((Mascota.estado == "disponible", 0), else_=1)
    items = db.scalars(
        select(Mascota)
        .where(*filtros)
        .order_by(disponibles_primero, Mascota.creado_en.desc(), Mascota.nombre)
        .limit(limit)
        .offset(offset)
    ).all()
    return MascotaPagina(items=[MascotaOut.model_validate(m) for m in items], total=total)


@app.get(
    "/mascotas/{mascota_id}",
    response_model=MascotaOut,
    responses=NO_ENCONTRADA,
    tags=["Mascotas"],
    summary="Consulta una mascota",
)
def obtener(mascota_id: uuid.UUID, db: Db) -> Mascota:
    return _buscar(db, mascota_id)


@app.post(
    "/mascotas",
    response_model=MascotaOut,
    status_code=status.HTTP_201_CREATED,
    responses=SIN_CLAVE,
    dependencies=[Depends(requiere_admin)],
    tags=["Mascotas"],
    summary="Registra una mascota",
)
def crear(datos: MascotaCrear, db: Db) -> Mascota:
    mascota = Mascota(**datos.model_dump(), estado="disponible")
    db.add(mascota)
    db.commit()
    db.refresh(mascota)
    return mascota


@app.patch(
    "/mascotas/{mascota_id}",
    response_model=MascotaOut,
    responses={**NO_ENCONTRADA, **SIN_CLAVE, 409: {"model": Error, "description": "La mascota ya fue adoptada."}},
    dependencies=[Depends(requiere_admin)],
    tags=["Mascotas"],
    summary="Actualiza datos o disponibilidad",
)
def actualizar(mascota_id: uuid.UUID, datos: MascotaActualizar, db: Db) -> Mascota:
    mascota = db.scalar(select(Mascota).where(Mascota.id == mascota_id).with_for_update())
    if mascota is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "La mascota no existe.")
    cambios = datos.model_dump(exclude_unset=True)
    if "estado" in cambios and mascota.estado == Estado.adoptada:
        raise HTTPException(status.HTTP_409_CONFLICT, "La mascota ya fue adoptada; su estado no se puede cambiar.")
    for campo, valor in cambios.items():
        setattr(mascota, campo, valor)
    db.commit()
    db.refresh(mascota)
    return mascota


@app.get(
    "/mascotas/{mascota_id}/disponibilidad",
    response_model=Disponibilidad,
    responses=NO_ENCONTRADA,
    tags=["Entre servicios"],
    summary="Indica si la mascota se puede adoptar",
)
def disponibilidad(mascota_id: uuid.UUID, db: Db) -> Disponibilidad:
    mascota = _buscar(db, mascota_id)
    return Disponibilidad(
        mascota_id=mascota.id,
        nombre=mascota.nombre,
        estado=mascota.estado,
        disponible=mascota.estado == Estado.disponible,
    )


@app.put(
    "/mascotas/{mascota_id}/adopcion",
    response_model=MascotaOut,
    responses={**NO_ENCONTRADA, **SIN_CLAVE, 409: {"model": Error, "description": "La mascota no está disponible."}},
    dependencies=[Depends(requiere_servicio)],
    tags=["Entre servicios"],
    summary="Marca la mascota como adoptada",
    description=(
        "Operación atómica e idempotente: repetirla con la misma `solicitud_id` devuelve 200 sin "
        "cambios, lo que permite reintentar tras un fallo de red. Otra solicitud recibe 409."
    ),
)
def registrar_adopcion(mascota_id: uuid.UUID, datos: AdopcionRegistrar, db: Db) -> Mascota:
    actualizada = db.scalar(
        update(Mascota)
        .where(Mascota.id == mascota_id, Mascota.estado == Estado.disponible)
        .values(estado=Estado.adoptada, solicitud_adopcion_id=datos.solicitud_id)
        .returning(Mascota)
    )
    db.commit()
    if actualizada is not None:
        return actualizada
    mascota = _buscar(db, mascota_id)
    if mascota.solicitud_adopcion_id == datos.solicitud_id:
        return mascota
    raise HTTPException(status.HTTP_409_CONFLICT, f"{mascota.nombre} no está disponible para adopción.")


@app.delete(
    "/mascotas/{mascota_id}/adopcion",
    status_code=status.HTTP_204_NO_CONTENT,
    responses={**NO_ENCONTRADA, **SIN_CLAVE},
    dependencies=[Depends(requiere_servicio)],
    tags=["Entre servicios"],
    summary="Revierte una adopción (compensación)",
    description=(
        "La API de Adopciones la llama si no logra guardar la aprobación después de marcar la mascota. "
        "Solo libera la mascota si la adopción pertenece a esa `solicitud_id`."
    ),
)
def revertir_adopcion(mascota_id: uuid.UUID, solicitud_id: uuid.UUID, db: Db) -> Response:
    _buscar(db, mascota_id)
    db.execute(
        update(Mascota)
        .where(Mascota.id == mascota_id, Mascota.solicitud_adopcion_id == solicitud_id)
        .values(estado=Estado.disponible, solicitud_adopcion_id=None)
    )
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)
