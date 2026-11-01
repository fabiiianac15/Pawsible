import uuid
from datetime import datetime

from sqlalchemy import Integer, Text, func, text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column
from sqlalchemy.types import DateTime


class Base(DeclarativeBase):
    pass


class Mascota(Base):
    __tablename__ = "mascotas"
    __table_args__ = {"schema": "mascotas"}

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()")
    )
    nombre: Mapped[str] = mapped_column(Text)
    especie: Mapped[str] = mapped_column(Text)
    raza: Mapped[str | None] = mapped_column(Text)
    edad_meses: Mapped[int] = mapped_column(Integer)
    tamano: Mapped[str] = mapped_column(Text)
    sexo: Mapped[str] = mapped_column(Text)
    descripcion: Mapped[str] = mapped_column(Text)
    foto_url: Mapped[str | None] = mapped_column(Text)
    estado: Mapped[str] = mapped_column(Text, server_default="disponible")
    solicitud_adopcion_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True))
    creado_en: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    actualizado_en: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )
