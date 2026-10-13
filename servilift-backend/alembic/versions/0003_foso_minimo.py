"""Ítems que solo aplican desde cierta profundidad de foso (ítem 12 de la NTC 5926-1:2012).

Agrega checklist_item.foso_minimo_mm y la vista v_inspeccion_item_aplica lo tiene en cuenta: si el foso
registrado es menos profundo, el ítem se precarga como "No aplica" (igual que en la plantilla de informe).

Revisión: 0003_foso_minimo
"""
from alembic import op

revision = "0003_foso_minimo"
down_revision = "0002_reglas_no_aplica"
branch_labels = None
depends_on = None

VISTA = """
    CREATE OR REPLACE VIEW v_inspeccion_item_aplica AS
    SELECT
      ins.id_inspeccion,
      i.id_item,
      i.numero,
      CASE WHEN EXISTS (
        SELECT 1
        FROM checklist_item_variante v
        JOIN variante_opcion o ON o.id_variante_opcion = v.id_variante_opcion
        WHERE v.id_item = i.id_item
          AND NOT EXISTS (
            SELECT 1
            FROM checklist_item_variante v2
            JOIN variante_opcion o2 ON o2.id_variante_opcion = v2.id_variante_opcion
            JOIN inspeccion_variante iv ON iv.id_variante_opcion = v2.id_variante_opcion
                                       AND iv.id_inspeccion = ins.id_inspeccion
            WHERE v2.id_item = i.id_item
              AND o2.id_variante_tipo = o.id_variante_tipo)
      ) OR (i.foso_minimo_mm IS NOT NULL AND ins.profundidad_foso_mm < i.foso_minimo_mm)
      THEN 0 ELSE 1 END AS aplica
    FROM inspeccion ins
    JOIN checklist_item i ON i.id_norma = ins.id_norma
    WHERE i.activo = 1
"""


def upgrade():
    op.execute("ALTER TABLE checklist_item ADD COLUMN foso_minimo_mm INT NULL "
               "COMMENT 'Solo aplica si la profundidad de foso registrada es >= este valor' AFTER unidad_medida")
    op.execute("""
        UPDATE checklist_item i JOIN norma n ON n.id_norma = i.id_norma
        SET i.foso_minimo_mm = 1500
        WHERE n.parte = 1 AND n.version = 2012 AND i.numero = 12""")
    op.execute(VISTA)


def downgrade():
    op.execute(VISTA.replace(" OR (i.foso_minimo_mm IS NOT NULL AND ins.profundidad_foso_mm < i.foso_minimo_mm)", ""))
    op.execute("ALTER TABLE checklist_item DROP COLUMN foso_minimo_mm")
