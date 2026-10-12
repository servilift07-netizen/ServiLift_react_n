// Visitas programadas de todos los inspectores, agrupadas por día; reprogramar o cancelar.
import { Stack } from 'expo-router';
import { useState } from 'react';
import { RefreshControl, View } from 'react-native';
import { IconButton, Menu, Text } from 'react-native-paper';

import { Api } from '@/api/cliente';
import { CampoFecha, Fechas } from '@/componentes/Campos';
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
        <CampoFecha etiqueta="Desde" valor={desdeTexto} onCambiar={setDesdeTexto} style={{ maxWidth: 280 }} />
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
  const cerrada = ['REALIZADA', 'CANCELADA'].includes(p.estado);

  const cancelar = async () => {
    setMenu(false);
    const motivo = await d.pedirTexto('Cancelar visita', { etiqueta: 'Motivo' });
    if (motivo && await d.ejecutar(() => Api.post(`/programacion/${p.id_programacion}/cancelar`, { motivo_cambio: motivo }),
      { exito: 'Visita cancelada' })) void recargar();
  };

  const reprogramar = async () => {
    setMenu(false);
    const v = await d.formulario({
      titulo: 'Reprogramar visita',
      campos: [
        { clave: 'fecha', etiqueta: 'Nueva fecha (dd/mm/aaaa)', obligatorio: true },
        { clave: 'hora', etiqueta: 'Hora (HH:MM)', obligatorio: true },
        { clave: 'motivo', etiqueta: 'Motivo', obligatorio: true },
      ],
      valores: { fecha: Fechas.mostrar(p.fecha_programada), hora: hora(p.hora_inicio), motivo: '' },
      guardar: async (x) => {
        const fechaNueva = Fechas.paraApi(x.fecha);
        if (!fechaNueva || !horaValida(x.hora)) throw new Error('Revise la fecha y la hora');
        return Api.put(`/programacion/${p.id_programacion}`, { fecha_programada: fechaNueva, hora_inicio: horaApi(x.hora), motivo_cambio: x.motivo });
      },
    });
    if (v) {
      d.mensaje('Visita reprogramada');
      void recargar();
    }
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
    </Tarjeta>
  );
}
