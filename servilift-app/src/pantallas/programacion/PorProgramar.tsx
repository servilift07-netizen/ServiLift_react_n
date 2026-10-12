// Bandeja de programación: equipos aprobados (1ª visita) y con 2ª visita solicitada (cierre de hallazgos).
import { Stack } from 'expo-router';
import { useEffect, useState } from 'react';
import { RefreshControl, ScrollView, View } from 'react-native';
import { Button, Checkbox, Chip, Dialog, Portal, Text, TextInput } from 'react-native-paper';

import { Api } from '@/api/cliente';
import { CampoFecha, Fechas, Selector } from '@/componentes/Campos';
import { Contenido, EstadoCarga, EstadoChip, Fila, Tarjeta, Vacio } from '@/componentes/Comunes';
import { useDialogos } from '@/componentes/Dialogos';
import { BotonHistorial } from '@/componentes/Historial';
import { useCarga } from '@/hooks/useCarga';
import { aclarar, Colores, fecha, fechaApi } from '@/tema';

export const horaValida = (h: string) => /^([01]?\d|2[0-3]):[0-5]\d$/.test(h.trim());
export const horaApi = (h: string) => `${h.trim().padStart(5, '0')}:00`;

export default function PorProgramar() {
  const c = useCarga<any[]>(() => Api.get('/programacion/pendientes'), []);
  const [programar, setProgramar] = useState<{ cot: any; equipos: any[]; tipo: string } | null>(null);
  return (
    <>
      <Stack.Screen options={{ title: 'Por programar' }} />
      {!c.datos ? <EstadoCarga error={c.error} onReintentar={c.recargar} /> : (
        <Contenido refreshControl={<RefreshControl refreshing={false} onRefresh={c.recargar} />}>
          {!c.datos.length && <Vacio texto="No hay equipos pendientes por programar" icono="calendar-check-outline" />}
          {c.datos.flatMap((cot) => [
            cot.equipos_por_programar.length ? { cot, equipos: cot.equipos_por_programar, tipo: 'PRIMERA' } : null,
            cot.equipos_segunda_visita.length ? { cot, equipos: cot.equipos_segunda_visita, tipo: 'SEGUNDA' } : null,
          ]).filter(Boolean).map((g: any) => {
            const ed = g.cot.edificio_detalle ?? {};
            return (
              <Tarjeta key={`${g.cot.id_cotizacion}-${g.tipo}`}>
                <Fila>
                  <Text style={{ flex: 1, fontSize: 16, fontWeight: '800', color: Colores.navy }}>{g.cot.numero_cotizacion} · {g.cot.edificio}</Text>
                  <EstadoChip estado={g.tipo === 'SEGUNDA' ? 'SEGUNDA_VISITA_SOLICITADA' : 'POR_PROGRAMAR'}
                    texto={g.tipo === 'SEGUNDA' ? 'Segunda visita (última)' : 'Primera visita'} />
                </Fila>
                <Text>{g.cot.cliente} · {ed.direccion ?? ''}, {ed.ciudad ?? ''}</Text>
                {ed.administrador_nombre && <Text style={{ color: Colores.gris }}>Contacto: {ed.administrador_nombre} {ed.administrador_telefono ?? ''}</Text>}
                <Fila style={{ marginVertical: 6 }}>
                  {g.equipos.map((e: any) => (
                    <View key={e.id_cotizacion_equipo} style={{ flexDirection: 'row', alignItems: 'center' }}>
                      <Chip compact style={{ backgroundColor: (e.dias_restantes ?? 99) <= 3 ? aclarar(Colores.error) : undefined }}>
                        {e.dias_restantes === null || e.dias_restantes === undefined ? e.equipo.identificacion
                          : `${e.equipo.identificacion} · vence ${fecha(e.fecha_limite_correccion)} (${e.dias_restantes < 0 ? 'vencido' : `quedan ${e.dias_restantes} días`})`}
                      </Chip>
                      <BotonHistorial idCotizacionEquipo={e.id_cotizacion_equipo} compacto />
                    </View>
                  ))}
                </Fila>
                <Button mode="contained" icon="calendar" style={{ alignSelf: 'flex-end' }} onPress={() => setProgramar(g)}>Programar</Button>
              </Tarjeta>
            );
          })}
        </Contenido>
      )}
      {programar && <DialogoProgramar {...programar} cerrar={(ok) => { setProgramar(null); if (ok) void c.recargar(); }} />}
    </>
  );
}

function DialogoProgramar({ cot, equipos, tipo, cerrar }: { cot: any; equipos: any[]; tipo: string; cerrar: (ok: boolean) => void }) {
  const d = useDialogos();
  const [inspectores, setInspectores] = useState<any[]>([]);
  const [inspector, setInspector] = useState<number | null>(null);
  const manana = new Date();
  manana.setDate(manana.getDate() + 1);
  const [dia, setDia] = useState(Fechas.mostrar(fechaApi(manana)));
  const [horaInicio, setHoraInicio] = useState('08:00');
  const [horaFin, setHoraFin] = useState('');
  const [obs, setObs] = useState('');
  const [sel, setSel] = useState<Set<number>>(() => new Set(equipos.map((e) => e.id_cotizacion_equipo)));
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    Api.get('/usuarios', { rol: 'INSPECTOR' }).then((l: any[]) => setInspectores(l.filter((u) => u.rol === 'INSPECTOR'))).catch(() => undefined);
  }, []);

  const guardar = async () => {
    let fechaProg: string | null;
    try {
      fechaProg = Fechas.paraApi(dia);
    } catch {
      fechaProg = null;
    }
    if (!inspector || !sel.size || !fechaProg) return d.mensaje('Seleccione inspector, fecha y equipos', true);
    if (!horaValida(horaInicio) || (horaFin && !horaValida(horaFin))) return d.mensaje('Hora inválida (use HH:MM)', true);
    setEnviando(true);
    const ok = await d.ejecutar(() => Api.post('/programacion', {
      id_cotizacion: cot.id_cotizacion, id_inspector: inspector, fecha_programada: fechaProg, hora_inicio: horaApi(horaInicio),
      hora_fin_estimada: horaFin ? horaApi(horaFin) : null, ids_cotizacion_equipo: [...sel], tipo_visita: tipo,
      observaciones: obs.trim() || null,
    }), { exito: 'Programado. Se notificó al inspector.' });
    setEnviando(false);
    if (ok) cerrar(true);
  };

  return (
    <Portal>
      <Dialog visible onDismiss={() => cerrar(false)} style={{ maxWidth: 520, width: '94%', alignSelf: 'center' }}>
        <Dialog.Title>{tipo === 'SEGUNDA' ? 'Segunda visita' : 'Programar'} {cot.numero_cotizacion}</Dialog.Title>
        <Dialog.ScrollArea style={{ maxHeight: 500 }}>
          <ScrollView contentContainerStyle={{ paddingVertical: 8, gap: 10 }} keyboardShouldPersistTaps="handled">
            {equipos.map((e) => (
              <Checkbox.Item key={e.id_cotizacion_equipo} position="leading" labelStyle={{ textAlign: 'left' }}
                label={`${e.equipo.identificacion} · ${e.codigo_servicio}`}
                status={sel.has(e.id_cotizacion_equipo) ? 'checked' : 'unchecked'}
                onPress={() => setSel((s) => {
                  const n = new Set(s);
                  if (n.has(e.id_cotizacion_equipo)) n.delete(e.id_cotizacion_equipo); else n.add(e.id_cotizacion_equipo);
                  return n;
                })} />
            ))}
            <Selector etiqueta="Inspector" valor={inspector} onCambiar={setInspector}
              opciones={inspectores.map((u) => ({ valor: u.id_usuario, texto: u.nombre_completo }))} />
            <CampoFecha etiqueta="Fecha de la visita" valor={dia} onCambiar={setDia} />
            <Fila>
              <TextInput mode="outlined" dense label="Hora inicio (HH:MM)" value={horaInicio} onChangeText={setHoraInicio} style={{ flex: 1 }} />
              <TextInput mode="outlined" dense label="Fin estimado (opcional)" value={horaFin} onChangeText={setHoraFin} style={{ flex: 1 }} />
            </Fila>
            <TextInput mode="outlined" dense label="Observaciones" multiline value={obs} onChangeText={setObs} />
          </ScrollView>
        </Dialog.ScrollArea>
        <Dialog.Actions>
          <Button onPress={() => cerrar(false)}>Cancelar</Button>
          <Button mode="contained" loading={enviando} disabled={enviando} onPress={guardar}>Programar y notificar</Button>
        </Dialog.Actions>
      </Dialog>
    </Portal>
  );
}
