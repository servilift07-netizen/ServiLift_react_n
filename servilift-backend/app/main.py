# app/main.py
# Ejecutar:  uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
# (host 0.0.0.0 para que el celular del inspector lo alcance en la red local)

import os

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse

from app.config import settings
from app.routes import (
    auth, catalogos, certificados, clientes, cotizaciones, dashboard, informes, inspecciones, programacion, seguimiento,
    usuarios,
)
from app.security import validar_url_archivo

app = FastAPI(title="ServiLift API", version="2.0.0",
              description="Gestión de certificación de ascensores NTC 5926: de la cotización al certificado.")

app.add_middleware(
    CORSMiddleware,
    # Desarrollo: app web de Expo (localhost:8081) y cualquier puerto local. Producción: CORS_ORIGINS en .env
    allow_origin_regex=r"http://(localhost|127\.0\.0\.1)(:\d+)?",
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

for r in (auth, usuarios, clientes, cotizaciones, programacion, inspecciones, informes, certificados,
          seguimiento, catalogos, dashboard):
    app.include_router(r.router)

# Solo se sirven fotos y firmas (nunca PDF ni otros archivos) y siempre con enlace firmado vigente
CARPETAS_SERVIDAS = ("inspecciones/", "informes/firmas/", "firmas/usuarios/")


@app.get("/archivos/{ruta:path}", include_in_schema=False)
def archivo(ruta: str, v: int, f: str):
    validar_url_archivo(ruta, v, f)
    base = os.path.realpath(settings.STORAGE_DIR)
    destino = os.path.realpath(os.path.join(base, ruta))
    if not ruta.startswith(CARPETAS_SERVIDAS) or not destino.startswith(base + os.sep) or not os.path.isfile(destino):
        raise HTTPException(404, "Archivo no encontrado")
    return FileResponse(destino, headers={"Cache-Control": "private, max-age=3600"})


@app.get("/")
def root():
    return {"message": "ServiLift API funcionando", "version": app.version}
