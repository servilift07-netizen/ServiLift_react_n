# alembic/env.py
# Usa la misma conexión y zona horaria del backend. La base se crea con database/01_schema.sql,
# que ya deja registrada la revisión 0001_v2; desde ahí cada cambio es una migración nueva.

from logging.config import fileConfig

from alembic import context

from app import models  # noqa: F401  (registra las tablas en Base.metadata)
from app.database import Base, engine

config = context.config
if config.config_file_name is not None:
    fileConfig(config.config_file_name)

target_metadata = Base.metadata


def run_migrations_offline():
    context.configure(url=str(engine.url), target_metadata=target_metadata, literal_binds=True,
                      dialect_opts={"paramstyle": "named"})
    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online():
    with engine.connect() as connection:
        context.configure(connection=connection, target_metadata=target_metadata, compare_type=False)
        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
