# ServiLift v2 – Cómo ejecutar el proyecto (paso a paso)

Carpeta del proyecto: `C:\src\ServiLift_react_n`

Requisitos: Git, **Docker Desktop** (base de datos), **uv** (backend; el instalador lo agrega), Node.js 22+ y,
para el celular, la app **Expo Go** (Play Store / App Store) o Android Studio. Las pruebas E2E usan además pnpm
(el instalador lo agrega). XAMPP sigue sirviendo como alternativa a Docker (ver "Base en XAMPP").

## 0. En un PC nuevo: instalación automática
```
git clone -b version-2.1 https://github.com/servilift07-netizen/ServiLift_react_n.git "servi lift react"
cd "servi lift react"
powershell -ExecutionPolicy Bypass -File .\instalar.ps1
docker compose up -d
```
El script instala uv y las dependencias del backend, de la app y de Playwright, y copia los `.env` de ejemplo
(ya apuntan a la base de Docker). `docker compose up -d` crea la base la primera vez. No modifica nada que ya exista.
Después siga en el paso 2 (cada vez que vaya a trabajar).

## 1. Base de datos (Docker)
1. Abra **Docker Desktop** y espere a que diga *Engine running*.
2. Desde la carpeta del proyecto:
   ```
   docker compose up -d
   docker compose ps          # la base "servilift-db" debe quedar "healthy"
   ```
   La primera vez crea `servilift_db` y la base de pruebas `servilift_v2_prueba` con los scripts de `database/`.
   Queda en el puerto **3307** (usuario `servilift`, contraseña `servilift`) para no chocar con XAMPP.
   Los datos se guardan en el volumen `servilift-datos`: `docker compose stop` la apaga sin borrar nada.
3. **Pasar los datos que ya tiene en XAMPP** (una sola vez, con XAMPP y Docker encendidos):
   ```
   powershell -ExecutionPolicy Bypass -File .\database\migrar_xampp_a_docker.ps1
   ```
   Respalda `servilift_db` de XAMPP en `database\servilift_db_xampp_<fecha>.sql`, lo carga en Docker y compara
   las tablas. Luego ponga en `servilift-backend\.env` los valores de `.env.example` (puerto 3307).
   Si XAMPP está en otro PC, genere allá el respaldo con `mysqldump --databases servilift_db` (el comando exacto
   está al inicio del script), cópielo y cárguelo con `.\database\migrar_xampp_a_docker.ps1 -Respaldo C:\ruta\servilift_db.sql`.
   Copie también la carpeta `servilift-backend\storage` (fotos y PDF).
4. Una base creada antes se pone al día con las migraciones: `cd servilift-backend` y `uv run alembic upgrade head`.

### Base en XAMPP (alternativa sin Docker)
1. Abra el **Panel de control de XAMPP** y pulse **Start** en **MySQL**; en `.env` use `DB_USER=root`, `DB_PASSWORD=` y `DB_PORT=3306`.
2. Solo la primera vez (o `instalar.ps1 -ConBaseDeDatos`):
   ```
   cd "C:\Users\PC\Documents\Sena\LiftSafe\servi lift react\database"
   C:\xampp\mysql\bin\mysql -u root --default-character-set=utf8mb4 < 01_schema.sql
   C:\xampp\mysql\bin\mysql -u root --default-character-set=utf8mb4 < 02_seed.sql
   C:\xampp\mysql\bin\mysql -u root --default-character-set=utf8mb4 < 03_datos_iniciales.sql
   ```

## 2. Backend (API)
El backend se maneja con **uv** (instala Python y las dependencias exactas de `uv.lock`). Si no lo tiene:
`powershell -ExecutionPolicy ByPass -c "irm https://astral.sh/uv/install.ps1 | iex"` y abra una terminal nueva.

Solo la primera vez:
```
cd "C:\Users\PC\Documents\Sena\LiftSafe\servi lift react\servilift-backend"
uv sync
copy .env.example .env
```
No hay que configurar ninguna clave secreta: el `.env` solo hace falta si la base de datos no es la de XAMPP por defecto.

Cada vez que vaya a trabajar:
```
cd "C:\Users\PC\Documents\Sena\LiftSafe\servi lift react\servilift-backend"
uv run uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```
Compruebe http://localhost:8000 → "ServiLift API funcionando". Documentación: http://localhost:8000/docs

## 3. App en el computador (oficina)
En otra terminal, la primera vez:
```
cd "C:\Users\PC\Documents\Sena\LiftSafe\servi lift react\servilift-app"
npm install
copy .env.example .env
```
Cada vez:
```
npx expo start --web
```
Se abre el navegador en http://localhost:8081 con el login.

## 4. App en el celular del inspector
1. Averigüe la IP del PC: `ipconfig` → "Dirección IPv4" (ej. 192.168.1.50).
2. En `servilift-app\.env` ponga `EXPO_PUBLIC_API_URL=http://192.168.1.50:8000` (emulador Android: `http://10.0.2.2:8000`).
3. Ejecute `npx expo start` y escanee el código QR con **Expo Go** (celular y PC en la misma Wi‑Fi).
4. Si no conecta, permita los puertos 8000 y 8081 en el Firewall de Windows.
5. Para un instalador (.apk) se usa EAS Build: `npx eas build -p android --profile preview`
   (requiere cuenta gratuita de Expo).

## 5. Usuarios de prueba (contraseña `123456`)
admin@gmail.com, asesor@gmail.com, programacion@gmail.com, inspector@gmail.com, director@gmail.com,
certificados@gmail.com, cliente@gmail.com. Los usuarios nuevos también se pueden crear con `123456`.

## 6. Recorrido del flujo completo
1. **Asesor**: Clientes y edificios → Edificios → *Edificio 1* → *Nueva cotización* → elegir equipos, valor y norma → *Enviar al cliente*.
2. **Cliente**: Cotizaciones → abrir → *Aprobar*.
3. **Asesor**: la cotización → *Aceptar y enviar a programación*.
4. **Programación**: Por programar → *Programar* (inspector, fecha, hora).
5. **Inspector** (celular): Mi agenda → *Iniciar* (con señal) → Datos, Checklist, Fotos, Firmas (con o sin señal) → *Finalizar* (con señal).
6. **Director técnico**: Informes por revisar → revisar → *Aprobar, firmar y generar PDF*.
   - Conforme → pasa a Certificados.
   - No conforme → el cliente o el asesor solicitan la **2ª visita** dentro del plazo; Programación la agenda.
   - En la 2ª visita, si queda algún hallazgo sin corregir el equipo queda **cerrado no conforme** y el asesor crea una cotización nueva.
7. **Certificados**: Por elaborar → *Elaborar certificado* → Certificados emitidos → *Enviar*.
8. **Cliente**: Mis equipos → informes de 1ª y 2ª visita y certificado.

## 7. Probar el trabajo sin señal
Abra la inspección con señal, luego apague el Wi‑Fi/datos del celular (o detenga el backend):
califique ítems, tome fotos y firme. Arriba verá la nube con el número de cambios pendientes y en
cada ítem "Guardado en el teléfono". Al volver la señal se envían solos (menú *Sincronización* muestra el detalle).

## 8. Pruebas automáticas
| Qué | Dónde | Comando | Necesita |
|---|---|---|---|
| Unitarias de la app + cobertura | `servilift-app` | `npm test` | Nada (ni backend ni base) |
| Unitarias del backend + cobertura | `servilift-backend` | `uv run pytest` | Nada (ni base ni red) |
| Integración (flujo completo por la API) | `servilift-backend` | `$env:DB_NAME="servilift_v2_prueba"` (PowerShell) y luego `uv run pytest -m integracion --no-cov` | MySQL encendido |
| E2E con Playwright | `e2e` | `pnpm test` (`pnpm test:ui` paso a paso, `pnpm report` reporte) | MySQL encendido |

- Los comandos de unitarias fallan si la cobertura baja del umbral (`vitest.config.mts` y `pyproject.toml`).
- Las E2E levantan solas el backend en el puerto **8010** y la app en el **8091** contra `servilift_v2_prueba`:
  no chocan con el backend (8000) ni con Expo (8081) del día a día y nunca tocan `servilift_db`.
- GitHub Actions corre las unitarias en cada pull request (`.github/workflows/tests.yml`).
- Matriz de rotación, cobertura semanal y mutantes: `docs/matriz-rotacion.md`.

## Problemas comunes
| Síntoma | Solución |
|---|---|
| Login: "Sin conexión con el servidor" | El backend no está encendido o `EXPO_PUBLIC_API_URL` es incorrecta |
| Cambié `.env` de la app y no toma la IP | Detenga Expo y vuelva a ejecutar `npx expo start --clear` |
| Error de conexión a la base | La base no está encendida: `docker compose up -d` (o MySQL en XAMPP) y revise `DB_PORT` en `.env` |
| Docker: "WSL2 no se puede iniciar porque la virtualización no está habilitada" | Active la virtualización (Intel VT-x / AMD-V o SVM) en la BIOS/UEFI del PC y reinicie |
| Docker: "port 3307 is already allocated" | Otro programa usa el 3307: cambie el puerto en `docker-compose.yml` y en `.env` |
| `instalar.ps1` no se puede ejecutar | Use `powershell -ExecutionPolicy Bypass -File .\instalar.ps1` |
| E2E: "port 8010 is already used" | Hay otro backend de pruebas abierto: ciérrelo o use `$env:API_PORT=8011; pnpm test` |
