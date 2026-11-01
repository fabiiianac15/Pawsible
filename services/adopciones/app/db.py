from collections.abc import Iterator

from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import NullPool

from .config import settings

url = settings.database_url.replace("postgres://", "postgresql://", 1).replace(
    "postgresql://", "postgresql+psycopg://", 1
)

# El pooler de Supabase en modo transacción ya administra las conexiones y no admite
# sentencias preparadas. Por eso no hay pool local y prepare_threshold queda en None.
engine = create_engine(url, poolclass=NullPool, connect_args={"prepare_threshold": None})
SessionLocal = sessionmaker(engine, expire_on_commit=False)


def get_db() -> Iterator[Session]:
    with SessionLocal() as session:
        yield session
