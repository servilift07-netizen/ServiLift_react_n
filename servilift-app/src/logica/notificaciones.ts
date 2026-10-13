// A dónde lleva una notificación según su enlace ("informes/12") y el rol de quien la abre.

export type Destino = { tipo: 'ruta'; ruta: string } | { tipo: 'pdf'; url: string } | null;

const ROLES_QUE_REVISAN = ['DIRECTOR_TECNICO', 'ADMIN'];

export function destinoNotificacion(enlace: string | null | undefined, rol: string): Destino {
  const partes = String(enlace ?? '').split('/').filter(Boolean);
  if (!partes.length) return null;
  const id = partes[1] && /^\d+$/.test(partes[1]) ? Number(partes[1]) : null;
  switch (partes[0]) {
    case 'cotizaciones':
      return id ? { tipo: 'ruta', ruta: `/cotizaciones/${id}` } : null;
    case 'inspecciones':
      return { tipo: 'ruta', ruta: id ? `/inspeccion/${id}` : '/agenda' };
    case 'informes':
      if (!id) return { tipo: 'ruta', ruta: '/informes' };
      // El director revisa el informe; los demás roles abren el PDF aprobado
      return ROLES_QUE_REVISAN.includes(rol) ? { tipo: 'ruta', ruta: `/informes/revision/${id}` }
        : { tipo: 'pdf', url: `/informes/${id}/enlace-pdf` };
    case 'programacion':
      return { tipo: 'ruta', ruta: '/programacion' };
    case 'certificados':
      return id ? { tipo: 'pdf', url: `/certificados/${id}/enlace-pdf` } : { tipo: 'ruta', ruta: '/certificados' };
    default:
      return null;
  }
}

/** Notificación tal como llega del backend; "vigente" es false cuando lo que avisa ya se atendió. */
export type AvisoNotificacion = { vigente?: boolean };

/**
 * Lo que va en "Lo más reciente" del inicio: solo lo que sigue pendiente (p. ej. una inspección ya finalizada
 * y enviada al director ya no aparece) y como máximo `max`. Si el backend no manda "vigente", se muestra.
 */
export function paraInicio<T extends AvisoNotificacion>(lista: readonly T[], max = 4): { visibles: T[]; hayMas: boolean } {
  const pendientes = lista.filter((n) => n.vigente !== false);
  return { visibles: pendientes.slice(0, max), hayMas: pendientes.length > max };
}
