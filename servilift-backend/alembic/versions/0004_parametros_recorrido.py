"""Parámetros para calcular el recorrido del ascensor: metros por parada y sobre recorrido.

Revisión: 0004_parametros_recorrido
"""
from alembic import op

revision = "0004_parametros_recorrido"
down_revision = "0003_foso_minimo"
branch_labels = None
depends_on = None


def upgrade():
    op.execute("""
        INSERT IGNORE INTO parametro (clave, valor, descripcion) VALUES
        ('RECORRIDO_M_POR_PARADA', '2.2', 'Metros aproximados por parada para calcular el recorrido'),
        ('RECORRIDO_SOBRE_RECORRIDO_M', '2.5', 'Metros de sobre recorrido que se suman al recorrido calculado')""")


def downgrade():
    op.execute("DELETE FROM parametro WHERE clave IN ('RECORRIDO_M_POR_PARADA', 'RECORRIDO_SOBRE_RECORRIDO_M')")
