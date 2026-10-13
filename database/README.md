# ServiLift v2 – Base de datos

MariaDB 10.4+ (XAMPP) o MySQL 8+. Crea la base `servilift_db`.

```bash
mysql -u root --default-character-set=utf8mb4 < 01_schema.sql
mysql -u root --default-character-set=utf8mb4 < 02_seed.sql
mysql -u root --default-character-set=utf8mb4 < 03_datos_iniciales.sql
```

| Archivo | Contenido |
|---|---|
| `01_schema.sql` | Tablas, llaves, índices, vistas y la revisión de Alembic más reciente |
| `02_seed.sql` | Roles, norma NTC 5926-1:2012 (vigente), variantes, checklist de 169 ítems y parámetros |
| `03_datos_iniciales.sql` | Usuarios de prueba (`@gmail.com`, contraseña `123456`) y un cliente con 2 edificios |

> La v2 no es compatible con una base v1. Si ya tiene `servilift_db` de la versión anterior, haga un
> respaldo y créela de nuevo (o use otro nombre de base en el `.env` del backend).

## Cambios frente a la v1

| Tema | v1 | v2 |
|---|---|---|
| Norma | Texto fijo "NTC 5926-1" | Tabla `norma` (parte + edición). Cada edición tiene su checklist y sus plazos. Una sola vigente por parte |
| Informe | Una fila con columnas `*_visita1` | **Una fila por visita** (`numero_visita` 1 o 2), cada una con su PDF, firma, concepto y huella |
| Segunda visita no conforme | No estaba definido | Estado `CERRADO_NO_CONFORME`: no hay tercera visita, se requiere cotización nueva (`id_servicio_anterior` la enlaza) |
| Fechas | Mezcla de `TIMESTAMP` y `DATETIME` | Todo `DATETIME` en hora de Colombia (el backend fija `time_zone = '-05:00'`) |
| Fotos | Visita deducida por la fecha | Columna `numero_visita` |
| Trabajo sin señal | Solo `uuid_offline` en inspección y fotos | También en firmas, y `modificado_en_cliente` en resultados (el cambio más reciente gana) |
| Auditoría | Tabla sin uso | Eliminada |
| Búsqueda | Solo por número de cotización | Índices para nombre de cliente, edificio y equipos por edificio; vista con `id_asesor` |
| Migraciones | Scripts sueltos | Alembic (tabla `alembic_version`) |

## Estados por equipo (`cotizacion_equipo.estado`)

```
PENDIENTE_APROBACION → APROBADO_CLIENTE → POR_PROGRAMAR → PROGRAMADO → EN_INSPECCION → EN_REVISION
   EN_REVISION ─ 1ª visita conforme ──────────────────────────────→ INFORME_APROBADO → CERTIFICADO_LISTO
   EN_REVISION ─ 1ª visita no conforme → NO_CONFORME → SEGUNDA_VISITA_SOLICITADA → PROGRAMADO → … → EN_REVISION
   EN_REVISION ─ 2ª visita: todo corregido ───────────────────────→ INFORME_APROBADO
   EN_REVISION ─ 2ª visita: algo sin corregir ────────────────────→ CERRADO_NO_CONFORME (cotización nueva)
```
Además `RECHAZADO` y `ANULADO`. Cada cambio queda en `historial_estado`.

## Agregar una edición nueva de la norma (ej. NTC 5926-1:2021) o la parte 2 / 3

1. Registrarla desde la app (Administrador → *Normas y checklist*) o con un `INSERT` en `norma`.
2. Cargar su checklist: filas en `checklist_categoria` e `checklist_item` con su `id_norma`
   (y, si aplica, reglas de variantes en `checklist_item_variante`; las variantes de otra parte
   van en `variante_tipo` con su `parte_norma`).
3. Marcarla como vigente. Las cotizaciones nuevas la usan; las ya hechas conservan la suya.

## Vistas

- `v_seguimiento_equipo`: una fila por equipo cotizado con cotización, cliente, edificio, asesor, norma,
  última programación, inspección, informe de 1ª y de 2ª visita y certificado.
- `v_inspeccion_item_aplica`: qué ítems de la norma de cada inspección aplican según sus variantes. Las reglas
  (`checklist_item_variante`) salen de las fórmulas "NO APLICA" de la plantilla de informe 2012: un ítem aplica
  solo si, en cada tipo de variante con reglas, la opción elegida está en su lista.

## Migraciones (Alembic)

La base creada con estos scripts queda en la última revisión (`0002_reglas_no_aplica`). Una base creada
antes se pone al día con `alembic upgrade head`. Para cambios futuros, desde
`servilift-backend` con el entorno activado:

```bash
alembic revision -m "agrega columna x"   # escribir upgrade() y downgrade()
alembic upgrade head
```
