// Informe de inspección en el celular: datos precargados, variantes, checklist, fotos, firmas y finalizar.
// Todo lo que se diligencia se guarda primero en el teléfono y se sincroniza solo.
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import { Button, Text } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Api, ApiError } from '@/api/cliente';
import { AvisoCache, EstadoCarga, Icon } from '@/componentes/Comunes';
import { useDialogos } from '@/componentes/Dialogos';
import { BotonHistorial } from '@/componentes/Historial';
import { Segmentos } from '@/componentes/Segmentos';
import { useCarga } from '@/hooks/useCarga';
import { volver } from '@/navegacion';
import { useSincronizacion } from '@/offline/SincronizacionContext';
import { Rol, useSesion } from '@/sesion/SesionContext';
import { aclarar, Colores, etiqueta } from '@/tema';
import ChecklistTab from './ChecklistTab';
import DatosTab from './DatosTab';
import FirmasTab from './FirmasTab';
import FotosTab from './FotosTab';
import { useEnvios } from './pendientes';
import { clavesCache } from './precarga';

export default function Inspeccion() {
  const { id: idTexto } = useLocalSearchParams<{ id: string }>();
  const id = Number(idTexto);
  const { rol } = useSesion();
  const sync = useSincronizacion();
  const d = useDialogos();
  const ins = useSafeAreaInsets();
  const [pestana, setPestana] = useState('datos');
  const c = useCarga<any>(() => Api.get(`/inspecciones/${id}`), [id], { intervalo: 60000, cache: clavesCache.inspeccion(id) });

  // Firmas, variantes y datos del informe que llegan al servidor actualizan el encabezado
  useEnvios(id, (e) => {
    if (e.op.tipo === 'firma' || e.op.tipo === 'put') void c.recargar();
  });

  if (!c.datos) {
    return (<><Stack.Screen options={{ title: 'Inspección' }} /><EstadoCarga error={c.error} onReintentar={c.recargar} /></>);
  }
  const i = c.datos;
  const segunda = i.estado === 'EN_SEGUNDA_VISITA';
  const editable = rol === Rol.inspector && ['EN_CURSO', 'DEVUELTA', 'EN_SEGUNDA_VISITA'].includes(i.estado);
  const pendientes = sync.pendientesDe(id);
  const conError = pendientes.filter((o) => o.error).length;
  const equipo = i.datos_equipo?.equipo ?? {};
  const edificio = i.datos_equipo?.edificio ?? {};

  const finalizar = async () => {
    if (pendientes.length) {
      sync.sincronizar();
      await d.alerta('Hay cambios sin sincronizar',
        `${pendientes.length} cambio(s) siguen guardados solo en el teléfono${conError ? ` (${conError} con error)` : ''}. `
        + 'Cuando tenga señal se envían solos; luego podrá finalizar. Puede revisarlos en Sincronización.');
      return;
    }
    let val: any;
    try {
      val = await d.progreso('Validando…', () => Api.get(`/inspecciones/${id}/validar`));
    } catch (e) {
      d.mensaje(e instanceof ApiError && e.sinConexion ? 'Para finalizar necesita conexión' : String(e), true);
      return;
    }
    if (!val.puede_finalizar) {
      await d.alerta('Faltan datos para finalizar', val.pendientes.map((p: string) => `• ${p}`).join('\n'));
      return;
    }
    if (!(await d.confirmar(`Finalizar ${segunda ? 'segunda visita' : 'inspección'}`,
      'El informe pasará al director técnico para su revisión y atestación. No podrá modificarlo después.', 'Finalizar'))) return;
    if (await d.ejecutar(() => Api.post(`/inspecciones/${id}/finalizar`), { exito: 'Enviado al director técnico' })) {
      volver('/agenda');
    }
  };

  return (
    <View style={{ flex: 1 }}>
      <Stack.Screen options={{ title: `${edificio.nombre ?? ''} · ${equipo.identificacion ?? ''}` }} />
      <AvisoCache visible={c.desdeCache} guardadoEn={c.guardadoEn} />
      <View style={{ backgroundColor: '#fff', paddingHorizontal: 12, paddingTop: 8, gap: 6 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Text style={{ flex: 1, color: Colores.gris, fontSize: 12 }}>
            {i.numero_inspeccion} · {i.norma} · {segunda ? '2ª visita' : '1ª visita'} · {etiqueta(i.estado)}
          </Text>
          <BotonHistorial idCotizacionEquipo={i.id_cotizacion_equipo} compacto />
        </View>
        {i.estado === 'DEVUELTA' && i.informe?.observaciones_revision && (
          <Aviso color={Colores.error} icono="undo" texto={`Devuelto por el director: ${i.informe.observaciones_revision}`} />
        )}
        {segunda && (
          <Aviso color={Colores.alerta} icono="clipboard-check-outline"
            texto="Segunda visita (la última): marque cada hallazgo como corregido o no corregido y recoja las firmas. Si queda algún hallazgo sin corregir, el equipo necesitará una cotización nueva." />
        )}
        {editable && (pendientes.length > 0
          ? <Aviso color={conError ? Colores.error : Colores.alerta} icono={conError ? 'cloud-alert' : 'cellphone-arrow-down'}
              texto={`${pendientes.length} cambio(s) guardados en el teléfono${sync.enviando ? ': enviando…' : ', se enviarán al recuperar señal'}${conError ? ` · ${conError} con error` : ''}`}
              accion={() => router.navigate('/sincronizacion')} />
          : <Aviso color={Colores.exito} icono="cloud-check-outline" texto="Todo sincronizado con el servidor" />)}
        <Segmentos
          valor={pestana}
          onCambiar={setPestana}
          opciones={[{ valor: 'datos', texto: 'Datos' }, { valor: 'checklist', texto: 'Checklist' },
            { valor: 'fotos', texto: 'Fotos' }, { valor: 'firmas', texto: 'Firmas' }]}
          style={{ marginBottom: 8 }}
        />
      </View>
      <View style={{ flex: 1 }}>
        {pestana === 'datos' && <DatosTab insp={i} editable={editable && !segunda} fijar={c.fijar} />}
        {pestana === 'checklist' && <ChecklistTab idInspeccion={id} editable={editable} segundaVisita={segunda} />}
        {pestana === 'fotos' && <FotosTab idInspeccion={id} editable={editable} />}
        {pestana === 'firmas' && <FirmasTab insp={i} editable={editable} />}
      </View>
      {editable && (
        <View style={{ padding: 12, paddingBottom: 12 + ins.bottom, backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: Colores.borde }}>
          <Button mode="contained" icon="send" buttonColor={Colores.exito} onPress={finalizar} contentStyle={{ height: 46 }}>
            {segunda ? 'Finalizar segunda visita' : 'Finalizar inspección'}
          </Button>
        </View>
      )}
    </View>
  );
}

function Aviso({ color, icono, texto, accion }: { color: string; icono: any; texto: string; accion?: () => void }) {
  return (
    <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center', backgroundColor: aclarar(color, 0.1), padding: 8, borderRadius: 8 }}>
      <Icon nombre={icono} tam={18} color={color} />
      <Text style={{ flex: 1, color, fontSize: 12 }} onPress={accion}>{texto}</Text>
    </View>
  );
}
