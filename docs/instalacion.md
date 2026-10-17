# Instalación y puesta en marcha

Esta guía sirve para Windows, Linux y macOS. La versión paso a paso para el PC de desarrollo en Windows (con
rutas y el instalador `instalar.ps1`) está en [../GUIA_EJECUCION.md](../GUIA_EJECUCION.md).

## 1. Requisitos

| Herramienta | Versión | Para qué |
|---|---|---|
| Git | cualquiera reciente | Clonar el repositorio |
| Docker Desktop (o Docker Engine + Compose) | Compose v2 | Base de datos MariaDB 10.11 |
| [uv](https://docs.astral.sh/uv/) | 0.13 o superior | Instala Python 3.13 y las dependencias exactas del backend (`uv.lock`) |
| Node.js | 22 o superior | App Expo y pruebas E2E |
| pnpm | 10 | Solo para las pruebas E2E (`e2e/`) |
| Expo Go o Android Studio | — | Probar la app en el celular o en un emulador |

Instalar uv:

```bash
# Linux / macOS
curl -LsSf https://astral.sh/uv/install.sh | sh
# Windows (PowerShell)
powershell -ExecutionPolicy ByPass -c "irm https://astral.sh/uv/install.ps1 | iex"
```

> Alternativa sin Docker: el MySQL/MariaDB de XAMPP, cargando a mano los scripts de `database/`
> (ver GUIA_EJECUCION.md, "Base en XAMPP").

## 2. Clonar

```bash
git clone -b version-2.1 https://github.com/servilift07-netizen/ServiLift_react_n.git servilift
cd servilift
```

En Windows, `instalar.ps1` hace los pasos 4 y 5 de una vez (uv, dependencias, Playwright y copia de los `.env`).

## 3. Base de datos con Docker

```bash
docker compose up -d       # crea y enciende la base
docker compose ps          # "servilift-db" debe quedar "healthy"
```

Qué hace `docker-compose.yml`:

| Elemento | Valor |
|---|---|
| Imagen | `mariadb:10.11`, contenedor `servilift-db` |
| Puerto | `3307` en el PC → `3306` en el contenedor (no choca con XAMPP) |
| Usuario de la app | `servilift` / `servilift` (root: `servilift-root`) |
| Juego de caracteres y zona | `utf8mb4_unicode_ci`, `-05:00` |
| Datos | Volumen `servilift-datos` (sobrevive a apagar o recrear el contenedor) |
| Primera vez | `database/docker/01_crear_bases.sh` crea `servilift_db` (día a día) y `servilift_v2_prueba` (integración y E2E) con `01_schema.sql`, `02_seed.sql` y `03_datos_iniciales.sql` |

Comandos útiles:

```bash
docker compose stop        # apaga sin borrar
docker compose down -v     # BORRA la base: la próxima vez se crea de cero
docker exec -it servilift-db mariadb -uservilift -pservilift servilift_db   # consola SQL
```

Para pasar datos que ya existen en XAMPP: `database/migrar_xampp_a_docker.ps1` (Windows).

## 4. Backend con uv

```bash
cd servilift-backend
uv sync                    # crea .venv con Python 3.13 y las versiones de uv.lock
cp .env.example .env       # Windows: copy .env.example .env
uv run alembic upgrade head   # solo si la base se creó con una versión anterior del esquema
uv run uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

- http://localhost:8000 → `{"message": "ServiLift API funcionando"}`
- http://localhost:8000/docs → documentación interactiva (Swagger) de todos los endpoints.
- `uv sync` instala también el grupo `dev` (pytest, pytest-cov). En el CI se usa `uv sync --locked`, que falla si
  `pyproject.toml` y `uv.lock` no coinciden; tras cambiar dependencias corra `uv lock`.

Agregar una dependencia: `uv add <paquete>` (o `uv add --dev <paquete>` para pruebas). Crear un administrador
nuevo: `uv run python -m scripts.crear_admin "Nombre Apellido" admin@empresa.com` (pide la contraseña).

### Variables de entorno del backend (`servilift-backend/.env`)

| Variable | Por defecto en el código | En `.env.example` | Descripción |
|---|---|---|---|
| `DB_USER` / `DB_PASSWORD` | `root` / vacío | `servilift` / `servilift` | Credenciales de la base |
| `DB_HOST` / `DB_PORT` | `127.0.0.1` / `3306` | `127.0.0.1` / `3307` | 3307 = Docker, 3306 = XAMPP |
| `DB_NAME` | `servilift_db` | `servilift_db` | `servilift_v2_prueba` para integración y E2E |
| `ZONA_HORARIA` | `-05:00` | `-05:00` | Formato `±HH:MM`; se valida al arrancar |
| `SECRET_KEY` | clave de demostración | comentada | Firma de los JWT. **Definirla en un despliegue real** |
| `ALGORITHM` / `ACCESS_TOKEN_EXPIRE_MINUTES` | `HS256` / `720` | — | Algoritmo y duración del token |
| `STORAGE_DIR` | `storage` | `storage` | Carpeta de fotos, firmas y PDF |
| `MAX_FOTO_MB` | `15` | `15` | Tamaño máximo por foto |
| `ARCHIVOS_URL_MINUTOS` | `720` | `720` | Vigencia de los enlaces firmados de fotos y firmas |
| `URL_VERIFICACION` | `http://localhost:8000/verificar` | igual | URL que va en el QR del certificado |
| `CORS_ORIGINS` | vacío | vacío | Orígenes web extra permitidos, separados por coma |

## 5. App (Expo)

```bash
cd servilift-app
npm install
cp .env.example .env       # Windows: copy .env.example .env
npx expo start --web       # navegador: http://localhost:8081
npx expo start             # celular: escanear el QR con Expo Go
```

`EXPO_PUBLIC_API_URL` en `servilift-app/.env` indica dónde está el backend:

| Dónde corre la app | Valor |
|---|---|
| Navegador en el mismo PC | `http://localhost:8000` |
| Emulador Android | `http://10.0.2.2:8000` |
| Celular en la misma Wi‑Fi | `http://IP_DEL_PC:8000` |

Después de cambiar `.env` reinicie con `npx expo start --clear`. Instalador Android: `npx eas build -p android --profile preview`.

## 6. Usuarios de prueba

Contraseña `123456` para todos: `admin@gmail.com`, `asesor@gmail.com`, `programacion@gmail.com`,
`inspector@gmail.com`, `director@gmail.com`, `certificados@gmail.com`, `cliente@gmail.com`.

## 7. Comprobación rápida

```bash
docker compose ps                                   # healthy
curl http://localhost:8000/                         # API funcionando
cd servilift-backend && uv run pytest               # unitarias del backend en verde
cd ../servilift-app && npm test                     # unitarias de la app en verde
```

Problemas frecuentes: ver la tabla "Problemas comunes" de [GUIA_EJECUCION.md](../GUIA_EJECUCION.md).
