import uuid
from datetime import datetime
from enum import StrEnum

from pydantic import BaseModel, ConfigDict, Field, HttpUrl, field_serializer


class Especie(StrEnum):
    perro = "perro"
    gato = "gato"
    conejo = "conejo"


class Tamano(StrEnum):
    pequeno = "pequeno"
    mediano = "mediano"
    grande = "grande"


class Sexo(StrEnum):
    macho = "macho"
    hembra = "hembra"


class Estado(StrEnum):
    disponible = "disponible"
    en_tratamiento = "en_tratamiento"
    adoptada = "adoptada"


class EstadoEditable(StrEnum):
    """`adoptada` solo se asigna cuando la API de Adopciones aprueba una solicitud."""

    disponible = "disponible"
    en_tratamiento = "en_tratamiento"


class MascotaCrear(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    nombre: str = Field(min_length=1, max_length=80, examples=["Canela"])
    especie: Especie
    raza: str | None = Field(default=None, max_length=80, examples=["Criolla"])
    edad_meses: int = Field(ge=0, le=360, examples=[26])
    tamano: Tamano
    sexo: Sexo
    descripcion: str = Field(min_length=1, max_length=1000)
    foto_url: HttpUrl | None = None

    @field_serializer("foto_url")
    def _foto(self, v: HttpUrl | None) -> str | None:
        return str(v) if v else None


class MascotaActualizar(BaseModel):
    """Solo se modifican los campos enviados."""

    model_config = ConfigDict(str_strip_whitespace=True)

    nombre: str | None = Field(default=None, min_length=1, max_length=80)
    raza: str | None = Field(default=None, max_length=80)
    edad_meses: int | None = Field(default=None, ge=0, le=360)
    tamano: Tamano | None = None
    descripcion: str | None = Field(default=None, min_length=1, max_length=1000)
    foto_url: HttpUrl | None = None
    estado: EstadoEditable | None = None

    @field_serializer("foto_url")
    def _foto(self, v: HttpUrl | None) -> str | None:
        return str(v) if v else None


class MascotaOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    nombre: str
    especie: Especie
    raza: str | None
    edad_meses: int
    tamano: Tamano
    sexo: Sexo
    descripcion: str
    foto_url: str | None
    estado: Estado
    creado_en: datetime
    actualizado_en: datetime


class MascotaPagina(BaseModel):
    items: list[MascotaOut]
    total: int


class Disponibilidad(BaseModel):
    mascota_id: uuid.UUID
    nombre: str
    estado: Estado
    disponible: bool


class AdopcionRegistrar(BaseModel):
    solicitud_id: uuid.UUID


class Error(BaseModel):
    detail: str
