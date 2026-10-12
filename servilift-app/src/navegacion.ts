import { Href, router } from 'expo-router';

/** Vuelve a la pantalla anterior; si se abrió directo (enlace o recarga), va a la ruta de respaldo. */
export function volver(respaldo: Href = '/') {
  if (router.canGoBack()) router.back();
  else router.replace(respaldo);
}
