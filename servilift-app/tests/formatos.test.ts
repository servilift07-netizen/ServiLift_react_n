import { describe, expect, it } from 'vitest';

import { esHoy, fecha, fechaApi, fechaHora, fechaHoraLocal, fechaLarga, hora, moneda } from '@/logica/formatos';

describe('fecha y hora del backend (hora de Colombia)', () => {
  it('should show the API date as day/month/year without depending on the device time zone', () => {
    expect(fecha('2026-10-12T23:30:00-05:00')).toBe('12/10/2026');
  });

  it.each([[null], [undefined], ['']])('should show a dash when the date is %j', (v) => {
    expect(fecha(v)).toBe('-');
    expect(fechaHora(v)).toBe('-');
    expect(hora(v)).toBe('-');
  });

  it('should keep the original text when it is not a date', () => {
    expect(fecha('pendiente')).toBe('pendiente');
  });

  it('should add the hour and minutes when the value has time', () => {
    expect(fechaHora('2026-10-12T08:05:00-05:00')).toBe('12/10/2026 08:05');
    expect(fechaHora('2026-10-12')).toBe('12/10/2026');
  });

  it('should cut the seconds of an API time', () => {
    expect(hora('08:30:00')).toBe('08:30');
    expect(hora('8:3')).toBe('8:3');
  });

  it('should write the long date in Spanish', () => {
    expect(fechaLarga('2026-10-12')).toBe('lunes 12 de octubre');
    expect(fechaLarga('sin fecha')).toBe('sin fecha');
  });
});

describe('moneda', () => {
  it.each([
    [0, '$ 0'],
    [999, '$ 999'],
    [1000, '$ 1.000'], // borde: primer valor con separador de miles
    [1234567, '$ 1.234.567'],
    [-2500, '-$ 2.500'],
    ['1500.6', '$ 1.501'],
    ['abc', '$ 0'],
  ])('should format %j as %j', (valor, esperado) => {
    expect(moneda(valor)).toBe(esperado);
  });
});

describe('esHoy (el reloj se recibe por parámetro: FIRST repeatable)', () => {
  const hoy = new Date(2026, 9, 12, 15, 0); // 12 de octubre de 2026, hora local

  it.each([
    ['2026-10-12', true],
    ['2026-10-12T07:00:00-05:00', true],
    ['2026-10-11', false], // borde: ayer
    ['2026-10-13', false], // borde: mañana
    [null, false],
  ])('should say %j is today = %s', (v, esperado) => {
    expect(esHoy(v, hoy)).toBe(esperado);
  });

  it('should format a device date for the API with leading zeros', () => {
    expect(fechaApi(new Date(2026, 0, 5))).toBe('2026-01-05');
  });
});

describe('fechaHoraLocal', () => {
  it('should show a dash for an empty or invalid ISO date', () => {
    expect(fechaHoraLocal(null)).toBe('-');
    expect(fechaHoraLocal('no-es-fecha')).toBe('-');
  });

  it('should show a device date with day, month, year, hour and minutes', () => {
    const iso = new Date(2026, 9, 12, 9, 7).toISOString();
    expect(fechaHoraLocal(iso)).toBe('12/10/2026 09:07');
  });
});
