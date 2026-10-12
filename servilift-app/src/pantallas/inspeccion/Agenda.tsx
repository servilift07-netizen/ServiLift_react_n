// Agenda del inspector: visitas asignadas; en cada una elige el equipo a inspeccionar.
// Con señal, deja guardadas en el teléfono las inspecciones abiertas para seguir trabajando sin conexión.
import * as Crypto from 'expo-crypto';
import { router, Stack } from 'expo-router';
import { useEffect, useState } from 'react';
import { Linking, RefreshControl, View } from 'react-native';
import { Button, Text } from 'react-native-paper';

import { Api, ApiError } from '@/api/cliente';
import { AvisoCache, Contenido, EstadoCarga, EstadoChip, Fila, Icon, Tarjeta, Vacio } from '@/componentes/Comunes';
import { useDialogos } from '@/componentes/Dialogos';
import { BotonHistorial } from '@/componentes/Historial';
import { useCarga } from '@/hooks/useCarga';
import { useSesion } from '@/sesion/SesionContext';
import { Colores, esHoy, fechaLarga, hora } from '@/tema';
import { precargarInspeccion } from './precarga';

export default function Agenda() {
  const { usuario } = useSesion();
  const c = useCarga<any[]>(() => Api.get('/inspecciones/agenda'), [], { cache: `agenda:${usuario?.id_usuario}` });
  const [listas, setListas] = useState<Record<number, boolean>>({});

  // Precarga para trabajar sin señal (solo cuando los datos vienen del servidor)
  useEffect(() => {
    if (!c.datos || c.desdeCache) return;
    const ids = c.datos.flatMap((v) => v.equipos).map((e: any) => e.inspeccion?.id_inspeccion).filter(Boolean) as number[];
    void (async () => {
      for (const id of ids) {
        const ok = await precargarInspeccion(id);
        setListas((x) => ({ ...x, [id]: ok }));
      }
    })();
  }, [c.datos, c.desdeCache]);

  return (
    <>
      <Stack.Screen options={{ title: 'Mi agenda' }} />
      <AvisoCache visible={c.desdeCache} guardadoEn={c.guardadoEn} />
      {!c.datos ? <EstadoCarga error={c.error} onReintentar={c.recargar} /> : (
        <Contenido ancho={800} refreshControl={<RefreshControl refreshing={false} onRefresh={c.recargar} />}>
          {!c.datos.length && <Vacio texto="No tiene visitas asignadas" icono="calendar-remove-outline" />}
          {c.datos.map((v) => <Visita key={v.id_programacion} v={v} listas={listas} recargar={c.recargar} />)}
        </Contenido>
      )}
    </>
  );
}

function Visita({ v, listas, recargar }: { v: any; listas: Record<number, boolean>; recargar: () => Promise<void> }) {
  const d = useDialogos();
  const ed = v.edificio ?? {};
  const segunda = v.tipo_visita === 'SEGUNDA';

  const abrir = async (e: any) => {
    let insp = e.inspeccion;
    // Abre el informe precargado (lo crea si aún no existe). La primera apertura necesita señal.
    if (!insp || (segunda && insp.estado === 'APROBADA')) {
      try {
        insp = await d.progreso('Abriendo el informe…', () => Api.post('/inspecciones/iniciar', {
          id_programacion: v.id_programacion, id_cotizacion_equipo: e.id_cotizacion_equipo, uuid_offline: Crypto.randomUUID(),
        }));
      } catch (err) {
        if (err instanceof ApiError && err.sinConexion) {
          await d.alerta('Necesita conexión', 'Para abrir la inspección por primera vez se necesita señal. Una vez abierta, '
            + 'puede llenar el checklist, tomar fotos y recoger firmas sin conexión: todo queda guardado en el teléfono.');
        } else d.mensaje(err instanceof ApiError ? err.message : String(err), true);
        return;
      }
      await precargarInspeccion(insp.id_inspeccion);
      void recargar();
    }
    router.push(`/inspeccion/${insp.id_inspeccion}`);
  };

  const textoBoton = (e: any) => {
    const insp = e.inspeccion;
    if (!insp) return 'Iniciar';
    switch (insp.estado) {
      case 'EN_CURSO':
      case 'EN_SEGUNDA_VISITA':
        return 'Continuar';
      case 'DEVUELTA':
        return 'Corregir';
      case 'APROBADA':
        return segunda ? 'Iniciar 2ª visita' : 'Ver';
      default:
        return 'Ver';
    }
  };

  return (
    <Tarjeta>
      <Fila>
        <Icon nombre="calendar" color={esHoy(v.fecha_programada) ? Colores.exito : Colores.acento} />
        <Text style={{ fontWeight: '700', flex: 1 }}>{fechaLarga(v.fecha_programada)} · {hora(v.hora_inicio)}</Text>
        {segunda && <EstadoChip estado="SEGUNDA_VISITA_SOLICITADA" texto="Segunda visita" />}
      </Fila>
      <Text style={{ fontSize: 17, fontWeight: '800', color: Colores.navy, marginTop: 6 }}>{ed.nombre}</Text>
      <Text>{v.cliente} · {v.numero_cotizacion}</Text>
      <Text style={{ color: Colores.acento }} onPress={() => Linking.openURL(
        `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${ed.direccion}, ${ed.ciudad}`)}`)}>
        {ed.direccion}, {ed.ciudad} (ver mapa)
      </Text>
      {ed.administrador_nombre && <Text style={{ color: Colores.gris }}>Contacto: {ed.administrador_nombre} {ed.administrador_telefono ?? ''}</Text>}
      {v.observaciones && <Text style={{ color: Colores.gris }}>Nota: {v.observaciones}</Text>}
      <View style={{ borderTopWidth: 1, borderTopColor: Colores.borde, marginTop: 10, paddingTop: 6 }}>
        {v.equipos.map((e: any) => {
          const id = e.inspeccion?.id_inspeccion;
          return (
            <Fila key={e.id_cotizacion_equipo} style={{ paddingVertical: 6 }}>
              <Icon nombre="elevator-passenger-outline" tam={28} />
              <View style={{ flex: 1, minWidth: 150 }}>
                <Text style={{ fontWeight: '600' }}>{e.equipo.identificacion}</Text>
                <Text style={{ fontSize: 12, color: Colores.gris }}>{e.codigo_servicio} · {e.norma}</Text>
                {id && listas[id] && (
                  <Text style={{ fontSize: 11, color: Colores.exito }}>✓ Lista para trabajar sin señal</Text>
                )}
              </View>
              <BotonHistorial idCotizacionEquipo={e.id_cotizacion_equipo} compacto />
              <Button mode="contained" onPress={() => abrir(e)}>{textoBoton(e)}</Button>
            </Fila>
          );
        })}
      </View>
    </Tarjeta>
  );
}
