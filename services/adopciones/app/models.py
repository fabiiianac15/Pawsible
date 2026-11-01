import uuid
from datetime import datetime

from sqlalchemy import Boolean, Text, func, text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column
from sqlalchemy.types import DateTime


class Base(DeclarativeBase):
    pass


class Solicitud(Base):
    __tablename__ = "solicitudes"
    __table_args__ = {"schema": "adopciones"}

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()")
    )
    mascota_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True))
    mascota_nombre: Mapped[str] = mapped_column(Text)
    solicitante_nombre: Mapped[str] = mapped_column(Text)
    solicitante_email: Mapped[str] = mapped_column(Text)
    solicitante_telefono: Mapped[str] = mapped_column(Text)
    ciudad: Mapped[str] = mapped_column(Text)
    vivienda: Mapped[str] = mapped_column(Text)
    tiene_otras_mascotas: Mapped[bool] = mapped_column(Boolean, server_default=text("false"))
    motivacion: Mapped[str] = mapped_column(Text)
    estado: Mapped[str] = mapped_column(Text, server_default="pendiente")
    motivo_rechazo: Mapped[str | None] = mapped_column(Text)
    creado_en: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    decidido_en: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
