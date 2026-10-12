// Tomar o elegir fotos de la inspección.
//  · Celular: cada foto se reduce, se copia a la carpeta de la app y entra a la cola: se sube sola
//    cuando hay señal (con uuid, así un reintento no la duplica).
//  · Navegador (oficina): se suben de inmediato.
import * as ImagePicker from 'expo-image-picker';
import { Platform } from 'react-native';

import { Api } from '@/api/cliente';
import { useDialogos } from '@/componentes/Dialogos';
import { cola, uuid } from '@/offline/cola';
import { guardarFotoLocal } from '@/offline/fotosLocales';

type Dialogos = ReturnType<typeof useDialogos>;

export async function agregarFotos(d: Dialogos, idInspeccion: number, o: { idItem?: number; descripcion?: string } = {}): Promise<number> {
  let fuente = 'galeria';
  if (Platform.OS !== 'web') {
    const elegida = await d.elegir('Agregar fotos', [
      { valor: 'camara', texto: 'Tomar foto', icono: 'camera' },
      { valor: 'galeria', texto: 'Elegir de la galería (varias)', icono: 'image-multiple' },
    ]);
    if (!elegida) return 0;
    fuente = elegida;
  }

  let resultado: ImagePicker.ImagePickerResult;
  if (fuente === 'camara') {
    const permiso = await ImagePicker.requestCameraPermissionsAsync();
    if (!permiso.granted) {
      d.mensaje('Sin permiso para usar la cámara', true);
      return 0;
    }
    resultado = await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.85 });
  } else {
    resultado = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsMultipleSelection: true,
      selectionLimit: 30, quality: 0.85 });
  }
  if (resultado.canceled || !resultado.assets.length) return 0;
  const assets = resultado.assets;
  const campos: Record<string, string> = {};
  if (o.idItem) campos.id_item = String(o.idItem);
  if (o.descripcion) campos.descripcion = o.descripcion;

  if (Platform.OS === 'web') {
    let subidas = 0;
    const ok = await d.ejecutar(() => d.progreso(`Subiendo ${assets.length} foto(s)…`, async () => {
      for (let i = 0; i < assets.length; i += 5) {
        const lote = assets.slice(i, i + 5);
        await Api.subirFotos(`/inspecciones/${idInspeccion}/fotos`,
          lote.map((a) => ({ uri: a.uri, nombre: a.fileName ?? `foto_${Date.now()}.jpg`, tipo: a.mimeType ?? 'image/jpeg' })), campos);
        subidas += lote.length;
      }
    }));
    if (ok) d.mensaje(`${subidas} foto(s) subidas`);
    return subidas;
  }

  let guardadas = 0;
  await d.progreso('Guardando fotos en el teléfono…', async () => {
    for (const a of assets) {
      const id = uuid();
      const nombre = `${id}.jpg`;
      const uri = await guardarFotoLocal(a.uri, nombre, a.width);
      await cola.agregar({
        tipo: 'foto', idInspeccion, uuid: id, uri, nombre,
        campos: { ...campos, fecha_captura: new Date().toISOString() },
        descripcion: o.idItem ? 'Foto de evidencia del ítem' : 'Foto del registro fotográfico',
      });
      guardadas += 1;
    }
  });
  d.mensaje(`${guardadas} foto(s) guardadas en el teléfono; se suben solas`);
  return guardadas;
}
