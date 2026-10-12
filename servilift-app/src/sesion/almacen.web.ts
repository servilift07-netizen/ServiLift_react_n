// En el navegador la sesión vive en la pestaña (sessionStorage): cada pestaña puede tener su propio usuario.
export async function leer(clave: string): Promise<string | null> {
  try {
    return window.sessionStorage.getItem(clave);
  } catch {
    return null;
  }
}

export async function guardar(clave: string, valor: string): Promise<void> {
  try {
    window.sessionStorage.setItem(clave, valor);
  } catch {
    // almacenamiento bloqueado: la sesión dura mientras la página esté abierta
  }
}

export async function borrar(clave: string): Promise<void> {
  try {
    window.sessionStorage.removeItem(clave);
  } catch {
    // nada que borrar
  }
}
