// Avisa cuando el usuario vuelve a la app: en el celular al traerla al frente y en la web al volver a la
// pestaña o a la ventana (por ejemplo, después de aprobar algo como cliente en otra ventana).
import { AppState, Platform } from 'react-native';

export function alVolverALaApp(fn: () => void): () => void {
  const sub = AppState.addEventListener('change', (estado) => {
    if (estado === 'active') fn();
  });
  const enWeb = Platform.OS === 'web' && typeof window !== 'undefined';
  if (enWeb) window.addEventListener('focus', fn);
  return () => {
    sub.remove();
    if (enWeb) window.removeEventListener('focus', fn);
  };
}
