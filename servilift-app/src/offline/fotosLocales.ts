// Fotos tomadas sin señal: se reducen (máx. 1920 px) y se copian a la carpeta de documentos de la app,
// que el sistema no borra. Ahí esperan hasta que la cola de sincronización las sube.
import { Directory, File, Paths } from 'expo-file-system';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';

const carpeta = () => new Directory(Paths.document, 'fotos-pendientes');

export async function guardarFotoLocal(uriOrigen: string, nombre: string, ancho?: number): Promise<string> {
  const dir = carpeta();
  if (!dir.exists) dir.create({ intermediates: true });
  let uri = uriOrigen;
  try {
    const ctx = ImageManipulator.manipulate(uriOrigen);
    if (ancho && ancho > 1920) ctx.resize({ width: 1920 });
    const img = await ctx.renderAsync();
    const r = await img.saveAsync({ compress: 0.8, format: SaveFormat.JPEG });
    uri = r.uri;
  } catch {
    // si no se pudo reducir se guarda la original
  }
  const destino = new File(dir, nombre);
  if (destino.exists) destino.delete();
  await new File(uri).copy(destino);
  return destino.uri;
}

export function borrarFotoLocal(uri: string) {
  try {
    const f = new File(uri);
    if (f.exists) f.delete();
  } catch {
    // ya no existe
  }
}

export function existeFotoLocal(uri: string): boolean {
  try {
    return new File(uri).exists;
  } catch {
    return false;
  }
}
