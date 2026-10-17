# ServiLift v2 – Backend (FastAPI)

API de la certificación de ascensores NTC 5926: clientes, cotizaciones, programación, inspección
(1ª y 2ª visita), informes por visita, certificados con QR y portal del cliente.

## Puesta en marcha

Con [uv](https://docs.astral.sh/uv/) (las dependencias están en `pyproject.toml` y fijadas en `uv.lock`):

```bash
uv sync                     # crea .venv e instala todo (también pytest)
copy .env.example .env      # solo si necesita otra base de datos; sin .env usa los valores por defecto
uv run uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
uv run pytest               # unitarias + cobertura
uv add paquete==x.y.z       # agrega una dependencia (actualiza pyproject.toml y uv.lock)
```
La base se crea con los scripts de `../database`. Documentación interactiva: http://localhost:8000/docs

## Organización

```
app/
├── main.py         app, CORS, rutas y entrega de fotos/firmas con enlace firmado
├── config.py       .env (base, zona horaria, CORS)
├── tiempo.py       hora de Colombia: ahora(), hoy() y conversión de fechas del celular
├── database.py     conexión (fija time_zone en cada conexión)
├── models.py       modelos ORM
├── security.py     contraseñas, JWT, roles, enlaces de descarga y de archivos
├── routes/         auth, usuarios, clientes (búsqueda), cotizaciones, programacion, inspecciones,
│                   informes (uno por visita), certificados, seguimiento, catalogos (normas), dashboard
└── services/       flujo (estados), checklist (por norma), archivos (fotos, firmas por trazos), pdf
alembic/            migraciones (0001_v2 base, 0002 reglas de no aplica, 0003 foso mínimo, 0004 parámetros de recorrido, 0005 contraseñas en BLOB)
tests/test_flujo.py prueba de punta a punta
```

## Endpoints principales

| Paso | Rol | Endpoint |
|---|---|---|
| Buscar clientes / edificios / equipos | Oficina | `GET /clientes?buscar=`, `GET /edificios?buscar=`, `GET /equipos?id_edificio=` |
| Normas | Admin | `GET/POST /catalogos/normas`, `PUT /catalogos/normas/{id}` (marcar vigente) |
| Cotizar (norma por equipo) | Asesor | `POST /cotizaciones` |
| Programar 1ª o 2ª visita | Programación | `GET /programacion/pendientes`, `POST /programacion` |
| Agenda e informe precargado | Inspector | `GET /inspecciones/agenda`, `POST /inspecciones/iniciar` |
| Checklist (idempotente, el más reciente gana) | Inspector | `PUT /inspecciones/{id}/resultados`, `PUT /inspecciones/{id}/segunda-visita` |
| Fotos y firmas (con `uuid_offline`) | Inspector | `POST /inspecciones/{id}/fotos`, `POST /inspecciones/{id}/firmas` (imagen o `dibujo`) |
| Finalizar visita | Inspector | `GET /inspecciones/{id}/validar`, `POST /inspecciones/{id}/finalizar` |
| Revisar informe de la visita | Director | `POST /informes/{id}/devolver`, `POST /informes/{id}/aprobar` |
| Solicitar 2ª visita | Cliente / Asesor | `POST /seguimiento/equipo/{id}/solicitar-segunda-visita` |
| Certificado | Certificados | `GET /certificados/pendientes`, `POST /certificados`, `POST /certificados/{id}/enviar` |
| Seguimiento | Todos | `GET /seguimiento?numero_cotizacion=&buscar=` |
| Verificación del QR | Público | `GET /verificar/{codigo}` |

## Pruebas

```bash
uv run pytest                                                   # unitarias (tests/unit) + cobertura, sin base de datos
DB_NAME=servilift_v2_prueba uv run pytest -m integracion --no-cov   # integración (PowerShell: $env:DB_NAME="servilift_v2_prueba")
```
La de integración (`tests/test_flujo.py`, también `uv run python -m tests.test_flujo`) recorre: normas, búsqueda,
cotización, programación, inspección de 169 ítems, enlaces firmados, idempotencia, "el cambio más reciente gana",
devolución y aprobación, 2ª visita conforme con certificado, y 2ª visita no conforme con cotización nueva
enlazada. Deja PDF de ejemplo en `tests/salida/`. Detalle de todos los niveles: [../docs/pruebas.md](../docs/pruebas.md).

## Migraciones

```bash
uv run alembic current
uv run alembic revision -m "descripción"
uv run alembic upgrade head
```

Arquitectura, modelo de datos y casos de uso: [../docs/](../docs/README.md).
