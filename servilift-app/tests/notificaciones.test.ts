import { describe, expect, it } from 'vitest';

import { destinoNotificacion } from '@/logica/notificaciones';

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
