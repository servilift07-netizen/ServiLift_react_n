"""Prueba de punta a punta del flujo ServiLift v2 contra una base recién creada
(01_schema.sql + 02_seed.sql). Crea sus propios usuarios y datos.

    python -m tests.test_flujo
    pytest -m integracion --no-cov        (misma prueba desde pytest; necesita la base encendida)

Recorre:
  A. Equipo 1: 1ª visita no conforme -> 2ª visita con todo corregido -> certificado.
  B. Equipo 2: 1ª visita no conforme -> 2ª visita con un hallazgo sin corregir -> CERRADO_NO_CONFORME
     -> cotización nueva enlazada al servicio anterior.
  Además: búsqueda por nombre, equipos por edificio, fechas con zona horaria, enlaces firmados de fotos,
  guardado idempotente y "el cambio más reciente gana" para la sincronización sin señal.
"""
import base64
import io
import os
import uuid
from datetime import date, datetime, timedelta, timezone

import pytest
from fastapi.testclient import TestClient
from PIL import Image

from app.database import SessionLocal
from app.main import app
from app.models import Rol, Usuario
from app.security import hash_password

c = TestClient(app)
SUF = uuid.uuid4().hex[:6]
CLAVE = "123456"  # misma contraseña de todos los usuarios de prueba
FIRMANTES = (("INSPECTOR", "Inspector Prueba"), ("TECNICO_MANTENIMIENTO", "Técnico XYZ"),
             ("REPRESENTANTE_EDIFICIO", "Administradora"))
VARIANTES = {"ACCIONAMIENTO": "ELECTRICO", "ENHEBRADO": "1_1", "MAQUINA": "GEARLESS", "TRACCION_POR": "CABLE",
             "CUARTO_MAQUINAS": "CON_CUARTO", "TIPO_BUFFER": "RESORTE_CAUCHO", "LIMITADOR_CABINA": "SI",
             "LIMITADOR_CONTRAPESO": "NO", "CUARTO_POLEAS": "NO", "PUERTA_SOCORRO": "NO", "TIPO_PUERTA": "BATIENTE",
             "MIRILLA_PUERTAS": "NO"}


def ok(r, codigo=200):
    assert r.status_code == codigo, f"{r.request.method} {r.request.url} -> {r.status_code}: {r.text[:800]}"
    return r.json() if r.content and r.headers.get("content-type", "").startswith("application/json") else r


def crear_interno(rol: str) -> str:
    db = SessionLocal()
    correo = f"{rol.lower()}_{SUF}@servilift-prueba.co"
    db.add(Usuario(id_rol=db.query(Rol).filter(Rol.codigo == rol).one().id_rol, nombre_completo=f"{rol.title()} Prueba",
                   correo=correo, contrasena_encriptada=hash_password(CLAVE)))
    db.commit()
    db.close()
    return correo


def login(correo):
    t = ok(c.post("/auth/login", json={"correo": correo, "contrasena": CLAVE}))
    return {"Authorization": f"Bearer {t['access_token']}"}


def en_inicio(headers, enlace):
    """¿La notificación más reciente con ese enlace sigue pendiente (aparece en el inicio)?"""
    return next(n["vigente"] for n in ok(c.get("/notificaciones", headers=headers)) if n["enlace"] == enlace)


def png():
    img = Image.new("RGB", (300, 120), "white")
    for x in range(20, 280):
        img.putpixel((x, 60 + (x % 20) - 10), (0, 0, 0))
    b = io.BytesIO()
    img.save(b, "PNG")
    return base64.b64encode(b.getvalue()).decode()


def jpg():
    b = io.BytesIO()
    Image.new("RGB", (1600, 1200), (120, 140, 160)).save(b, "JPEG")
    return b.getvalue()


def subir_foto(H, iid, nombre, id_item=None, descripcion=None, uuid_offline=None):
    data = {"descripcion": descripcion or nombre}
    if id_item:
        data["id_item"] = str(id_item)
    if uuid_offline:
        data["uuid_offline"] = uuid_offline
    return ok(c.post(f"/inspecciones/{iid}/fotos", headers=H, files=[("archivos", (nombre, jpg(), "image/jpeg"))],
                     data=data), 201)


def dibujo():
    """Firma como trazos, tal como la envía la app (sin generar la imagen en el celular)."""
    return {"ancho": 300, "alto": 150, "trazos": [[[20, 100], [60, 40], [100, 110], [140, 50]], [[200, 80]]]}


def firmar(H, iid, visita):
    for tipo, nombre in FIRMANTES:
        firma = {"dibujo": dibujo()} if tipo == "REPRESENTANTE_EDIFICIO" else {"firma_base64": png()}
        ok(c.post(f"/inspecciones/{iid}/firmas", headers=H,
                  json={"tipo_firmante": tipo, "nombre": nombre, "numero_visita": visita,
                        "uuid_offline": str(uuid.uuid4()), **firma}), 201)


def primera_visita(H, id_prog, id_ce, nc_numeros):
    """Abre el informe, elige variantes, califica todo (nc_numeros = No cumple), fotos y firmas; finaliza."""
    insp = ok(c.post("/inspecciones/iniciar", headers=H["INSPECTOR"], json={
        "id_programacion": id_prog, "id_cotizacion_equipo": id_ce, "uuid_offline": str(uuid.uuid4())}), 201)
    iid = insp["id_inspeccion"]
    assert insp["norma"] == "NTC 5926-1:2012" and insp["numero_visita"] == 1, insp
    cat = ok(c.get("/catalogos/variantes", headers=H["INSPECTOR"], params={"parte": 1}))
    sel = [{"id_variante_tipo": t["id_variante_tipo"],
            "id_variante_opcion": next(o["id_variante_opcion"] for o in t["opciones"] if o["codigo"] == VARIANTES[t["codigo"]])}
           for t in cat]
    d = ok(c.put(f"/inspecciones/{iid}/variantes", headers=H["INSPECTOR"], json=sel))
    assert d["resumen"]["no_aplica"] == 35, d["resumen"]  # según las fórmulas de la plantilla
    # Ítem 12: con foso de menos de 1500 mm no aplica; al corregir la medida vuelve a aplicar
    d = ok(c.put(f"/inspecciones/{iid}/equipo", headers=H["INSPECTOR"], json={"profundidad_foso_mm": 1200}))
    assert d["resumen"]["no_aplica"] == 36, d["resumen"]
    d = ok(c.put(f"/inspecciones/{iid}/equipo", headers=H["INSPECTOR"], json={"profundidad_foso_mm": 1600}))
    assert d["resumen"]["no_aplica"] == 35, d["resumen"]
    chk = ok(c.get(f"/inspecciones/{iid}/checklist", headers=H["INSPECTOR"]))
    items = [it for cg in chk["categorias"] for it in cg["items"]]
    assert len(items) == 169 and chk["norma"] == "NTC 5926-1:2012"
    marca = datetime.now(timezone.utc).isoformat()
    lote = []
    for it in items:
        if it["resultado"]:  # precargado NA
            continue
        res = "NO_CUMPLE" if it["numero"] in nc_numeros else "CUMPLE"
        lote.append({"id_item": it["id_item"], "resultado": res, "modificado_en": marca,
                     "observacion": "Hallazgo de prueba" if res == "NO_CUMPLE" else None,
                     "valor_medido": "12" if it["requiere_medicion"] else None,
                     "unidad_medida": "mm" if it["requiere_medicion"] else None})
    ok(c.put(f"/inspecciones/{iid}/resultados", headers=H["INSPECTOR"], json=lote))
    ok(c.put(f"/inspecciones/{iid}/resultados", headers=H["INSPECTOR"], json=lote))  # reenvío: idempotente
    subir_foto(H["INSPECTOR"], iid, "general.jpg", descripcion="Cuarto de máquinas")
    for n in nc_numeros:
        subir_foto(H["INSPECTOR"], iid, f"nc{n}.jpg", id_item=next(i["id_item"] for i in items if i["numero"] == n))
    firmar(H["INSPECTOR"], iid, 1)
    fin = ok(c.post(f"/inspecciones/{iid}/finalizar", headers=H["INSPECTOR"]))
    assert fin["estado"] == "FINALIZADA" and fin["informe"]["estado"] == "PENDIENTE_REVISION", fin
    assert fin["informe"]["numero_informe"].endswith("-1V") and fin["informe"]["numero_visita"] == 1
    return iid, items, fin["informe"]


def segunda_visita(H, id_cot, id_inspector, id_ce, iid, estados_por_item):
    prog2 = ok(c.post("/programacion", headers=H["PROGRAMACION"], json={
        "id_cotizacion": id_cot, "id_inspector": id_inspector, "tipo_visita": "SEGUNDA",
        "fecha_programada": str(date.today() + timedelta(days=30)), "hora_inicio": "09:00",
        "ids_cotizacion_equipo": [id_ce]}), 201)
    v2 = ok(c.post("/inspecciones/iniciar", headers=H["INSPECTOR"], json={
        "id_programacion": prog2["id_programacion"], "id_cotizacion_equipo": id_ce}), 201)
    assert v2["id_inspeccion"] == iid and v2["estado"] == "EN_SEGUNDA_VISITA" and v2["numero_visita"] == 2, v2
    assert c.post(f"/inspecciones/{iid}/finalizar", headers=H["INSPECTOR"]).status_code == 422
    ok(c.put(f"/inspecciones/{iid}/segunda-visita", headers=H["INSPECTOR"],
             json=[{"id_item": x, "estado_segunda_visita": e, "observacion_segunda_visita": "Revisado en sitio",
                    "modificado_en": datetime.now(timezone.utc).isoformat()} for x, e in estados_por_item.items()]))
    foto = subir_foto(H["INSPECTOR"], iid, "cierre.jpg", id_item=next(iter(estados_por_item)), descripcion="Cierre")
    assert foto[0]["numero_visita"] == 2
    firmar(H["INSPECTOR"], iid, 2)
    fin2 = ok(c.post(f"/inspecciones/{iid}/finalizar", headers=H["INSPECTOR"]))
    inf2 = fin2["informe"]
    assert inf2["estado"] == "PENDIENTE_REVISION" and inf2["numero_visita"] == 2 and inf2["numero_informe"].endswith("-2V")
    assert len(fin2["informes"]) == 2
    return inf2


def main():
    H = {r: login(crear_interno(r)) for r in ("ADMIN", "ASESOR", "PROGRAMACION", "INSPECTOR", "DIRECTOR_TECNICO", "CERTIFICADOS")}
    yo_inspector = ok(c.get("/auth/me", headers=H["INSPECTOR"]))

    # Normas
    normas = ok(c.get("/catalogos/normas", headers=H["ASESOR"]))
    vigente = next(n for n in normas if n["vigente"] and n["parte"] == 1)
    assert vigente["etiqueta"] == "NTC 5926-1:2012" and vigente["total_items"] == 169, vigente

    # 1. Asesor: cliente -> edificio con 3 ascensores -> equipos
    cli = ok(c.post("/clientes", headers=H["ASESOR"], json={"numero_documento": f"900{SUF}", "razon_social": f"Conjunto Prueba {SUF}"}), 201)
    edi = ok(c.post(f"/clientes/{cli['id_cliente']}/edificios", headers=H["ASESOR"],
                    json={"nombre": f"Torre A {SUF}", "direccion": "Cra 1 # 2-3", "ciudad": "Bogotá", "numero_equipos": 3,
                          "empresa_mantenimiento": "Mantenimientos XYZ"}), 201)
    equipos = ok(c.post(f"/edificios/{edi['id_edificio']}/equipos/generar", headers=H["ASESOR"]), 201)
    assert len(equipos) == 3
    ok(c.put(f"/equipos/{equipos[0]['id_equipo']}", headers=H["ASESOR"],
             json={"capacidad_kg": 630, "capacidad_personas": 8, "numero_paradas": 10, "numero_serie": "SN-1"}))
    # Búsqueda por nombre y equipos por edificio
    assert any(x["id_cliente"] == cli["id_cliente"] for x in ok(c.get("/clientes", headers=H["ASESOR"], params={"buscar": f"Prueba {SUF}"})))
    assert [x["id_edificio"] for x in ok(c.get("/edificios", headers=H["ASESOR"], params={"buscar": f"Torre A {SUF}"}))] == [edi["id_edificio"]]
    assert len(ok(c.get("/equipos", headers=H["ASESOR"], params={"id_edificio": edi["id_edificio"]}))) == 3
    assert ok(c.get("/equipos", headers=H["ASESOR"], params={"buscar": "SN-1"}))[0]["id_equipo"] == equipos[0]["id_equipo"]
    assert c.get("/equipos", headers=H["ASESOR"]).status_code == 400
    # Solo el administrador crea usuarios
    assert c.post(f"/clientes/{cli['id_cliente']}/usuarios", headers=H["ASESOR"],
                  json={"nombre_completo": "x", "correo": f"x_{SUF}@servilift-prueba.co", "contrasena": CLAVE}).status_code == 403
    ok(c.post(f"/clientes/{cli['id_cliente']}/usuarios", headers=H["ADMIN"],
              json={"nombre_completo": "Administradora", "correo": f"cliente_{SUF}@servilift-prueba.co", "contrasena": CLAVE}), 201)
    H["CLIENTE"] = login(f"cliente_{SUF}@servilift-prueba.co")

    # 2. Cotización de 2 de los 3 equipos (norma vigente por defecto)
    cot = ok(c.post("/cotizaciones", headers=H["ASESOR"], json={"id_edificio": edi["id_edificio"], "equipos": [
        {"id_equipo": equipos[0]["id_equipo"], "valor": 450000}, {"id_equipo": equipos[2]["id_equipo"], "valor": 450000}]}), 201)
    num = cot["numero_cotizacion"]
    assert num.startswith("COT-") and float(cot["total"]) == 1071000.0, cot
    assert {e["norma"] for e in cot["equipos"]} == {"NTC 5926-1:2012"}
    assert cot["fecha_creacion"].endswith("-05:00"), cot["fecha_creacion"]   # fechas con zona de Colombia
    assert ok(c.get("/cotizaciones", headers=H["CLIENTE"])) == []  # borrador invisible al cliente
    ok(c.post(f"/cotizaciones/{cot['id_cotizacion']}/enviar-cliente", headers=H["ASESOR"]))
    seg = ok(c.get("/seguimiento", headers=H["CLIENTE"], params={"numero_cotizacion": num}))
    assert {s["estado_equipo"] for s in seg} == {"PENDIENTE_APROBACION"}
    ok(c.post(f"/cotizaciones/{cot['id_cotizacion']}/responder", headers=H["CLIENTE"], json={"aprobada": True}))
    assert c.post(f"/cotizaciones/{cot['id_cotizacion']}/responder", headers=H["ASESOR"], json={"aprobada": True}).status_code == 403
    ok(c.post(f"/cotizaciones/{cot['id_cotizacion']}/enviar-programacion", headers=H["ASESOR"]))
    # El tablero del asesor cuenta por id del asesor (no por nombre)
    resumen_ase = {r["estado"]: r["cantidad"] for r in ok(c.get("/dashboard/resumen", headers=H["ASESOR"]))}
    assert resumen_ase["POR_PROGRAMAR"] == 2, resumen_ase

    # 3. Programación
    mia = next(p for p in ok(c.get("/programacion/pendientes", headers=H["PROGRAMACION"])) if p["numero_cotizacion"] == num)
    ids_ce = [e["id_cotizacion_equipo"] for e in mia["equipos_por_programar"]]
    prog = ok(c.post("/programacion", headers=H["PROGRAMACION"], json={
        "id_cotizacion": cot["id_cotizacion"], "id_inspector": yo_inspector["id_usuario"],
        "fecha_programada": str(date.today() + timedelta(days=1)), "hora_inicio": "08:00", "ids_cotizacion_equipo": ids_ce}), 201)
    assert any(num in n["titulo"] for n in ok(c.get("/notificaciones", headers=H["INSPECTOR"])))
    assert any(a["id_programacion"] == prog["id_programacion"] for a in ok(c.get("/inspecciones/agenda", headers=H["INSPECTOR"])))

    # 4. Inspector, equipo 1 (con validaciones de pendientes, fotos firmadas e idempotencia)
    insp = ok(c.post("/inspecciones/iniciar", headers=H["INSPECTOR"], json={
        "id_programacion": prog["id_programacion"], "id_cotizacion_equipo": ids_ce[0], "uuid_offline": str(uuid.uuid4())}), 201)
    assert insp["datos_equipo"]["edificio"]["nombre"] == f"Torre A {SUF}" and insp["capacidad_kg"] == 630
    iid_prev = insp["id_inspeccion"]
    eqd = ok(c.put(f"/inspecciones/{iid_prev}/equipo", headers=H["INSPECTOR"],
                   json={"marca": "Marca X", "numero_serie": "SER-99", "capacidad_kg": 800, "velocidad_ms": 1.5}))
    assert eqd["datos_equipo"]["equipo"]["numero_serie"] == "SER-99" and eqd["capacidad_kg"] == 800, eqd
    assert c.put(f"/inspecciones/{iid_prev}/equipo", headers=H["ASESOR"], json={"marca": "Y"}).status_code == 403
    assert not ok(c.get(f"/inspecciones/{iid_prev}/validar", headers=H["INSPECTOR"]))["puede_finalizar"]
    assert c.post(f"/inspecciones/{iid_prev}/finalizar", headers=H["INSPECTOR"]).status_code == 422
    # Foto con uuid: el reenvío no la duplica; la URL va firmada y una URL alterada no sirve
    u = str(uuid.uuid4())
    f1 = subir_foto(H["INSPECTOR"], iid_prev, "dup.jpg", uuid_offline=u)
    f2 = subir_foto(H["INSPECTOR"], iid_prev, "dup.jpg", uuid_offline=u)
    assert f1[0]["id_foto"] == f2[0]["id_foto"]
    assert c.get(f1[0]["url_miniatura"]).status_code == 200
    assert c.get(f1[0]["url_miniatura"].replace("f=", "f=0")).status_code == 404
    assert c.get(f1[0]["url"].split("?")[0] + "?v=1&f=x").status_code == 404
    # "El cambio más reciente gana": un reenvío con hora anterior no pisa lo guardado
    item1 = ok(c.get(f"/inspecciones/{iid_prev}/checklist", headers=H["INSPECTOR"]))["categorias"][0]["items"][0]["id_item"]
    nuevo = datetime.now(timezone.utc)
    ok(c.put(f"/inspecciones/{iid_prev}/resultados", headers=H["INSPECTOR"],
             json=[{"id_item": item1, "resultado": "CUMPLE", "modificado_en": nuevo.isoformat()}]))
    viejo = ok(c.put(f"/inspecciones/{iid_prev}/resultados", headers=H["INSPECTOR"],
                     json=[{"id_item": item1, "resultado": "NO_CUMPLE", "modificado_en": (nuevo - timedelta(minutes=5)).isoformat()}]))
    assert viejo["omitidos_por_antiguos"] == 1, viejo

    iid, items, inf1 = primera_visita(H, prog["id_programacion"], ids_ce[0], (28, 38, 71))
    assert iid == iid_prev  # el mismo servicio no abre una segunda "primera visita"

    # 5. Director técnico: devuelve, el inspector corrige, aprueba (informe de 1ª visita NO CONFORME)
    assert en_inicio(H["DIRECTOR_TECNICO"], f"/informes/{inf1['id_informe']}") is True  # por revisar
    ok(c.post(f"/informes/{inf1['id_informe']}/devolver", headers=H["DIRECTOR_TECNICO"], json={"observaciones": "Falta foto del foso"}))
    assert ok(c.get(f"/inspecciones/{iid}", headers=H["INSPECTOR"]))["estado"] == "DEVUELTA"
    assert en_inicio(H["INSPECTOR"], f"/inspecciones/{iid}") is True  # el devuelto aparece en su inicio
    subir_foto(H["INSPECTOR"], iid, "foso.jpg")
    ok(c.post(f"/inspecciones/{iid}/finalizar", headers=H["INSPECTOR"]))
    assert en_inicio(H["INSPECTOR"], f"/inspecciones/{iid}") is False  # ya pasó al director: sale del inicio
    assert c.get(f"/informes/{inf1['id_informe']}", headers=H["CLIENTE"]).status_code == 404  # aún no visible
    vp = ok(c.get(f"/informes/{inf1['id_informe']}/vista-previa", headers=H["DIRECTOR_TECNICO"]))
    assert c.get(vp["url"]).content[:4] == b"%PDF"
    assert ok(c.get(f"/informes/{inf1['id_informe']}", headers=H["DIRECTOR_TECNICO"]))["estado"] == "PENDIENTE_REVISION"
    assert c.get(f"/informes/{inf1['id_informe']}/vista-previa", headers=H["CLIENTE"]).status_code == 403
    assert c.post(f"/informes/{inf1['id_informe']}/aprobar", headers=H["DIRECTOR_TECNICO"],
                  json={"firma_base64": png(), "concepto": "CONFORME"}).status_code == 409  # tiene no conformidades
    apr1 = ok(c.post(f"/informes/{inf1['id_informe']}/aprobar", headers=H["DIRECTOR_TECNICO"], json={"firma_base64": png()}))
    assert apr1["estado"] == "APROBADO" and apr1["concepto"] == "NO_CONFORME" and apr1["numero_visita"] == 1, apr1
    assert en_inicio(H["DIRECTOR_TECNICO"], f"/informes/{inf1['id_informe']}") is False  # ya revisado
    assert (apr1["total_leves"], apr1["total_graves"], apr1["total_muy_graves"], apr1["total_no_aplica"]) == (1, 1, 1, 35), apr1
    assert ok(c.get(f"/informes/{inf1['id_informe']}/pdf", headers=H["CLIENTE"])).content[:4] == b"%PDF"

    # 5b. No conforme: el certificado queda bloqueado hasta la segunda visita
    seg = ok(c.get("/seguimiento", headers=H["CLIENTE"], params={"numero_cotizacion": num}))
    fila_nc = next(s for s in seg if s["estado_equipo"] == "NO_CONFORME")
    assert fila_nc["plazo_dias"] == 0 and fila_nc["dias_restantes"] == 0, fila_nc   # MG = corrección inmediata
    assert fila_nc["hora_inicio"] == "08:00:00" and fila_nc["informe_visita1"] and not fila_nc["informe_visita2"], fila_nc
    assert c.post("/certificados", headers=H["CERTIFICADOS"], json={"id_informe": inf1["id_informe"]}).status_code == 409
    assert c.post(f"/seguimiento/equipo/{ids_ce[0]}/solicitar-segunda-visita", headers=H["PROGRAMACION"], json={}).status_code == 403
    ok(c.post(f"/seguimiento/equipo/{ids_ce[0]}/solicitar-segunda-visita", headers=H["CLIENTE"],
              json={"comentario": "Ya se corrigieron los hallazgos"}))

    # 6. Segunda visita con todo corregido -> informe 2V CONFORME -> certificado
    hallazgos = {i["id_item"]: "CORREGIDO" for i in items if i["numero"] in (28, 38, 71)}
    inf2 = segunda_visita(H, cot["id_cotizacion"], yo_inspector["id_usuario"], ids_ce[0], iid, hallazgos)
    assert c.post(f"/informes/{inf2['id_informe']}/aprobar", headers=H["DIRECTOR_TECNICO"],
                  json={"firma_base64": png(), "concepto": "NO_CONFORME"}).status_code == 409   # en 2V lo define el cierre
    apr2 = ok(c.post(f"/informes/{inf2['id_informe']}/aprobar", headers=H["DIRECTOR_TECNICO"], json={"dibujo": dibujo()}))
    assert apr2["concepto"] == "CONFORME" and apr2["total_corregidos"] == 3 and apr2["otro_informe"]["concepto"] == "NO_CONFORME", apr2
    assert ok(c.get(f"/informes/{inf1['id_informe']}", headers=H["CLIENTE"]))["concepto"] == "NO_CONFORME"  # el 1V no cambia
    cert = ok(c.post("/certificados", headers=H["CERTIFICADOS"], json={"id_informe": inf2["id_informe"]}), 201)
    assert cert["numero_visita"] == 2 and cert["norma"] == "NTC 5926-1:2012"
    assert c.get(f"/certificados/{cert['id_certificado']}/pdf", headers=H["CLIENTE"]).status_code == 404  # aún no enviado
    ok(c.post(f"/certificados/{cert['id_certificado']}/enviar", headers=H["CERTIFICADOS"]))
    pdf_cer = ok(c.get(f"/certificados/{cert['id_certificado']}/pdf", headers=H["CLIENTE"]))
    assert pdf_cer.content[:4] == b"%PDF"
    assert ok(c.get(f"/verificar/{cert['codigo_verificacion']}"))["estado"] == "VIGENTE"

    # 7. Equipo 2: 2ª visita con un hallazgo sin corregir -> CERRADO_NO_CONFORME -> cotización nueva
    _, items_b, inf1b = primera_visita(H, prog["id_programacion"], ids_ce[1], (28, 38))
    aprb = ok(c.post(f"/informes/{inf1b['id_informe']}/aprobar", headers=H["DIRECTOR_TECNICO"], json={"firma_base64": png()}))
    assert aprb["concepto"] == "NO_CONFORME"
    ok(c.post(f"/seguimiento/equipo/{ids_ce[1]}/solicitar-segunda-visita", headers=H["ASESOR"], json={}))
    iid_b = aprb["id_inspeccion"]
    estados_b = {i["id_item"]: ("CORREGIDO" if i["numero"] == 28 else "NO_CORREGIDO") for i in items_b if i["numero"] in (28, 38)}
    inf2b = segunda_visita(H, cot["id_cotizacion"], yo_inspector["id_usuario"], ids_ce[1], iid_b, estados_b)
    apr2b = ok(c.post(f"/informes/{inf2b['id_informe']}/aprobar", headers=H["DIRECTOR_TECNICO"], json={"firma_base64": png()}))
    assert apr2b["concepto"] == "NO_CONFORME" and apr2b["total_no_corregidos"] == 1, apr2b
    assert c.post("/certificados", headers=H["CERTIFICADOS"], json={"id_informe": inf2b["id_informe"]}).status_code == 409
    seg = {s["id_cotizacion_equipo"]: s for s in ok(c.get("/seguimiento", headers=H["CLIENTE"], params={"numero_cotizacion": num}))}
    assert seg[ids_ce[0]]["estado_equipo"] == "CERTIFICADO_LISTO" and seg[ids_ce[0]]["id_certificado"]
    assert seg[ids_ce[1]]["estado_equipo"] == "CERRADO_NO_CONFORME", seg[ids_ce[1]]
    assert seg[ids_ce[1]]["informe_visita1"] and seg[ids_ce[1]]["informe_visita2"]
    assert ok(c.get(f"/cotizaciones/{cot['id_cotizacion']}", headers=H["ASESOR"]))["estado"] == "FINALIZADA"
    # No existe tercera visita: no se puede programar ni solicitar otra
    assert c.post(f"/seguimiento/equipo/{ids_ce[1]}/solicitar-segunda-visita", headers=H["CLIENTE"], json={}).status_code == 409
    id_equipo_b = seg[ids_ce[1]]["id_equipo"]
    cot2 = ok(c.post("/cotizaciones", headers=H["ASESOR"], json={"id_edificio": edi["id_edificio"], "equipos": [
        {"id_equipo": id_equipo_b, "valor": 450000, "tipo_servicio": "REINSPECCION"}]}), 201)
    assert cot2["equipos"][0]["id_servicio_anterior"] == ids_ce[1], cot2["equipos"][0]

    # 8. Historial, búsqueda en seguimiento y páginas de inicio
    for rol in ("ASESOR", "PROGRAMACION", "INSPECTOR", "DIRECTOR_TECNICO", "CERTIFICADOS"):
        hr = ok(c.get(f"/seguimiento/equipo/{ids_ce[0]}/historial", headers=H[rol]))
        assert any("Certificado" in (e["estado_etiqueta"] or "") for e in hr["historial"]), (rol, hr)
    assert len(ok(c.get("/seguimiento", headers=H["ASESOR"], params={"buscar": f"Torre A {SUF}"}))) == 3
    hist = ok(c.get(f"/seguimiento/equipo/{ids_ce[1]}/historial", headers=H["CLIENTE"]))
    print("Historial equipo 2:", " -> ".join(h["estado_etiqueta"] for h in hist["historial"]))
    for rol, hh in H.items():
        dsh = ok(c.get("/dashboard", headers=hh))
        assert dsh["kpis"] and dsh["graficas"] is not None, (rol, dsh)

    # PDF de 1ª y 2ª visita por separado (el cliente ve ambos)
    u1 = ok(c.get(f"/informes/{inf1['id_informe']}/enlace-pdf", headers=H["CLIENTE"]))["url"]
    u2 = ok(c.get(f"/informes/{inf2['id_informe']}/enlace-pdf", headers=H["CLIENTE"]))["url"]
    u2b = ok(c.get(f"/informes/{inf2b['id_informe']}/enlace-pdf", headers=H["CLIENTE"]))["url"]
    pdfs = {n: c.get(u).content for n, u in (("informe_1V", u1), ("informe_2V", u2), ("informe_2V_no_conforme", u2b))}
    assert all(p[:4] == b"%PDF" for p in pdfs.values())
    os.makedirs("tests/salida", exist_ok=True)
    for n, p in pdfs.items():
        open(f"tests/salida/{n}.pdf", "wb").write(p)
    open("tests/salida/certificado.pdf", "wb").write(pdf_cer.content)
    print(f"OK flujo completo {num}: informes {inf1['numero_informe']} y {inf2['numero_informe']}, "
          f"certificado {cert['numero_certificado']}; {inf2b['numero_informe']} cerrado no conforme -> "
          f"cotización nueva {cot2['numero_cotizacion']}")


@pytest.mark.integracion
def test_flujo_completo_de_cotizacion_a_certificado():
    main()


if __name__ == "__main__":
    main()
