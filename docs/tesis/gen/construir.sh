#!/bin/bash
# Regenera diagramas, datos y el documento Word con su índice. Uso: bash construir.sh
set -e
cd "$(dirname "$0")"
export NODE_PATH=$(npm root -g)
python3 generar.py
node render.cjs ../img
python3 datos_doc.py
TMP=$(mktemp -d)
SIN_PAGINAS=1 node documento.cjs "$TMP/borrador.docx"
soffice --headless --convert-to pdf --outdir "$TMP" "$TMP/borrador.docx" >/dev/null 2>&1
python3 indice.py "$TMP/borrador.pdf"
node documento.cjs
rm -rf "$TMP"
