import { describe, expect, it } from 'vitest';

import { validarIngreso } from '@/logica/login';

describe('validarIngreso', () => {
  it('should allow sending the form when email and password are filled', () => {
    // Arrange
    const correo = 'asesor@gmail.com';
    const clave = '123456';

    // Act
    const error = validarIngreso(correo, clave);

    // Assert
    expect(error).toBe('');
  });

  it.each([
    ['', '123456'],
    ['   ', '123456'],
    ['\t', '123456'],
    ['asesor@gmail.com', ''],
  ])('should ask for email and password when the values are %j and %j', (correo, clave) => {
    expect(validarIngreso(correo, clave)).toBe('Ingrese correo y contraseña');
  });

  it('should not trim the password because a space can be part of it', () => {
    expect(validarIngreso('asesor@gmail.com', ' ')).toBe('');
  });
});
