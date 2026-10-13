// Validación del formulario de ingreso, antes de llamar al backend.

/** Devuelve el mensaje de error o '' si se puede enviar. La contraseña no se recorta: un espacio puede ser parte de ella. */
export function validarIngreso(correo: string, clave: string): string {
  if (!correo.trim() || !clave) return 'Ingrese correo y contraseña';
  return '';
}
