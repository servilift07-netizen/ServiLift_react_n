# ServiLift v2 – App (React Native + Expo)

Una sola app para todos los roles: en el **celular** (inspectores, Android/iOS) y en el **navegador**
(oficina y portal del cliente). Reemplaza la app Flutter de la versión 1.

```bash
npm install
copy .env.example .env      # EXPO_PUBLIC_API_URL = URL del backend
npx expo start --web        # navegador
npx expo start              # celular con Expo Go (código QR)
npm run typecheck
```

## Organización

```
app/                     rutas (Expo Router)
├── login.tsx
└── (app)/               menú por rol, barra con sincronización y notificaciones
src/
├── api/cliente.ts       cliente HTTP, subida de fotos, PDF
├── sesion/              sesión (SecureStore en el celular, por pestaña en el navegador)
├── offline/             cola de cambios, motor de sincronización, caché y fotos locales
├── hooks/useCarga.ts    carga con actualización automática y caché para abrir sin señal
├── componentes/         diálogos, firma, selector, fechas, segmentos, gráficas, historial, plazo
└── pantallas/           inicio, seguimiento, clientes, cotizaciones, programación,
                         inspección (agenda, datos, checklist, fotos, firmas), informes, certificados, admin
```

## Trabajo sin señal

- `offline/cola.ts`: bandeja de salida persistente por usuario. Agrupa los cambios del checklist por ítem
  (viaja solo el último, con su hora), guarda fotos (reducidas a 1920 px) en la carpeta de la app y firmas
  como trazos. Envía en orden; un error de conexión espera y reintenta, un error del servidor queda marcado.
- `offline/SincronizacionContext.tsx`: envía al guardar, al recuperar la red, al volver a la app y cada 30 s.
- `pantallas/inspeccion/pendientes.ts`: superpone lo pendiente sobre lo que dice el servidor, así la
  pantalla siempre muestra lo último que hizo el inspector.
- La agenda deja cada inspección precargada en el teléfono para abrirla después sin conexión.
