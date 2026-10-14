// Abre la pantalla a la que apunta una notificación (campo "enlace" del backend) y la marca como leída.
import { router } from 'expo-router';

import { Api } from '@/api/cliente';
import { useDialogos } from '@/componentes/Dialogos';
import { destinoNotificacion } from '@/logica/notificaciones';

type Dialogos = ReturnType<typeof useDialogos>;

export async function abrirNotificacion(n: { id_notificacion: number; enlace?: string | null; leida?: boolean },
  rol: string, d: Dialogos) {
  if (!n.leida) {
    try {
      await Api.put(`/notificaciones/${n.id_notificacion}/leida`);
    } catch {
      // se marcará la próxima vez
    }
  }
  const destino = destinoNotificacion(n.enlace, rol);
  if (destino?.tipo === 'ruta') router.push(destino.ruta as any);
  else if (destino?.tipo === 'pdf') await d.ejecutar(() => Api.abrirPdf(destino.url));
}
