"""Reglas de "no aplica" por variante según la plantilla de informe NTC 5926-1:2012.

Reemplaza las reglas de checklist_item_variante de los ítems de la norma 2012 por las que salen de las
fórmulas "NO APLICA" de la plantilla. Las inspecciones ya abiertas se recalculan al guardar sus variantes.

Revisión: 0002_reglas_no_aplica
"""
from alembic import op

revision = "0002_reglas_no_aplica"
down_revision = "0001_v2"
branch_labels = None
depends_on = None

REGLAS = """
    SELECT 13 AS id_item, 'MAQUINA' AS tipo, 'GEARLESS' AS opcion
    UNION ALL SELECT 13 AS id_item, 'MAQUINA' AS tipo, 'CON_REDUCTOR' AS opcion
    UNION ALL SELECT 13 AS id_item, 'MAQUINA' AS tipo, 'NO_APLICA' AS opcion
    UNION ALL SELECT 18 AS id_item, 'TIPO_BUFFER' AS tipo, 'HIDRAULICO' AS opcion
    UNION ALL SELECT 18 AS id_item, 'TIPO_BUFFER' AS tipo, 'MIXTO' AS opcion
    UNION ALL SELECT 18 AS id_item, 'TIPO_BUFFER' AS tipo, 'NO_APLICA' AS opcion
    UNION ALL SELECT 19 AS id_item, 'TIPO_BUFFER' AS tipo, 'HIDRAULICO' AS opcion
    UNION ALL SELECT 19 AS id_item, 'TIPO_BUFFER' AS tipo, 'MIXTO' AS opcion
    UNION ALL SELECT 19 AS id_item, 'TIPO_BUFFER' AS tipo, 'NO_APLICA' AS opcion
    UNION ALL SELECT 20 AS id_item, 'TIPO_BUFFER' AS tipo, 'HIDRAULICO' AS opcion
    UNION ALL SELECT 20 AS id_item, 'TIPO_BUFFER' AS tipo, 'MIXTO' AS opcion
    UNION ALL SELECT 20 AS id_item, 'TIPO_BUFFER' AS tipo, 'NO_APLICA' AS opcion
    UNION ALL SELECT 21 AS id_item, 'TIPO_PUERTA' AS tipo, 'BATIENTE' AS opcion
    UNION ALL SELECT 22 AS id_item, 'LIMITADOR_CONTRAPESO' AS tipo, 'SI' AS opcion
    UNION ALL SELECT 23 AS id_item, 'LIMITADOR_CONTRAPESO' AS tipo, 'SI' AS opcion
    UNION ALL SELECT 27 AS id_item, 'TIPO_PUERTA' AS tipo, 'AUTOMATICA' AS opcion
    UNION ALL SELECT 27 AS id_item, 'TIPO_PUERTA' AS tipo, 'PLEGABLE' AS opcion
    UNION ALL SELECT 27 AS id_item, 'TIPO_PUERTA' AS tipo, 'NO_APLICA' AS opcion
    UNION ALL SELECT 29 AS id_item, 'TIPO_PUERTA' AS tipo, 'AUTOMATICA' AS opcion
    UNION ALL SELECT 29 AS id_item, 'TIPO_PUERTA' AS tipo, 'PLEGABLE' AS opcion
    UNION ALL SELECT 29 AS id_item, 'TIPO_PUERTA' AS tipo, 'NO_APLICA' AS opcion
    UNION ALL SELECT 36 AS id_item, 'CUARTO_MAQUINAS' AS tipo, 'CON_CUARTO' AS opcion
    UNION ALL SELECT 36 AS id_item, 'CUARTO_MAQUINAS' AS tipo, 'NO_APLICA' AS opcion
    UNION ALL SELECT 38 AS id_item, 'CUARTO_MAQUINAS' AS tipo, 'CON_CUARTO' AS opcion
    UNION ALL SELECT 38 AS id_item, 'CUARTO_MAQUINAS' AS tipo, 'NO_APLICA' AS opcion
    UNION ALL SELECT 39 AS id_item, 'CUARTO_MAQUINAS' AS tipo, 'CON_CUARTO' AS opcion
    UNION ALL SELECT 39 AS id_item, 'CUARTO_MAQUINAS' AS tipo, 'NO_APLICA' AS opcion
    UNION ALL SELECT 40 AS id_item, 'MAQUINA' AS tipo, 'GEARLESS' AS opcion
    UNION ALL SELECT 40 AS id_item, 'MAQUINA' AS tipo, 'CON_REDUCTOR' AS opcion
    UNION ALL SELECT 40 AS id_item, 'MAQUINA' AS tipo, 'NO_APLICA' AS opcion
    UNION ALL SELECT 41 AS id_item, 'TRACCION_POR' AS tipo, 'CABLE' AS opcion
    UNION ALL SELECT 41 AS id_item, 'TRACCION_POR' AS tipo, 'NO_APLICA' AS opcion
    UNION ALL SELECT 41 AS id_item, 'ACCIONAMIENTO' AS tipo, 'ELECTRICO' AS opcion
    UNION ALL SELECT 41 AS id_item, 'ACCIONAMIENTO' AS tipo, 'HIDRAULICO_INDIRECTO' AS opcion
    UNION ALL SELECT 42 AS id_item, 'ACCIONAMIENTO' AS tipo, 'ELECTRICO' AS opcion
    UNION ALL SELECT 42 AS id_item, 'ACCIONAMIENTO' AS tipo, 'HIDRAULICO_INDIRECTO' AS opcion
    UNION ALL SELECT 43 AS id_item, 'PUERTA_SOCORRO' AS tipo, 'SI' AS opcion
    UNION ALL SELECT 44 AS id_item, 'PUERTA_SOCORRO' AS tipo, 'SI' AS opcion
    UNION ALL SELECT 45 AS id_item, 'PUERTA_SOCORRO' AS tipo, 'SI' AS opcion
    UNION ALL SELECT 46 AS id_item, 'PUERTA_SOCORRO' AS tipo, 'SI' AS opcion
    UNION ALL SELECT 47 AS id_item, 'PUERTA_SOCORRO' AS tipo, 'SI' AS opcion
    UNION ALL SELECT 48 AS id_item, 'CUARTO_POLEAS' AS tipo, 'SI' AS opcion
    UNION ALL SELECT 49 AS id_item, 'CUARTO_POLEAS' AS tipo, 'SI' AS opcion
    UNION ALL SELECT 57 AS id_item, 'ACCIONAMIENTO' AS tipo, 'ELECTRICO' AS opcion
    UNION ALL SELECT 57 AS id_item, 'ACCIONAMIENTO' AS tipo, 'HIDRAULICO_INDIRECTO' AS opcion
    UNION ALL SELECT 58 AS id_item, 'TRACCION_POR' AS tipo, 'CINTA' AS opcion
    UNION ALL SELECT 58 AS id_item, 'TRACCION_POR' AS tipo, 'NO_APLICA' AS opcion
    UNION ALL SELECT 58 AS id_item, 'ACCIONAMIENTO' AS tipo, 'ELECTRICO' AS opcion
    UNION ALL SELECT 58 AS id_item, 'ACCIONAMIENTO' AS tipo, 'HIDRAULICO_INDIRECTO' AS opcion
    UNION ALL SELECT 59 AS id_item, 'CUARTO_MAQUINAS' AS tipo, 'SIN_CUARTO' AS opcion
    UNION ALL SELECT 59 AS id_item, 'CUARTO_MAQUINAS' AS tipo, 'NO_APLICA' AS opcion
    UNION ALL SELECT 60 AS id_item, 'ACCIONAMIENTO' AS tipo, 'ELECTRICO' AS opcion
    UNION ALL SELECT 60 AS id_item, 'ACCIONAMIENTO' AS tipo, 'HIDRAULICO_INDIRECTO' AS opcion
    UNION ALL SELECT 60 AS id_item, 'CUARTO_MAQUINAS' AS tipo, 'SIN_CUARTO' AS opcion
    UNION ALL SELECT 61 AS id_item, 'MAQUINA' AS tipo, 'GEARLESS' AS opcion
    UNION ALL SELECT 61 AS id_item, 'MAQUINA' AS tipo, 'CON_REDUCTOR' AS opcion
    UNION ALL SELECT 61 AS id_item, 'MAQUINA' AS tipo, 'NO_APLICA' AS opcion
    UNION ALL SELECT 62 AS id_item, 'MAQUINA' AS tipo, 'GEARLESS' AS opcion
    UNION ALL SELECT 62 AS id_item, 'MAQUINA' AS tipo, 'CON_REDUCTOR' AS opcion
    UNION ALL SELECT 62 AS id_item, 'MAQUINA' AS tipo, 'NO_APLICA' AS opcion
    UNION ALL SELECT 67 AS id_item, 'MAQUINA' AS tipo, 'GEARLESS' AS opcion
    UNION ALL SELECT 67 AS id_item, 'MAQUINA' AS tipo, 'CON_REDUCTOR' AS opcion
    UNION ALL SELECT 67 AS id_item, 'MAQUINA' AS tipo, 'NO_APLICA' AS opcion
    UNION ALL SELECT 75 AS id_item, 'ACCIONAMIENTO' AS tipo, 'ELECTRICO' AS opcion
    UNION ALL SELECT 75 AS id_item, 'ACCIONAMIENTO' AS tipo, 'HIDRAULICO_INDIRECTO' AS opcion
    UNION ALL SELECT 76 AS id_item, 'CUARTO_MAQUINAS' AS tipo, 'CON_CUARTO' AS opcion
    UNION ALL SELECT 76 AS id_item, 'CUARTO_MAQUINAS' AS tipo, 'NO_APLICA' AS opcion
    UNION ALL SELECT 76 AS id_item, 'MAQUINA' AS tipo, 'GEARLESS' AS opcion
    UNION ALL SELECT 76 AS id_item, 'MAQUINA' AS tipo, 'CON_REDUCTOR' AS opcion
    UNION ALL SELECT 76 AS id_item, 'MAQUINA' AS tipo, 'NO_APLICA' AS opcion
    UNION ALL SELECT 77 AS id_item, 'MAQUINA' AS tipo, 'CON_REDUCTOR' AS opcion
    UNION ALL SELECT 78 AS id_item, 'MAQUINA' AS tipo, 'CON_REDUCTOR' AS opcion
    UNION ALL SELECT 78 AS id_item, 'MAQUINA' AS tipo, 'NO_APLICA' AS opcion
    UNION ALL SELECT 79 AS id_item, 'CUARTO_MAQUINAS' AS tipo, 'CON_CUARTO' AS opcion
    UNION ALL SELECT 79 AS id_item, 'CUARTO_MAQUINAS' AS tipo, 'NO_APLICA' AS opcion
    UNION ALL SELECT 81 AS id_item, 'MAQUINA' AS tipo, 'GEARLESS' AS opcion
    UNION ALL SELECT 81 AS id_item, 'MAQUINA' AS tipo, 'CON_REDUCTOR' AS opcion
    UNION ALL SELECT 81 AS id_item, 'MAQUINA' AS tipo, 'NO_APLICA' AS opcion
    UNION ALL SELECT 82 AS id_item, 'ACCIONAMIENTO' AS tipo, 'ELECTRICO' AS opcion
    UNION ALL SELECT 82 AS id_item, 'ACCIONAMIENTO' AS tipo, 'HIDRAULICO_INDIRECTO' AS opcion
    UNION ALL SELECT 83 AS id_item, 'ACCIONAMIENTO' AS tipo, 'ELECTRICO' AS opcion
    UNION ALL SELECT 83 AS id_item, 'ACCIONAMIENTO' AS tipo, 'HIDRAULICO_INDIRECTO' AS opcion
    UNION ALL SELECT 84 AS id_item, 'TRACCION_POR' AS tipo, 'CABLE' AS opcion
    UNION ALL SELECT 84 AS id_item, 'TRACCION_POR' AS tipo, 'NO_APLICA' AS opcion
    UNION ALL SELECT 84 AS id_item, 'ACCIONAMIENTO' AS tipo, 'ELECTRICO' AS opcion
    UNION ALL SELECT 84 AS id_item, 'ACCIONAMIENTO' AS tipo, 'HIDRAULICO_INDIRECTO' AS opcion
    UNION ALL SELECT 85 AS id_item, 'LIMITADOR_CABINA' AS tipo, 'SI' AS opcion
    UNION ALL SELECT 85 AS id_item, 'ACCIONAMIENTO' AS tipo, 'ELECTRICO' AS opcion
    UNION ALL SELECT 85 AS id_item, 'ACCIONAMIENTO' AS tipo, 'HIDRAULICO_INDIRECTO' AS opcion
    UNION ALL SELECT 94 AS id_item, 'ACCIONAMIENTO' AS tipo, 'ELECTRICO' AS opcion
    UNION ALL SELECT 94 AS id_item, 'ACCIONAMIENTO' AS tipo, 'HIDRAULICO_INDIRECTO' AS opcion
    UNION ALL SELECT 95 AS id_item, 'ACCIONAMIENTO' AS tipo, 'ELECTRICO' AS opcion
    UNION ALL SELECT 95 AS id_item, 'ACCIONAMIENTO' AS tipo, 'HIDRAULICO_INDIRECTO' AS opcion
    UNION ALL SELECT 96 AS id_item, 'LIMITADOR_CABINA' AS tipo, 'SI' AS opcion
    UNION ALL SELECT 96 AS id_item, 'ACCIONAMIENTO' AS tipo, 'ELECTRICO' AS opcion
    UNION ALL SELECT 96 AS id_item, 'ACCIONAMIENTO' AS tipo, 'HIDRAULICO_INDIRECTO' AS opcion
    UNION ALL SELECT 97 AS id_item, 'ACCIONAMIENTO' AS tipo, 'ELECTRICO' AS opcion
    UNION ALL SELECT 97 AS id_item, 'ACCIONAMIENTO' AS tipo, 'HIDRAULICO_INDIRECTO' AS opcion
    UNION ALL SELECT 102 AS id_item, 'MAQUINA' AS tipo, 'GEARLESS' AS opcion
    UNION ALL SELECT 102 AS id_item, 'MAQUINA' AS tipo, 'CON_REDUCTOR' AS opcion
    UNION ALL SELECT 102 AS id_item, 'MAQUINA' AS tipo, 'NO_APLICA' AS opcion
    UNION ALL SELECT 109 AS id_item, 'ACCIONAMIENTO' AS tipo, 'ELECTRICO' AS opcion
    UNION ALL SELECT 109 AS id_item, 'ACCIONAMIENTO' AS tipo, 'HIDRAULICO_INDIRECTO' AS opcion
    UNION ALL SELECT 110 AS id_item, 'ACCIONAMIENTO' AS tipo, 'ELECTRICO' AS opcion
    UNION ALL SELECT 110 AS id_item, 'ACCIONAMIENTO' AS tipo, 'HIDRAULICO_INDIRECTO' AS opcion
    UNION ALL SELECT 111 AS id_item, 'TRACCION_POR' AS tipo, 'CABLE' AS opcion
    UNION ALL SELECT 111 AS id_item, 'TRACCION_POR' AS tipo, 'NO_APLICA' AS opcion
    UNION ALL SELECT 111 AS id_item, 'ACCIONAMIENTO' AS tipo, 'ELECTRICO' AS opcion
    UNION ALL SELECT 111 AS id_item, 'ACCIONAMIENTO' AS tipo, 'HIDRAULICO_INDIRECTO' AS opcion
    UNION ALL SELECT 112 AS id_item, 'TRACCION_POR' AS tipo, 'CABLE' AS opcion
    UNION ALL SELECT 112 AS id_item, 'TRACCION_POR' AS tipo, 'NO_APLICA' AS opcion
    UNION ALL SELECT 112 AS id_item, 'ACCIONAMIENTO' AS tipo, 'ELECTRICO' AS opcion
    UNION ALL SELECT 112 AS id_item, 'ACCIONAMIENTO' AS tipo, 'HIDRAULICO_INDIRECTO' AS opcion
    UNION ALL SELECT 113 AS id_item, 'TRACCION_POR' AS tipo, 'CABLE' AS opcion
    UNION ALL SELECT 113 AS id_item, 'TRACCION_POR' AS tipo, 'NO_APLICA' AS opcion
    UNION ALL SELECT 113 AS id_item, 'ACCIONAMIENTO' AS tipo, 'ELECTRICO' AS opcion
    UNION ALL SELECT 113 AS id_item, 'ACCIONAMIENTO' AS tipo, 'HIDRAULICO_INDIRECTO' AS opcion
    UNION ALL SELECT 114 AS id_item, 'TRACCION_POR' AS tipo, 'CABLE' AS opcion
    UNION ALL SELECT 114 AS id_item, 'TRACCION_POR' AS tipo, 'NO_APLICA' AS opcion
    UNION ALL SELECT 114 AS id_item, 'ACCIONAMIENTO' AS tipo, 'ELECTRICO' AS opcion
    UNION ALL SELECT 114 AS id_item, 'ACCIONAMIENTO' AS tipo, 'HIDRAULICO_INDIRECTO' AS opcion
    UNION ALL SELECT 115 AS id_item, 'TRACCION_POR' AS tipo, 'CABLE' AS opcion
    UNION ALL SELECT 115 AS id_item, 'TRACCION_POR' AS tipo, 'NO_APLICA' AS opcion
    UNION ALL SELECT 115 AS id_item, 'ACCIONAMIENTO' AS tipo, 'ELECTRICO' AS opcion
    UNION ALL SELECT 115 AS id_item, 'ACCIONAMIENTO' AS tipo, 'HIDRAULICO_INDIRECTO' AS opcion
    UNION ALL SELECT 116 AS id_item, 'LIMITADOR_CABINA' AS tipo, 'SI' AS opcion
    UNION ALL SELECT 116 AS id_item, 'ACCIONAMIENTO' AS tipo, 'ELECTRICO' AS opcion
    UNION ALL SELECT 116 AS id_item, 'ACCIONAMIENTO' AS tipo, 'HIDRAULICO_INDIRECTO' AS opcion
    UNION ALL SELECT 118 AS id_item, 'ACCIONAMIENTO' AS tipo, 'ELECTRICO' AS opcion
    UNION ALL SELECT 119 AS id_item, 'ACCIONAMIENTO' AS tipo, 'ELECTRICO' AS opcion
    UNION ALL SELECT 120 AS id_item, 'ACCIONAMIENTO' AS tipo, 'ELECTRICO' AS opcion
    UNION ALL SELECT 121 AS id_item, 'MAQUINA' AS tipo, 'GEARLESS' AS opcion
    UNION ALL SELECT 121 AS id_item, 'MAQUINA' AS tipo, 'CON_REDUCTOR' AS opcion
    UNION ALL SELECT 121 AS id_item, 'MAQUINA' AS tipo, 'NO_APLICA' AS opcion
    UNION ALL SELECT 122 AS id_item, 'ACCIONAMIENTO' AS tipo, 'ELECTRICO' AS opcion
    UNION ALL SELECT 122 AS id_item, 'ENHEBRADO' AS tipo, '2_1' AS opcion
    UNION ALL SELECT 122 AS id_item, 'ENHEBRADO' AS tipo, '4_1' AS opcion
    UNION ALL SELECT 122 AS id_item, 'ENHEBRADO' AS tipo, '6_1' AS opcion
    UNION ALL SELECT 122 AS id_item, 'ENHEBRADO' AS tipo, 'NO_APLICA' AS opcion
    UNION ALL SELECT 123 AS id_item, 'TIPO_PUERTA' AS tipo, 'AUTOMATICA' AS opcion
    UNION ALL SELECT 123 AS id_item, 'TIPO_PUERTA' AS tipo, 'PLEGABLE' AS opcion
    UNION ALL SELECT 123 AS id_item, 'TIPO_PUERTA' AS tipo, 'NO_APLICA' AS opcion
    UNION ALL SELECT 124 AS id_item, 'TIPO_PUERTA' AS tipo, 'AUTOMATICA' AS opcion
    UNION ALL SELECT 124 AS id_item, 'TIPO_PUERTA' AS tipo, 'PLEGABLE' AS opcion
    UNION ALL SELECT 124 AS id_item, 'TIPO_PUERTA' AS tipo, 'NO_APLICA' AS opcion
    UNION ALL SELECT 130 AS id_item, 'TIPO_PUERTA' AS tipo, 'AUTOMATICA' AS opcion
    UNION ALL SELECT 130 AS id_item, 'TIPO_PUERTA' AS tipo, 'PLEGABLE' AS opcion
    UNION ALL SELECT 130 AS id_item, 'TIPO_PUERTA' AS tipo, 'NO_APLICA' AS opcion
    UNION ALL SELECT 133 AS id_item, 'TIPO_PUERTA' AS tipo, 'AUTOMATICA' AS opcion
    UNION ALL SELECT 133 AS id_item, 'TIPO_PUERTA' AS tipo, 'PLEGABLE' AS opcion
    UNION ALL SELECT 133 AS id_item, 'TIPO_PUERTA' AS tipo, 'NO_APLICA' AS opcion
    UNION ALL SELECT 139 AS id_item, 'MIRILLA_PUERTAS' AS tipo, 'SI' AS opcion
    UNION ALL SELECT 140 AS id_item, 'MIRILLA_PUERTAS' AS tipo, 'SI' AS opcion
    UNION ALL SELECT 141 AS id_item, 'CUARTO_POLEAS' AS tipo, 'SI' AS opcion
    UNION ALL SELECT 141 AS id_item, 'MIRILLA_PUERTAS' AS tipo, 'SI' AS opcion
    UNION ALL SELECT 142 AS id_item, 'CUARTO_POLEAS' AS tipo, 'SI' AS opcion
    UNION ALL SELECT 142 AS id_item, 'MIRILLA_PUERTAS' AS tipo, 'SI' AS opcion
    UNION ALL SELECT 143 AS id_item, 'MIRILLA_PUERTAS' AS tipo, 'SI' AS opcion
    UNION ALL SELECT 144 AS id_item, 'CUARTO_POLEAS' AS tipo, 'SI' AS opcion
    UNION ALL SELECT 144 AS id_item, 'MIRILLA_PUERTAS' AS tipo, 'SI' AS opcion
    UNION ALL SELECT 145 AS id_item, 'MIRILLA_PUERTAS' AS tipo, 'SI' AS opcion
    UNION ALL SELECT 146 AS id_item, 'CUARTO_POLEAS' AS tipo, 'SI' AS opcion
    UNION ALL SELECT 146 AS id_item, 'MIRILLA_PUERTAS' AS tipo, 'SI' AS opcion
    UNION ALL SELECT 155 AS id_item, 'ACCIONAMIENTO' AS tipo, 'ELECTRICO' AS opcion
    UNION ALL SELECT 155 AS id_item, 'ACCIONAMIENTO' AS tipo, 'HIDRAULICO_INDIRECTO' AS opcion
    UNION ALL SELECT 156 AS id_item, 'ACCIONAMIENTO' AS tipo, 'ELECTRICO' AS opcion
    UNION ALL SELECT 156 AS id_item, 'ACCIONAMIENTO' AS tipo, 'HIDRAULICO_INDIRECTO' AS opcion
    UNION ALL SELECT 157 AS id_item, 'ACCIONAMIENTO' AS tipo, 'ELECTRICO' AS opcion
    UNION ALL SELECT 157 AS id_item, 'ACCIONAMIENTO' AS tipo, 'HIDRAULICO_INDIRECTO' AS opcion
    UNION ALL SELECT 158 AS id_item, 'ACCIONAMIENTO' AS tipo, 'ELECTRICO' AS opcion
    UNION ALL SELECT 158 AS id_item, 'ACCIONAMIENTO' AS tipo, 'HIDRAULICO_INDIRECTO' AS opcion
    UNION ALL SELECT 159 AS id_item, 'ACCIONAMIENTO' AS tipo, 'ELECTRICO' AS opcion
    UNION ALL SELECT 159 AS id_item, 'ACCIONAMIENTO' AS tipo, 'HIDRAULICO_INDIRECTO' AS opcion
    UNION ALL SELECT 163 AS id_item, 'ACCIONAMIENTO' AS tipo, 'ELECTRICO' AS opcion
    UNION ALL SELECT 163 AS id_item, 'ACCIONAMIENTO' AS tipo, 'HIDRAULICO_INDIRECTO' AS opcion
    UNION ALL SELECT 163 AS id_item, 'MAQUINA' AS tipo, 'HIDRAULICO' AS opcion
    UNION ALL SELECT 163 AS id_item, 'MAQUINA' AS tipo, 'NO_APLICA' AS opcion
    UNION ALL SELECT 165 AS id_item, 'ACCIONAMIENTO' AS tipo, 'HIDRAULICO_DIRECTO' AS opcion
    UNION ALL SELECT 166 AS id_item, 'ACCIONAMIENTO' AS tipo, 'HIDRAULICO_DIRECTO' AS opcion
    UNION ALL SELECT 166 AS id_item, 'ACCIONAMIENTO' AS tipo, 'HIDRAULICO_INDIRECTO' AS opcion
"""


def upgrade():
    op.execute("""
        DELETE v FROM checklist_item_variante v
        JOIN checklist_item i ON i.id_item = v.id_item
        JOIN norma n ON n.id_norma = i.id_norma
        WHERE n.parte = 1 AND n.version = 2012""")
    op.execute(f"""
        INSERT INTO checklist_item_variante (id_item, id_variante_opcion)
        SELECT i.id_item, o.id_variante_opcion
        FROM ({REGLAS}) r
        JOIN norma n ON n.parte = 1 AND n.version = 2012
        JOIN checklist_item i ON i.id_norma = n.id_norma AND i.numero = r.id_item
        JOIN variante_tipo t ON t.codigo = r.tipo
        JOIN variante_opcion o ON o.id_variante_tipo = t.id_variante_tipo AND o.codigo = r.opcion""")


def downgrade():
    # Las reglas anteriores no se restauran: eran una aproximación incorrecta de la plantilla.
    pass
