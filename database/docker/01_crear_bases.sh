#!/bin/bash
# Lo ejecuta la imagen de MariaDB la primera vez que arranca (volumen vacío).
# Crea las dos bases con los mismos scripts que se usan en XAMPP:
#   servilift_db         la del día a día
#   servilift_v2_prueba  la de las pruebas de integración y E2E
# y le da permisos sobre ambas al usuario de la app (MARIADB_USER).
set -euo pipefail

scripts=(01_schema.sql 02_seed.sql 03_datos_iniciales.sql)

for base in servilift_db servilift_v2_prueba; do
  echo "ServiLift: creando ${base}"
  for sql in "${scripts[@]}"; do
    sed "s/servilift_db/${base}/g" "/servilift/database/${sql}" \
      | mariadb -uroot -p"${MARIADB_ROOT_PASSWORD}" --default-character-set=utf8mb4
  done
  mariadb -uroot -p"${MARIADB_ROOT_PASSWORD}" \
    -e "GRANT ALL PRIVILEGES ON \`${base}\`.* TO '${MARIADB_USER}'@'%';"
done
mariadb -uroot -p"${MARIADB_ROOT_PASSWORD}" -e "FLUSH PRIVILEGES;"
echo "ServiLift: bases listas"
