// Abre la pantalla a la que apunta una notificación (campo "enlace" del backend) y la marca como leída.
import { router } from 'expo-router';

import { Api } from '@/api/cliente';
import { useDialogos } from '@/componentes/Dialogos';
import { Rol } from '@/sesion/SesionContext';

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
  const partes = String(n.enlace ?? '').split('/').filter(Boolean);
  if (!partes.length) return;
  const id = partes[1] && /^\d+$/.test(partes[1]) ? Number(partes[1]) : null;
  switch (partes[0]) {
    case 'cotizaciones':
      if (id) router.push(`/cotizaciones/${id}`);
      break;
    case 'inspecciones':
      router.push(id ? `/inspeccion/${id}` : '/agenda');
      break;
    case 'informes':
      if (!id) router.push('/informes');
      else if (rol === Rol.director || rol === Rol.admin) router.push(`/informes/revision/${id}`);
      else await d.ejecutar(() => Api.abrirPdf(`/informes/${id}/enlace-pdf`));
      break;
    case 'programacion':
      router.push('/programacion');
      break;
    case 'certificados':
      if (id) await d.ejecutar(() => Api.abrirPdf(`/certificados/${id}/enlace-pdf`));
      else router.push('/certificados');
      break;
  }
}
