// Álbum de fotos de la inspección. Las que aún están en el teléfono se ven con el ícono de "por subir".
// El director puede marcar cuáles van en el PDF.
import { useMemo, useState } from 'react';
import { Image, Pressable, ScrollView, useWindowDimensions, View } from 'react-native';
import { Button, Checkbox, Dialog, FAB, Portal, Text, TextInput } from 'react-native-paper';

import { Api, url } from '@/api/cliente';
import { EstadoCarga, Icon, Vacio } from '@/componentes/Comunes';
import { useDialogos } from '@/componentes/Dialogos';
import { useCarga } from '@/hooks/useCarga';
import { cola } from '@/offline/cola';
import { useSincronizacion } from '@/offline/SincronizacionContext';
import { aclarar, Colores, fechaHora } from '@/tema';
import { agregarFotos } from './fotos';
import { fotosPendientes, useEnvios } from './pendientes';
import { clavesCache } from './precarga';

interface FotoVista {
  clave: string;
  uri: string;
  uriGrande: string;
  descripcion?: string | null;
  pendiente: boolean;
  idFoto?: number;
  idOp?: string;
  incluir?: boolean;
  visita?: number;
  fecha?: string | null;
}

export default function FotosTab({ idInspeccion, editable, modoDirector }: { idInspeccion: number; editable: boolean; modoDirector?: boolean }) {
  const c = useCarga<any[]>(() => Api.get(`/inspecciones/${idInspeccion}/fotos`), [idInspeccion],
    { intervalo: null, cache: clavesCache.fotos(idInspeccion) });
  const sync = useSincronizacion();
  const d = useDialogos();
  const { width } = useWindowDimensions();
  const [vista, setVista] = useState<FotoVista | null>(null);
  const [descripcion, setDescripcion] = useState('');

  useEnvios(idInspeccion, (e) => {
    if (e.op.tipo === 'foto' || e.op.tipo === 'borrar_foto' || (e.op.tipo === 'put' && e.op.clave.startsWith('foto:'))) void c.recargar();
  });

  const ops = useMemo(() => sync.operaciones.filter((o) => o.idInspeccion === idInspeccion), [sync.operaciones, idInspeccion]);
  if (!c.datos) return <EstadoCarga error={c.error} onReintentar={c.recargar} />;

  const borradas = new Set(ops.filter((o) => o.tipo === 'borrar_foto').map((o: any) => o.idFoto));
  const fotos: FotoVista[] = [
    ...c.datos.filter((f) => !borradas.has(f.id_foto)).map((f) => ({
      clave: `s${f.id_foto}`, uri: url(f.url_miniatura), uriGrande: url(f.url), descripcion: f.descripcion, pendiente: false,
      idFoto: f.id_foto, incluir: f.incluir_en_informe, visita: f.numero_visita, fecha: f.fecha_captura,
    })),
    ...fotosPendientes(ops).map((f) => ({ clave: f.id, uri: f.uri, uriGrande: f.uri, descripcion: f.campos.descripcion,
      pendiente: true, idOp: f.id })),
  ];
  const enPdf = c.datos.filter((f) => f.incluir_en_informe).length;
  const lado = Math.min(180, Math.floor((Math.min(width, 1100) - 32) / Math.max(2, Math.floor(Math.min(width, 1100) / 170))));

  const abrir = (f: FotoVista) => {
    setVista(f);
    setDescripcion(f.descripcion ?? '');
  };

  const guardarDescripcion = async () => {
    if (!vista?.idFoto) return;
    await cola.put(idInspeccion, `foto:${vista.idFoto}`, `/inspecciones/${idInspeccion}/fotos/${vista.idFoto}`,
      { descripcion }, 'Descripción de una foto');
    setVista(null);
  };

  const eliminar = async () => {
    if (!vista) return;
    if (!(await d.confirmar('Eliminar foto', '¿Eliminar esta foto?', 'Eliminar'))) return;
    if (vista.idOp) await cola.descartar(vista.idOp);
    else if (vista.idFoto) {
      await cola.agregar({ tipo: 'borrar_foto', idInspeccion, idFoto: vista.idFoto, descripcion: 'Eliminar una foto' });
    }
    setVista(null);
  };

  return (
    <View style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={{ padding: 8, paddingBottom: 100 }}>
        <Text style={{ padding: 8 }}>
          {fotos.length} fotos · {enPdf} van en el informe{modoDirector ? ' (toque la casilla para incluir o excluir)' : ''}
        </Text>
        {!fotos.length && <Vacio texto="Aún no hay fotos del equipo" icono="camera-outline" />}
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, maxWidth: 1100, alignSelf: 'center' }}>
          {fotos.map((f) => (
            <Pressable key={f.clave} onPress={() => abrir(f)} style={{ width: lado, height: lado }}>
              <Image source={{ uri: f.uri }} style={{ width: '100%', height: '100%', borderRadius: 8, backgroundColor: Colores.borde }} />
              {!!f.descripcion && (
                <View style={{ position: 'absolute', left: 0, right: 0, bottom: 0, backgroundColor: '#00000088', padding: 4, borderBottomLeftRadius: 8, borderBottomRightRadius: 8 }}>
                  <Text numberOfLines={1} style={{ color: '#fff', fontSize: 11 }}>{f.descripcion}</Text>
                </View>
              )}
              {f.pendiente && (
                <View style={{ position: 'absolute', top: 4, left: 4, backgroundColor: aclarar(Colores.alerta, 0.9), borderRadius: 10, padding: 3 }}>
                  <Icon nombre="cloud-upload-outline" tam={14} color="#fff" />
                </View>
              )}
              {f.visita === 2 && (
                <View style={{ position: 'absolute', top: 4, right: modoDirector ? 40 : 4, backgroundColor: Colores.alerta, borderRadius: 6, paddingHorizontal: 4 }}>
                  <Text style={{ color: '#fff', fontSize: 10 }}>2ª</Text>
                </View>
              )}
              {modoDirector && f.idFoto && (
                <View style={{ position: 'absolute', top: 0, right: 0, backgroundColor: '#fffc', borderRadius: 6 }}>
                  <Checkbox
                    status={f.incluir ? 'checked' : 'unchecked'}
                    onPress={() => d.ejecutar(async () => {
                      await Api.put(`/inspecciones/${idInspeccion}/fotos/${f.idFoto}`, { incluir_en_informe: !f.incluir, revisada: true });
                      await c.recargar();
                    })}
                  />
                </View>
              )}
            </Pressable>
          ))}
        </View>
      </ScrollView>
      {editable && !modoDirector && (
        <FAB icon="camera-plus" label="Agregar fotos" style={{ position: 'absolute', right: 16, bottom: 16 }}
          onPress={() => agregarFotos(d, idInspeccion)} />
      )}
      <Portal>
        {vista && (
          <Dialog visible onDismiss={() => setVista(null)} style={{ maxWidth: 900, width: '96%', alignSelf: 'center' }}>
            <Dialog.Content style={{ gap: 10 }}>
              <Image source={{ uri: vista.uriGrande }} resizeMode="contain" style={{ width: '100%', height: 360, backgroundColor: '#000' }} />
              {vista.pendiente
                ? <Text style={{ color: Colores.alerta }}>Guardada en el teléfono: se sube sola cuando haya señal.</Text>
                : <Text style={{ color: Colores.gris, fontSize: 12 }}>{vista.visita === 2 ? 'Segunda visita · ' : ''}{fechaHora(vista.fecha)}</Text>}
              {!vista.pendiente && (
                <TextInput mode="outlined" dense label="Descripción" value={descripcion} onChangeText={setDescripcion}
                  disabled={!editable && !modoDirector} />
              )}
            </Dialog.Content>
            <Dialog.Actions>
              {editable && !modoDirector && <Button textColor={Colores.error} onPress={eliminar}>Eliminar</Button>}
              <Button onPress={() => setVista(null)}>Cerrar</Button>
              {(editable || modoDirector) && !vista.pendiente && <Button mode="contained" onPress={guardarDescripcion}>Guardar</Button>}
            </Dialog.Actions>
          </Dialog>
        )}
      </Portal>
    </View>
  );
}
