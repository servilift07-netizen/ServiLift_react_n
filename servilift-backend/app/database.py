from sqlalchemy import create_engine, event
from sqlalchemy.orm import declarative_base, sessionmaker

from app.config import settings

engine = create_engine(settings.DATABASE_URL, pool_pre_ping=True, pool_recycle=3600, echo=False)


@event.listens_for(engine, "connect")
def _zona_horaria(conexion, _registro):
    """CURRENT_TIMESTAMP y NOW() de la base quedan en hora de Colombia, igual que app.tiempo.ahora()."""
    cursor = conexion.cursor()
    cursor.execute(f"SET time_zone = '{settings.ZONA_HORARIA}'")
    cursor.close()


SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
