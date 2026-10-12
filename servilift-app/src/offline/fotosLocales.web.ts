// En el navegador (oficina) las fotos se suben de inmediato; no se guardan para más tarde.
export async function guardarFotoLocal(uriOrigen: string): Promise<string> {
  return uriOrigen;
}

export function borrarFotoLocal(_uri: string) {
  // nada que borrar
}

export function existeFotoLocal(_uri: string): boolean {
  return true;
}
