// URL del backend (archivo .env -> EXPO_PUBLIC_API_URL).
//   Navegador en el mismo PC  -> http://localhost:8000
//   Emulador Android          -> http://10.0.2.2:8000
//   Celular en la misma Wi-Fi -> http://IP_DEL_PC:8000
export const API_URL = (process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:8000').replace(/\/+$/, '');

// Cada cuánto se refrescan solas las listas mientras la pantalla está abierta
export const REFRESCO_MS = 20000;
