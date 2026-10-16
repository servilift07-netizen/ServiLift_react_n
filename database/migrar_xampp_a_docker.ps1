# migrar_xampp_a_docker.ps1 - Copia la base servilift_db del MySQL de XAMPP a la base de Docker.
#
# Uso, desde la carpeta del proyecto (XAMPP encendido y Docker Desktop abierto):
#   powershell -ExecutionPolicy Bypass -File .\database\migrar_xampp_a_docker.ps1
#
# Qué hace:
#   1. Enciende la base de Docker (docker compose up -d) y espera a que esté lista.
#   2. Respalda servilift_db de XAMPP en database\servilift_db_xampp_<fecha>.sql (no se sube a git).
#   3. Reemplaza servilift_db en Docker por ese respaldo y le devuelve los permisos al usuario de la app.
#   4. Compara cuántas filas hay en las tablas principales en XAMPP y en Docker.
# XAMPP no se modifica: si algo sale mal, sigue funcionando como antes.
#
# Si XAMPP está en otro PC: allá genere el respaldo con
#   C:\xampp\mysql\bin\mysqldump -uroot --default-character-set=utf8mb4 --single-transaction --hex-blob --routines --triggers --databases servilift_db --result-file=servilift_db.sql
# cópielo a este PC y cárguelo sin XAMPP (se omiten el paso 2 y la comparación con XAMPP):
#   powershell -ExecutionPolicy Bypass -File .\database\migrar_xampp_a_docker.ps1 -Respaldo C:\ruta\servilift_db.sql

param(
    [string]$Respaldo = "",
    [string]$MysqlBin = "C:\xampp\mysql\bin",
    [string]$Base = "servilift_db",
    [string]$ClaveRoot = "servilift-root",
    [string]$UsuarioApp = "servilift"
)

$ErrorActionPreference = "Stop"
$raiz = Split-Path $PSScriptRoot -Parent
$contenedor = "servilift-db"

function Paso($texto) { Write-Host "`n==> $texto" -ForegroundColor Cyan }
function Ejecutar([scriptblock]$bloque, $descripcion) {
    & $bloque
    if ($LASTEXITCODE -ne 0) { throw "Falló: $descripcion (código $LASTEXITCODE)" }
}
function EnDocker($sql, $base = "") {
    # Sin base se omite el argumento: PowerShell 7.3+ pasaría "" y el cliente lo tomaría como nombre de base
    $argumentos = @("exec", $contenedor, "mariadb", "-uroot", "-p$ClaveRoot", "-N", "-e", $sql)
    if ($base) { $argumentos += $base }
    $salida = docker @argumentos
    if ($LASTEXITCODE -ne 0) { throw "Falló en Docker: $sql" }
    return $salida
}

Paso "Encendiendo la base de Docker"
Push-Location $raiz
try { Ejecutar { docker compose up -d db } "docker compose up (¿está abierto Docker Desktop?)" } finally { Pop-Location }
$lista = $false
for ($i = 0; $i -lt 60; $i++) {
    $estado = docker inspect -f "{{.State.Health.Status}}" $contenedor 2>$null
    if ($estado -eq "healthy") { $lista = $true; break }
    Start-Sleep -Seconds 2
}
if (-not $lista) { throw "La base de Docker no quedó lista. Revise: docker compose logs db" }
Write-Host "   lista"

$fecha = Get-Date -Format "yyyyMMdd_HHmm"
$archivo = Join-Path $raiz "database\servilift_db_xampp_$fecha.sql"
if ($Respaldo) {
    Paso "Usando el respaldo $Respaldo"
    if (-not (Test-Path $Respaldo)) { throw "No existe el archivo $Respaldo" }
    # Se trabaja sobre una copia para no tocar el archivo original
    Copy-Item $Respaldo $archivo
} else {
    Paso "Respaldando $Base de XAMPP"
    Ejecutar { & (Join-Path $MysqlBin "mysqldump.exe") -uroot --default-character-set=utf8mb4 --single-transaction --hex-blob `
            --routines --triggers --databases $Base "--result-file=$archivo" } "respaldar $Base (¿MySQL de XAMPP encendido?)"
}
# Latin-1 conserva cada byte tal cual: leerlo como UTF-8 dañaría los BLOB (contraseñas) de un respaldo sin --hex-blob
$latin1 = [Text.Encoding]::GetEncoding(28591)
$texto = [IO.File]::ReadAllText($archivo, $latin1)
if ($texto -notmatch "CREATE DATABASE[^;]*``$Base``") {
    throw "El respaldo no crea la base ${Base}: genérelo con mysqldump --databases $Base"
}
# Las vistas traen DEFINER=`root`@`localhost` de XAMPP: se quita para que en Docker las cree el usuario que importa
$texto = [regex]::Replace($texto, 'DEFINER=`[^`]+`@`[^`]+`\s*', '')
[IO.File]::WriteAllText($archivo, $texto, $latin1)
Write-Host "   $archivo"

Paso "Cargando el respaldo en Docker (reemplaza $Base del contenedor)"
EnDocker "DROP DATABASE IF EXISTS ``$Base``;" | Out-Null
Ejecutar { docker cp $archivo "${contenedor}:/tmp/migracion.sql" } "copiar el respaldo al contenedor"
Ejecutar { docker exec $contenedor sh -c "mariadb -uroot -p'$ClaveRoot' --default-character-set=utf8mb4 < /tmp/migracion.sql" } "importar el respaldo"
docker exec $contenedor rm -f /tmp/migracion.sql | Out-Null
EnDocker "GRANT ALL PRIVILEGES ON ``$Base``.* TO '$UsuarioApp'@'%'; FLUSH PRIVILEGES;" | Out-Null

$tablas = "usuario", "cliente", "edificio", "equipo", "cotizacion", "inspeccion", "inspeccion_resultado", "inspeccion_foto", "informe", "certificado", "notificacion"
$diferencias = 0
if ($Respaldo) {
    Paso "Filas cargadas en Docker (compárelas con las de XAMPP en el otro PC)"
    foreach ($t in $tablas) {
        Write-Host ("   {0,-22} Docker {1,6}" -f $t, (EnDocker "SELECT COUNT(*) FROM $t" $Base))
    }
} else {
    Paso "Comparando XAMPP y Docker"
    foreach ($t in $tablas) {
        $enXampp = & (Join-Path $MysqlBin "mysql.exe") -uroot -N -e "SELECT COUNT(*) FROM $t" $Base
        $enDocker = EnDocker "SELECT COUNT(*) FROM $t" $Base
        $marca = if ("$enXampp" -eq "$enDocker") { "ok" } else { $diferencias++; "DIFERENTE" }
        Write-Host ("   {0,-22} XAMPP {1,6}   Docker {2,6}   {3}" -f $t, $enXampp, $enDocker, $marca)
    }
}
$version = EnDocker "SELECT version_num FROM alembic_version" $Base
Write-Host "   revisión de Alembic en Docker: $version"
if ($diferencias) { throw "Hay $diferencias tablas con cantidades distintas: revise antes de usar la base de Docker." }

Paso "Listo"
Write-Host @"
   La base de Docker tiene los mismos datos que XAMPP. Para que el backend la use, en servilift-backend\.env:
     DB_HOST=127.0.0.1
     DB_PORT=3307
     DB_USER=$UsuarioApp
     DB_PASSWORD=servilift
   y reinicie el backend. Las fotos y PDF siguen en servilift-backend\storage (no están en la base).
"@
