# Modelo de datos

Base `servilift_db` en MariaDB 10.11 / MySQL 8 (motor InnoDB, `utf8mb4`, fechas en hora de Colombia).
El script completo está en [`database/01_schema.sql`](../database/01_schema.sql); los cambios posteriores se
aplican con migraciones Alembic (`servilift-backend/alembic/versions/0001` a `0005`). En el backend cada tabla
tiene su modelo en `servilift-backend/app/models.py`.

## 1. Diagrama entidad-relación

Son 31 tablas (30 del negocio más `alembic_version`). Para no saturar el diagrama solo se muestran llaves y campos clave.

```mermaid
erDiagram
    ROL ||--o{ USUARIO : "tiene"
    CLIENTE |o--o{ USUARIO : "usuarios del portal"
    USUARIO ||--o{ CLIENTE : "asesor"
    CLIENTE ||--o{ EDIFICIO : "tiene"
    EDIFICIO ||--o{ EQUIPO : "tiene"
    EQUIPO ||--o{ EQUIPO_VARIANTE : "variantes declaradas"

    CLIENTE ||--o{ COTIZACION : "recibe"
    EDIFICIO ||--o{ COTIZACION : "para"
    COTIZACION ||--|{ COTIZACION_EQUIPO : "incluye"
    EQUIPO ||--o{ COTIZACION_EQUIPO : "se cotiza en"
    NORMA ||--o{ COTIZACION_EQUIPO : "se inspecciona con"
    COTIZACION_EQUIPO |o--o| COTIZACION_EQUIPO : "servicio anterior"
    COTIZACION_EQUIPO ||--o{ HISTORIAL_ESTADO : "registra"

    COTIZACION ||--o{ PROGRAMACION : "se agenda en"
    USUARIO ||--o{ PROGRAMACION : "inspector"
    PROGRAMACION ||--|{ PROGRAMACION_EQUIPO : "visita"
    COTIZACION_EQUIPO ||--o{ PROGRAMACION_EQUIPO : "en"

    NORMA ||--o{ CHECKLIST_CATEGORIA : "agrupa"
    CHECKLIST_CATEGORIA ||--o{ CHECKLIST_ITEM : "contiene"
    CHECKLIST_ITEM ||--o{ CHECKLIST_ITEM_VARIANTE : "aplica si"
    VARIANTE_TIPO ||--o{ VARIANTE_OPCION : "opciones"
    VARIANTE_OPCION ||--o{ CHECKLIST_ITEM_VARIANTE : ""

    COTIZACION_EQUIPO ||--o| INSPECCION : "se inspecciona en"
    PROGRAMACION ||--o{ INSPECCION : "1a y 2a visita"
    INSPECCION ||--o{ INSPECCION_VARIANTE : "variantes elegidas"
    INSPECCION ||--o{ INSPECCION_RESULTADO : "califica"
    CHECKLIST_ITEM ||--o{ INSPECCION_RESULTADO : ""
    INSPECCION ||--o{ INSPECCION_FOTO : "evidencia"
    INSPECCION_RESULTADO |o--o{ INSPECCION_FOTO : "de un hallazgo"
    INSPECCION ||--o{ INSPECCION_FIRMA : "firmas"
    INSPECCION ||--o{ INSPECCION_MEDICION : "medidas"
    INSPECCION ||--o{ INSPECCION_INSTRUMENTO : "usa"
    INSTRUMENTO_MEDICION ||--o{ INSPECCION_INSTRUMENTO : ""

    INSPECCION ||--|{ INFORME : "un informe por visita"
    USUARIO |o--o{ INFORME : "director que firma"
    INFORME ||--o| CERTIFICADO : "si es conforme"
    COTIZACION_EQUIPO ||--o{ CERTIFICADO : ""
    USUARIO ||--o{ NOTIFICACION : "recibe"

    USUARIO {
        int id_usuario PK
        int id_rol FK
        int id_cliente FK "solo rol CLIENTE"
        string correo UK
        blob contrasena_encriptada "sal + PBKDF2"
        string estado
    }
    EQUIPO {
        int id_equipo PK
        int id_edificio FK
        string identificacion
        string tipo_equipo
        int numero_paradas
        decimal recorrido_m
        int profundidad_foso_mm
    }
    NORMA {
        int id_norma PK
        string codigo "NTC 5926-1"
        int parte
        int version "2012"
        int plazo_dias_leve
        int plazo_dias_grave
        int plazo_dias_muy_grave
        bool vigente
    }
    COTIZACION {
        int id_cotizacion PK
        string numero_cotizacion UK "COT-AAAA-NNNN"
        string estado
    }
    COTIZACION_EQUIPO {
        int id_cotizacion_equipo PK
        int id_cotizacion FK
        int id_equipo FK
        int id_norma FK
        decimal valor
        string estado "maquina de estados"
        date fecha_limite_correccion
        int id_servicio_anterior FK
    }
    PROGRAMACION {
        int id_programacion PK
        string tipo_visita "PRIMERA o SEGUNDA"
        date fecha_programada
        time hora_inicio
        string estado
    }
    CHECKLIST_ITEM {
        int id_item PK
        int id_norma FK
        int numero "1 a 169"
        string calificacion "LEVE GRAVE MUY_GRAVE"
        bool requiere_medicion
        int foso_minimo_mm
    }
    INSPECCION {
        int id_inspeccion PK
        string numero_inspeccion "INS-AAAA-NNNN"
        int id_cotizacion_equipo FK
        string uuid_offline UK
        string estado
    }
    INSPECCION_RESULTADO {
        int id_resultado PK
        int id_inspeccion FK
        int id_item FK
        string resultado "CUMPLE NO_CUMPLE NO_APLICA"
        string estado_segunda_visita "CORREGIDO NO_CORREGIDO"
        datetime modificado_en_cliente
    }
    INFORME {
        int id_informe PK
        string numero_informe "INF-AAAA-NNNN-1V"
        int numero_visita "1 o 2"
        string estado
        string concepto "CONFORME NO_CONFORME"
        string hash_sha256
    }
    CERTIFICADO {
        int id_certificado PK
        string numero_certificado "CER-AAAA-NNNN"
        int id_informe FK
        string codigo_verificacion UK "QR"
        date fecha_vencimiento
        string estado
    }
```

## 2. Diccionario de tablas

| Área | Tabla | Descripción |
|---|---|---|
| Seguridad | `rol` | Los 7 roles: ADMIN, ASESOR, CLIENTE, PROGRAMACION, INSPECTOR, DIRECTOR_TECNICO, CERTIFICADOS |
| | `usuario` | Usuarios internos y del cliente. Contraseña como BLOB (sal + PBKDF2-SHA256); `id_cliente` enlaza los usuarios del portal |
| Clientes | `cliente` | Persona o empresa (propiedad horizontal, empresa, persona natural, entidad pública) con su asesor |
| | `edificio` | Sedes del cliente |
| | `equipo` | Ascensores y montacargas con sus datos técnicos (paradas, recorrido, foso, capacidad) |
| | `equipo_variante` | Variantes declaradas del equipo (tracción/hidráulico, máquina, etc.) |
| Normas y checklist | `norma` | Parte y edición de la NTC 5926 con sus plazos de corrección; una sola vigente por parte (columna generada `vigente_parte` + índice único) |
| | `variante_tipo`, `variante_opcion` | Catálogo de variantes que filtran el checklist |
| | `checklist_categoria`, `checklist_item` | Ítems de la norma (169 en la NTC 5926-1:2012) con su calificación de defecto |
| | `checklist_item_variante` | Reglas de "no aplica": sin filas el ítem aplica siempre |
| Comercial | `consecutivo` | Último número por prefijo (COT, INS, INF, CER) y año; se bloquea con `SELECT … FOR UPDATE` |
| | `cotizacion` | Cotización a un edificio |
| | `cotizacion_equipo` | **Servicio**: un equipo dentro de una cotización, con su norma, valor, plazo y **estado** |
| | `historial_estado` | Cada cambio de estado del servicio con usuario, fecha y comentario |
| Programación | `programacion`, `programacion_equipo` | Visita (1ª o 2ª) con fecha, hora, inspector y los equipos que cubre |
| Inspección | `inspeccion` | Una por servicio; guarda la 1ª visita y la 2ª (cierre de hallazgos), encabezado y datos medidos |
| | `inspeccion_variante` | Variantes que eligió el inspector |
| | `inspeccion_resultado` | Calificación de cada ítem y, en la 2ª visita, si se corrigió; `modificado_en_cliente` resuelve conflictos sin señal |
| | `inspeccion_foto`, `inspeccion_firma` | Evidencias con `uuid_offline` para no duplicar reenvíos; firmas de inspector, técnico y representante |
| | `instrumento_medicion`, `inspeccion_instrumento`, `inspeccion_medicion` | Equipos de medición usados y medidas tomadas |
| Resultados | `informe` | Uno por visita (`-1V`, `-2V`) con concepto, atestación, firma del director, totales congelados, PDF y huella SHA-256 |
| | `certificado` | Emitido sobre un informe conforme, con vencimiento y código de verificación del QR |
| Sistema | `parametro` | Datos de la empresa y valores editables (metros por parada, etc.) |
| | `notificacion` | Avisos por usuario con enlace a la pantalla de la app |
| | `alembic_version` | Revisión de migraciones aplicada |

### Vistas

| Vista | Uso |
|---|---|
| `v_seguimiento_equipo` | Una fila por servicio con cliente, edificio, asesor y estado; alimenta Seguimiento y los filtros |
| `v_inspeccion_item_aplica` | Para cada inspección e ítem calcula si **aplica** según las variantes elegidas y la profundidad del foso |

## 3. Máquina de estados del servicio (`cotizacion_equipo.estado`)

Definida en `servilift-backend/app/services/flujo.py` (`TRANSICIONES`). Cualquier transición no listada responde
`409 Conflict` y cada cambio queda en `historial_estado`.

```mermaid
stateDiagram-v2
    [*] --> PENDIENTE_APROBACION: Asesor envía la cotización
    PENDIENTE_APROBACION --> APROBADO_CLIENTE: Cliente aprueba
    PENDIENTE_APROBACION --> RECHAZADO: Cliente rechaza
    APROBADO_CLIENTE --> POR_PROGRAMAR: Asesor envía a programación
    POR_PROGRAMAR --> PROGRAMADO: Programación asigna inspector, fecha y hora
    PROGRAMADO --> POR_PROGRAMAR: Visita cancelada
    PROGRAMADO --> EN_INSPECCION: Inspector inicia
    EN_INSPECCION --> EN_REVISION: Inspector finaliza
    EN_REVISION --> EN_INSPECCION: Director devuelve
    EN_REVISION --> INFORME_APROBADO: Conforme (1a o 2a visita)
    EN_REVISION --> NO_CONFORME: 1a visita no conforme
    EN_REVISION --> CERRADO_NO_CONFORME: 2a visita con hallazgos sin corregir
    NO_CONFORME --> SEGUNDA_VISITA_SOLICITADA: Cliente o asesor la solicita
    SEGUNDA_VISITA_SOLICITADA --> PROGRAMADO: Programación agenda la 2a visita
    INFORME_APROBADO --> CERTIFICADO_LISTO: Certificados emite y envía
    CERTIFICADO_LISTO --> [*]
    CERRADO_NO_CONFORME --> [*]: Requiere cotización nueva
    RECHAZADO --> [*]
    note right of PENDIENTE_APROBACION
        Hasta PROGRAMADO (inclusive) el servicio
        también puede pasar a ANULADO
    end note
```

El plazo de corrección tras una 1ª visita no conforme es el menor entre los hallazgos: leve 180 días, grave 30,
muy grave inmediato (configurables por norma en la tabla `norma` o por ítem en `checklist_item.plazo_dias`).

## 4. Otros estados

| Entidad | Estados |
|---|---|
| `cotizacion` | BORRADOR, ENVIADA_CLIENTE, APROBADA_CLIENTE, RECHAZADA_CLIENTE, ENVIADA_PROGRAMACION, EN_EJECUCION, FINALIZADA, ANULADA |
| `programacion` | PROGRAMADA, REPROGRAMADA, EN_CURSO, REALIZADA, CANCELADA |
| `inspeccion` | EN_CURSO, FINALIZADA, DEVUELTA, APROBADA, EN_SEGUNDA_VISITA, CERRADA |
| `informe` | PENDIENTE_REVISION, DEVUELTO, APROBADO, ANULADO (concepto CONFORME / NO_CONFORME) |
| `certificado` | EN_ELABORACION, EMITIDO, ENVIADO_CLIENTE, ANULADO |

## 5. Migraciones

| Revisión | Cambio |
|---|---|
| `0001_v2_esquema_base` | Esquema v2 completo |
| `0002_reglas_no_aplica` | Reglas de "no aplica" por variante según la plantilla de informe 2012 |
| `0003_foso_minimo` | El ítem 12 no aplica con foso menor a 1500 mm |
| `0004_parametros_recorrido` | Metros por parada y sobre recorrido editables |
| `0005_contrasena_blob` | Contraseñas en BLOB con PBKDF2-SHA256 |

Una base creada antes se pone al día con `cd servilift-backend` y `uv run alembic upgrade head`.
