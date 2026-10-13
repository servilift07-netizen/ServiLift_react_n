# instalar.ps1 - Prepara ServiLift en un PC con Windows (backend, app, pruebas E2E y bases de datos).
#
# Uso, desde la carpeta del proyecto:
#   powershell -ExecutionPolicy Bypass -File .\instalar.ps1                  # dependencias y archivos .env
#   powershell -ExecutionPolicy Bypass -File .\instalar.ps1 -ConBaseDeDatos  # además crea las bases (MySQL de XAMPP encendido)
#
# Se puede ejecutar varias veces: lo que ya existe (.venv, .env, bases) no se toca.

param(
    [switch]$ConBaseDeDatos,
    [string]$Mysql = "C:\xampp\mysql\bin\mysql.exe"
)

$ErrorActionPreference = "Stop"
$raiz = $PSScriptRoot

function Paso($texto) { Write-Host "`n==> $texto" -ForegroundColor Cyan }

function Requiere($comando, $ayuda) {
    if (-not (Get-Command $comando -ErrorAction SilentlyContinue)) { throw "No se encontró '$comando'. $ayuda" }
}

# Los programas externos (pip, npm) no detienen el script por sí solos: se revisa su código de salida
function Ejecutar([scriptblock]$bloque, $descripcion) {
    & $bloque
    if ($LASTEXITCODE -ne 0) { throw "Falló: $descripcion (código $LASTEXITCODE)" }
}

function CopiarEnv($carpeta) {
    $env_ = Join-Path $carpeta ".env"
    if (-not (Test-Path $env_)) { Copy-Item (Join-Path $carpeta ".env.example") $env_; Write-Host "   creado $env_" }
}

Paso "Revisando programas necesarios"
Requiere python "Instale Python 3.13 desde python.org y marque 'Add python.exe to PATH'."
Requiere node "Instale Node.js 22 LTS o superior desde nodejs.org."
Requiere npm "Se instala junto con Node.js."
if (-not (Get-Command pnpm -ErrorAction SilentlyContinue)) {
    Paso "Instalando pnpm (gestor de paquetes de las pruebas E2E)"
    Ejecutar { npm install -g pnpm@10.34.5 } "instalar pnpm"
}
if (-not (Get-Command uv -ErrorAction SilentlyContinue)) {
    Paso "Instalando uv (maneja Python y las dependencias del backend)"
    Ejecutar { powershell -ExecutionPolicy ByPass -NoProfile -c "irm https://astral.sh/uv/install.ps1 | iex" } "instalar uv"
    $env:Path = "$env:USERPROFILE\.local\bin;$env:Path"
}
Write-Host "   $(python --version) · $(uv --version) · Node $(node --version) · pnpm $(pnpm --version)"

Paso "Backend (servilift-backend): dependencias con uv"
$backend = Join-Path $raiz "servilift-backend"
Push-Location $backend
try {
    # Crea .venv e instala exactamente lo de uv.lock (incluye las herramientas de pruebas)
    Ejecutar { uv sync --locked } "instalar dependencias del backend"
    $nuevo = -not (Test-Path ".env")
    CopiarEnv $backend
    # .env.example apunta a la base de Docker; con -ConBaseDeDatos se usa la de XAMPP (root sin clave, 3306)
    if ($nuevo -and $ConBaseDeDatos) {
        (Get-Content ".env") -replace '^DB_USER=.*', 'DB_USER=root' -replace '^DB_PASSWORD=.*', 'DB_PASSWORD=' `
            -replace '^DB_PORT=.*', 'DB_PORT=3306' | Set-Content ".env" -Encoding UTF8
        Write-Host "   .env apuntando al MySQL de XAMPP"
    }
} finally { Pop-Location }

Paso "App (servilift-app): dependencias de Expo"
$app = Join-Path $raiz "servilift-app"
Push-Location $app
try {
    Ejecutar { npm ci --no-audit --no-fund } "instalar dependencias de la app"
    CopiarEnv $app
} finally { Pop-Location }

Paso "Pruebas E2E (e2e): Playwright y navegador Chromium"
Push-Location (Join-Path $raiz "e2e")
try {
    Ejecutar { pnpm install --frozen-lockfile } "instalar Playwright"
    Ejecutar { pnpm exec playwright install chromium } "descargar Chromium"
} finally { Pop-Location }

if ($ConBaseDeDatos) {
    if (-not (Test-Path $Mysql)) { throw "No se encontró $Mysql. Instale XAMPP o indique la ruta con -Mysql." }
    # Los scripts SQL tienen tildes: se envían a mysql en UTF-8
    $OutputEncoding = New-Object System.Text.UTF8Encoding $false
    $scripts = "01_schema.sql", "02_seed.sql", "03_datos_iniciales.sql" | ForEach-Object { Join-Path $raiz "database\$_" }

    # servilift_db: la del día a día · servilift_v2_prueba: la de las pruebas E2E e integración
    foreach ($base in "servilift_db", "servilift_v2_prueba") {
        Paso "Base de datos $base"
        $existe = & $Mysql -u root -N -e "SHOW DATABASES LIKE '$base'"
        if ($LASTEXITCODE -ne 0) { throw "No se pudo conectar a MySQL. Encienda MySQL en el panel de XAMPP." }
        if ($existe) { Write-Host "   ya existe: no se modifica"; continue }
        foreach ($sql in $scripts) {
            $texto = (Get-Content $sql -Raw -Encoding UTF8) -replace "servilift_db", $base
            Ejecutar { $texto | & $Mysql -u root --default-character-set=utf8mb4 } "cargar $sql en $base"
        }
        Write-Host "   creada con esquema, catálogos y usuarios de prueba"
    }
}

Paso "Listo"
Write-Host @"
   Backend : cd servilift-backend ; uv run uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
   App web : cd servilift-app ; npx expo start --web
   Pruebas : cd servilift-app ; npm test            (unitarias de la app + cobertura)
             cd servilift-backend ; uv run pytest   (unitarias del backend + cobertura)
             cd e2e ; pnpm test                     (E2E: levanta backend 8010 y app 8091 con la base de prueba)
"@
