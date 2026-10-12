# ServiLift v2

Sistema para gestionar de principio a fin una empresa de **certificación de ascensores bajo la norma
NTC 5926** (hoy NTC 5926-1:2012; preparado para nuevas ediciones y para las partes 2 y 3): desde que el
asesor registra al cliente y lo cotiza hasta que el cliente descarga el certificado.

- **Inspectores**: app en el **celular**, pensada para trabajar en campo con poca o ninguna señal.
- **Asesores, programación, director técnico, certificados y administrador**: la misma app en el **navegador**.
- **Cliente**: portal para aprobar cotizaciones y descargar informes y certificados.

Guía paso a paso: [GUIA_EJECUCION.md](GUIA_EJECUCION.md).

## Arquitectura

```
┌──────────────────────────────┐   HTTP/JSON (JWT)   ┌─────────────────────────┐    SQL    ┌──────────────────┐
│ App React Native + Expo      │ ──────────────────▶ │ API FastAPI             │ ────────▶ │ MariaDB / MySQL  │
│ (servilift-app)              │ ◀────────────────── │ (servilift-backend)     │ ◀──────── │ servilift_db     │
│ · Android / iOS: inspectores │  fotos, firmas, PDF │ · reglas de negocio     │           └──────────────────┘
│ · Navegador: oficina/cliente │                     │ · PDF (reportlab) + QR  │
│ · Cola sin conexión          │                     │ · archivos firmados     │
└──────────────────────────────┘                     └─────────────────────────┘
```

| Capa | Tecnología |
|---|---|
| Base de datos | MariaDB 10.4 (XAMPP) / MySQL 8, migraciones con Alembic |
| Backend | Python 3.13, FastAPI, SQLAlchemy 2, Pydantic 2, JWT, bcrypt, ReportLab, Pillow |
| App | Expo SDK 57, React Native, TypeScript, Expo Router, React Native Paper |

## Reglas del negocio

- Cada equipo cotizado tiene su **norma** (por defecto la edición vigente de la NTC 5926-1).
- **Solo existen dos visitas** por servicio:
  1. **1ª visita** → informe `INF-AAAA-NNNN-1V`. Conforme: certificado. No conforme: plazo de corrección
     (el menor entre los hallazgos: leve 180 días, grave 30, muy grave inmediato; configurable por norma).
  2. **2ª visita** (cierre de hallazgos) → informe `INF-AAAA-NNNN-2V`. Si todos los hallazgos se corrigieron:
     certificado. Si alguno no: el equipo queda **cerrado no conforme** y requiere **una cotización nueva**
     (nueva 1ª visita), que queda enlazada al servicio anterior.
- Cada visita tiene su propio informe, revisión, firma del director y PDF; el cliente ve ambos.
- Todo cambio de estado queda en el historial del equipo.

## Trabajo sin señal (inspector)

1. Al abrir la agenda con señal, cada inspección queda guardada en el teléfono (detalle, checklist, fotos y catálogos).
2. Cada cambio (resultado, observación, medida, variantes, datos, foto, firma) se guarda **primero en el teléfono**
   en una cola persistente: sobrevive a cerrar la app o apagar el celular.
3. La cola se envía sola al haber señal, en orden, con reintentos de espera creciente.
4. Sin pérdida ni duplicados: fotos y firmas llevan uuid (el servidor no duplica un reenvío) y cada resultado lleva
   la hora del cambio: el servidor ignora un reenvío más viejo que lo guardado (**el cambio más reciente gana**).
5. Un error del servidor nunca borra un cambio: queda en *Sincronización* para reintentar o descartar.
6. Abrir la inspección por primera vez y finalizar requieren señal (finalizar exige que todo esté sincronizado).

## Seguridad

- Proyecto de demostración: el servidor arranca sin configurar clave secreta y todos los usuarios usan `123456`.
- Fotos y firmas solo con enlaces firmados que vencen (no hay carpeta pública); PDF con enlaces temporales.
- Permisos por rol en cada endpoint; el cliente solo ve lo suyo, informes aprobados y certificados enviados.

## Estructura

```
servi lift react/
├── database/            Esquema v2, catálogos y datos de prueba (ver database/README.md)
├── servilift-backend/   API FastAPI, PDF, pruebas y migraciones Alembic
└── servilift-app/       App Expo (celular y navegador)
```
