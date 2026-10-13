import { describe, expect, it } from 'vitest';

import { destinoNotificacion, paraInicio } from '@/logica/notificaciones';

describe('destinoNotificacion', () => {
  it('should open the report review when the technical director taps a report notification', () => {
    // Arrange
    const enlace = 'informes/12';

    // Act
    const destino = destinoNotificacion(enlace, 'DIRECTOR_TECNICO');

    // Assert
    expect(destino).toEqual({ tipo: 'ruta', ruta: '/informes/revision/12' });
  });

  it('should open the approved PDF when the client taps a report notification', () => {
    expect(destinoNotificacion('informes/12', 'CLIENTE')).toEqual({ tipo: 'pdf', url: '/informes/12/enlace-pdf' });
  });

  it.each([
    ['cotizaciones/5', { tipo: 'ruta', ruta: '/cotizaciones/5' }],
    ['inspecciones/9', { tipo: 'ruta', ruta: '/inspeccion/9' }],
    ['inspecciones', { tipo: 'ruta', ruta: '/agenda' }],
    ['informes', { tipo: 'ruta', ruta: '/informes' }],
    ['programacion/3', { tipo: 'ruta', ruta: '/programacion' }],
    ['certificados/4', { tipo: 'pdf', url: '/certificados/4/enlace-pdf' }],
    ['certificados', { tipo: 'ruta', ruta: '/certificados' }],
    ['/cotizaciones/5/', { tipo: 'ruta', ruta: '/cotizaciones/5' }],
  ])('should send the link %j to %o', (enlace, destino) => {
    expect(destinoNotificacion(enlace, 'ASESOR')).toEqual(destino);
  });

  it.each([[null], [''], ['cotizaciones'], ['cotizaciones/abc'], ['desconocido/1']])(
    'should not navigate when the link is %j',
    (enlace) => {
      expect(destinoNotificacion(enlace, 'ASESOR')).toBeNull();
    },
  );
});

describe('paraInicio', () => {
  it('should hide an inspection notice once the inspection was finalized and sent to the director', () => {
    // Arrange
    const lista = [{ id: 1, vigente: false }, { id: 2, vigente: true }];

    // Act
    const { visibles } = paraInicio(lista);

    // Assert
    expect(visibles.map((n) => n.id)).toEqual([2]);
  });

  it('should keep showing notices when the server does not say whether they are pending', () => {
    expect(paraInicio([{ id: 1 }, { id: 2, vigente: undefined }]).visibles).toHaveLength(2);
  });

  it.each([
    [3, 3, false],
    [4, 4, false],
    [5, 4, true],
  ])('should show at most 4 pending notices: %i pending -> %i visible, more=%s', (pendientes, visibles, hayMas) => {
    const lista = Array.from({ length: pendientes }, (_, i) => ({ id: i, vigente: true }));

    const r = paraInicio(lista);

    expect(r.visibles).toHaveLength(visibles);
    expect(r.hayMas).toBe(hayMas);
  });

  it('should not count handled notices when deciding whether there are more pending ones', () => {
    const lista = [...Array.from({ length: 4 }, () => ({ vigente: true })), { vigente: false }];

    expect(paraInicio(lista).hayMas).toBe(false);
  });

  it('should return nothing for an empty list', () => {
    expect(paraInicio([])).toEqual({ visibles: [], hayMas: false });
  });
});
