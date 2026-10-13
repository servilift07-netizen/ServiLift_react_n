// Deja en el teléfono lo necesario para trabajar una inspección sin señal:
// detalle, checklist, fotos y los catálogos (variantes de su norma e instrumentos).
import { Api } from '@/api/cliente';
import { guardarCache } from '@/offline/almacenamiento';

export const clavesCache = {
  inspeccion: (id: number) => `insp:${id}`,
  checklist: (id: number) => `checklist:${id}`,
  fotos: (id: number) => `fotos:${id}`,
  variantes: (parte: number) => `variantes:${parte}`,
  instrumentos: 'instrumentos',
  parametros: 'parametros',
};

export async function precargarInspeccion(id: number): Promise<boolean> {
  try {
    const [insp, checklist, fotos] = await Promise.all([
      Api.get(`/inspecciones/${id}`),
      Api.get(`/inspecciones/${id}/checklist`),
      Api.get(`/inspecciones/${id}/fotos`),
    ]);
    await Promise.all([
      guardarCache(clavesCache.inspeccion(id), insp),
      guardarCache(clavesCache.checklist(id), checklist),
      guardarCache(clavesCache.fotos(id), fotos),
    ]);
    const [variantes, instrumentos, parametros] = await Promise.all([
      Api.get('/catalogos/variantes', { parte: insp.parte_norma ?? 1 }),
      Api.get('/instrumentos'),
      Api.get('/catalogos/parametros'),
    ]);
    await guardarCache(clavesCache.variantes(insp.parte_norma ?? 1), variantes);
    await guardarCache(clavesCache.instrumentos, instrumentos);
    await guardarCache(clavesCache.parametros, parametros);
    return true;
  } catch {
    return false;
  }
}
