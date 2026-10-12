"""Esquema base v2 (database/01_schema.sql).

La base se crea con los scripts SQL de la carpeta database/, que registran esta revisión en
alembic_version. Por eso esta migración no hace nada: es el punto de partida de las siguientes.

Revisión: 0001_v2
"""

revision = "0001_v2"
down_revision = None
branch_labels = None
depends_on = None


def upgrade():
    pass


def downgrade():
    pass
