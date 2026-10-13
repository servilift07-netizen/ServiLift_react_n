// Visitas programadas de todos los inspectores, agrupadas por día; reprogramar o cancelar.
import { Stack } from 'expo-router';
import { useState } from 'react';
import { RefreshControl, View } from 'react-native';
import { Button, Dialog, IconButton, Menu, Portal, Text, TextInput } from 'react-native-paper';

import { Api } from '@/api/cliente';
import { CampoFecha, CampoHora, Fechas } from '@/componentes/Campos';
import { Contenido, EstadoCarga, EstadoChip, Fila, Tarjeta, Titulo, Vacio } from '@/componentes/Comunes';
import { useDialogos } from '@/componentes/Dialogos';
import { useCarga } from '@/hooks/useCarga';
import { Colores, fechaApi, fechaLarga, hora } from '@/tema';
import { horaApi, horaValida } from './PorProgramar';

export default function Calendario() {
  const ayer = new Date();
  ayer.setDate(ayer.getDate() - 1);
  const [desdeTexto, setDesdeTexto] = useState(Fechas.mostrar(fechaApi(ayer)));
  let desde: string | null = null;
  try {
    desde = Fechas.paraApi(desdeTexto);
  } catch {
    desde = null;
  }
  const c = useCarga<any[]>(() => Api.get('/programacion', { desde }), [desde]);
  const porDia = new Map<string, any[]>();
  for (const p of c.datos ?? []) {
    if (!porDia.has(p.fecha_programada)) porDia.set(p.fecha_programada, []);
    porDia.get(p.fecha_programada)!.push(p);
  }
  return (
    <>
      <Stack.Screen options={{ title: 'Calendario' }} />
      <Contenido refreshControl={<RefreshControl refreshing={false} onRefresh={c.recargar} />}>
        <CampoFecha etiqueta="Desde" valor={desdeTexto} onCambiar={setDesdeTexto} permitirNI={false} style={{ maxWidth: 280 }} />
        {!c.datos ? <EstadoCarga error={c.error} onReintentar={c.recargar} />
          : !c.datos.length ? <Vacio texto="No hay visitas programadas" icono="calendar-month-outline" />
            : [...porDia.entries()].map(([dia, visitas]) => (
              <View key={dia}>
                <Titulo texto={fechaLarga(dia)} />
                {visitas.map((p) => <Visita key={p.id_programacion} p={p} recargar={c.recargar} />)}
              </View>
            ))}
      </Contenido>
    </>
  );
}

function Visita({ p, recargar }: { p: any; recargar: () => Promise<void> }) {
  const d = useDialogos();
  const [menu, setMenu] = useState(false);
  const [reprogramando, setReprogramando] = useState(false);
  const cerrada = ['REALIZADA', 'CANCELADA'].includes(p.estado);

  const cancelar = async () => {
    setMenu(false);
    const motivo = await d.pedirTexto('Cancelar visita', { etiqueta: 'Motivo' });
    if (motivo && await d.ejecutar(() => Api.post(`/programacion/${p.id_programacion}/cancelar`, { motivo_cambio: motivo }),
      { exito: 'Visita cancelada' })) void recargar();
  };

  const reprogramar = () => {
    setMenu(false);
    setReprogramando(true);
  };

  return (
    <Tarjeta>
      <Fila>
        <View style={{ backgroundColor: Colores.superficie, borderRadius: 20, padding: 8 }}>
          <Text style={{ fontSize: 12, fontWeight: '700' }}>{hora(p.hora_inicio)}</Text>
        </View>
        <View style={{ flex: 1, minWidth: 200 }}>
          <Text style={{ fontWeight: '600' }}>{p.numero_cotizacion} · {p.edificio?.nombre ?? ''}{p.tipo_visita === 'SEGUNDA' ? ' (2ª visita)' : ''}</Text>
          <Text style={{ fontSize: 12, color: Colores.gris }}>
            {p.inspector} · {p.equipos.map((e: any) => e.equipo.identificacion).join(', ')}{'\n'}{p.edificio?.direccion ?? ''}
          </Text>
        </View>
        {cerrada ? <EstadoChip estado={p.estado} /> : (
          <Menu visible={menu} onDismiss={() => setMenu(false)} anchor={<IconButton icon="dots-vertical" onPress={() => setMenu(true)} />}>
            <Menu.Item leadingIcon="calendar-edit" onPress={reprogramar} title="Reprogramar" />
            <Menu.Item leadingIcon="calendar-remove" onPress={cancelar} title="Cancelar" />
          </Menu>
        )}
      </Fila>
      {reprogramando && (
        <DialogoReprogramar p={p} cerrar={(ok) => {
          setReprogramando(false);
          if (ok) void recargar();
        }} />
      )}
    </Tarjeta>
  );
}

/** Reprogramar una visita: nueva fecha (calendario, sin días pasados), hora (reloj) y motivo. */
function DialogoReprogramar({ p, cerrar }: { p: any; cerrar: (ok: boolean) => void }) {
  const d = useDialogos();
  const [dia, setDia] = useState(p.fecha_programada >= Fechas.hoy() ? Fechas.mostrar(p.fecha_programada) : Fechas.mostrar(Fechas.hoy()));
  const [horaInicio, setHoraInicio] = useState(hora(p.hora_inicio));
  const [motivo, setMotivo] = useState('');
  const [enviando, setEnviando] = useState(false);

  const guardar = async () => {
    const fechaNueva = Fechas.paraApi(dia);
    if (!fechaNueva || fechaNueva < Fechas.hoy()) return d.mensaje('Elija una fecha de hoy en adelante', true);
    if (!horaValida(horaInicio)) return d.mensaje('Elija la hora', true);
    if (!motivo.trim()) return d.mensaje('Escriba el motivo del cambio', true);
    setEnviando(true);
    const ok = await d.ejecutar(() => Api.put(`/programacion/${p.id_programacion}`,
      { fecha_programada: fechaNueva, hora_inicio: horaApi(horaInicio), motivo_cambio: motivo.trim() }), { exito: 'Visita reprogramada' });
    setEnviando(false);
    if (ok) cerrar(true);
  };

  return (
    <Portal>
      <Dialog visible onDismiss={() => cerrar(false)} style={{ maxWidth: 480, width: '94%', alignSelf: 'center' }}>
        <Dialog.Title>Reprogramar visita</Dialog.Title>
        <Dialog.Content style={{ gap: 10 }}>
          <Text style={{ color: Colores.gris }}>{p.numero_cotizacion} · {p.edificio?.nombre ?? ''}</Text>
          <CampoFecha etiqueta="Nueva fecha" valor={dia} onCambiar={setDia} minimo={Fechas.hoy()} permitirNI={false} />
          <CampoHora etiqueta="Hora de inicio" valor={horaInicio} onCambiar={setHoraInicio} />
          <TextInput mode="outlined" dense label="Motivo del cambio *" value={motivo} onChangeText={setMotivo} multiline />
        </Dialog.Content>
        <Dialog.Actions>
          <Button onPress={() => cerrar(false)}>Cancelar</Button>
          <Button mode="contained" loading={enviando} disabled={enviando} onPress={guardar}>Reprogramar</Button>
        </Dialog.Actions>
      </Dialog>
    </Portal>
  );
}
