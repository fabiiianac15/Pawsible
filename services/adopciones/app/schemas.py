import uuid
from datetime import datetime
from enum import StrEnum

from pydantic import BaseModel, ConfigDict, EmailStr, Field


class EstadoSolicitud(StrEnum):
    pendiente = "pendiente"
    aprobada = "aprobada"
    rechazada = "rechazada"


class Vivienda(StrEnum):
    casa = "casa"
    apartamento = "apartamento"
    finca = "finca"


class SolicitudCrear(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    mascota_id: uuid.UUID
    solicitante_nombre: str = Field(min_length=3, max_length=120, examples=["Laura Sanjuán"])
    solicitante_email: EmailStr = Field(examples=["laura.sanjuan@correo.co"])
    solicitante_telefono: str = Field(pattern=r"^\+?[0-9 ]{7,20}$", examples=["3151234567"])
    ciudad: str = Field(min_length=2, max_length=80, examples=["Ocaña"])
    vivienda: Vivienda
    tiene_otras_mascotas: bool = False
    motivacion: str = Field(min_length=20, max_length=1000)


class SolicitudRechazar(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    motivo: str = Field(min_length=5, max_length=500, examples=["La vivienda no tiene espacio para un perro grande."])


class SolicitudOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    mascota_id: uuid.UUID
    mascota_nombre: str
    solicitante_nombre: str
    solicitante_email: str
    solicitante_telefono: str
    ciudad: str
    vivienda: Vivienda
    tiene_otras_mascotas: bool
    motivacion: str
    estado: EstadoSolicitud
    motivo_rechazo: str | None
    creado_en: datetime
    decidido_en: datetime | None


class SolicitudPagina(BaseModel):
    items: list[SolicitudOut]
    total: int


class Error(BaseModel):
    detail: str
