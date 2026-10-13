// Página de inicio de cada rol: indicadores, gráficas y pendientes (GET /dashboard).
import { router, Stack } from 'expo-router';
import { RefreshControl, useWindowDimensions, View } from 'react-native';
import { Button, List, Text } from 'react-native-paper';

import { Api } from '@/api/cliente';
import { AvisoCache, Contenido, EstadoCarga, EstadoChip, Icon, Tarjeta, Titulo } from '@/componentes/Comunes';
import { useDialogos } from '@/componentes/Dialogos';
import { Barras, Columnas, DatoGrafica, Dona } from '@/componentes/Graficas';
import { useCarga } from '@/hooks/useCarga';
import { useSesion } from '@/sesion/SesionContext';
import { aclarar, Colores, colorNombre, fechaHora } from '@/tema';
import { abrirNotificacion } from './abrirNotificacion';

export default function Inicio() {
  const { usuario } = useSesion();
  const { width } = useWindowDimensions();
  const c = useCarga<any>(() => Api.get('/dashboard'), [], { intervalo: 60000, cache: `dashboard:${usuario?.id_usuario}` });
  const d = c.datos;
  return (
    <>
      <Stack.Screen options={{ title: 'Inicio' }} />
      <AvisoCache visible={c.desdeCache} guardadoEn={c.guardadoEn} />
      {!d ? <EstadoCarga error={c.error} onReintentar={c.recargar} /> : (
        <Contenido refreshControl={<RefreshControl refreshing={false} onRefresh={c.recargar} />}>
          <Text style={{ fontSize: 24, fontWeight: '800', color: Colores.navy, marginBottom: 12 }}>{d.titulo ?? 'Inicio'}</Text>
          <LoMasReciente />
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
            {(d.kpis ?? []).map((k: any, i: number) => (
              <View key={i} style={{ width: width < 500 ? '47%' : 210, padding: 14, backgroundColor: '#fff', borderRadius: 12,
                borderLeftWidth: 5, borderLeftColor: colorNombre(k.color), elevation: 1, shadowColor: '#000',
                shadowOpacity: 0.06, shadowRadius: 6, shadowOffset: { width: 0, height: 2 } }}>
                <Text style={{ color: Colores.gris, fontSize: 13 }}>{k.titulo}</Text>
                <Text style={{ fontSize: 26, fontWeight: '800', color: colorNombre(k.color) }}>{k.valor}</Text>
                {k.detalle && <Text style={{ fontSize: 12, color: Colores.gris }}>{k.detalle}</Text>}
              </View>
            ))}
          </View>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 16, marginTop: 16 }}>
            {(d.graficas ?? []).map((g: any, i: number) => {
              const datos: DatoGrafica[] = g.datos ?? [];
              const vacia = !datos.length || datos.every((x) => !x.valor);
              return (
                <Tarjeta key={i} style={{ width: width >= 1100 ? 520 : '100%', marginVertical: 0 }}>
                  <Text style={{ fontWeight: '700', fontSize: 15, marginBottom: 12 }}>{g.titulo}</Text>
                  {vacia ? <Text style={{ color: Colores.gris, textAlign: 'center', paddingVertical: 30 }}>Sin datos todavía</Text>
                    : g.tipo === 'dona' ? <Dona datos={datos} /> : g.tipo === 'meses' ? <Columnas datos={datos} /> : <Barras datos={datos} />}
                </Tarjeta>
              );
            })}
          </View>
          {(d.listas ?? []).filter((l: any) => l.items?.length).map((l: any, i: number) => (
            <View key={i}>
              <Titulo texto={l.titulo} />
              <Tarjeta>
                {l.items.map((it: any, j: number) => (
                  <List.Item
                    key={j}
                    title={it.texto}
                    titleNumberOfLines={2}
                    description={it.subtexto || undefined}
                    right={() => (it.estado ? <EstadoChip estado={it.estado} /> : null)}
                    onPress={it.id_cotizacion ? () => router.push(`/cotizaciones/${it.id_cotizacion}`)
                      : it.id_informe ? () => router.push(`/informes/revision/${it.id_informe}`) : undefined}
                  />
                ))}
              </Tarjeta>
            </View>
          ))}
        </Contenido>
      )}
    </>
  );
}

/** "hace 5 min", "hace 2 h", "ayer"… a partir de una fecha ISO con zona */
function hace(iso?: string | null): string {
  if (!iso) return '';
  const min = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (Number.isNaN(min)) return '';
  if (min < 1) return 'ahora';
  if (min < 60) return `hace ${min} min`;
  if (min < 24 * 60) return `hace ${Math.round(min / 60)} h`;
  if (min < 48 * 60) return 'ayer';
  return fechaHora(iso);
}

/** Recuadro con lo último que se le asignó o le llegó al usuario (sus notificaciones), con acceso directo. */
function LoMasReciente() {
  const { rol } = useSesion();
  const d = useDialogos();
  const c = useCarga<any[]>(() => Api.get('/notificaciones'), [], { intervalo: 30000 });
  const lista = (c.datos ?? []).slice(0, 4);
  if (!c.datos) return null;
  const abrir = async (n: any) => {
    await abrirNotificacion(n, rol, d);
    void c.recargar();
  };
  const [primera, ...resto] = lista;
  return (
    <View style={{ marginBottom: 16 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 }}>
        <Icon nombre="bell-ring-outline" color={Colores.acento} />
        <Text style={{ fontWeight: '700', fontSize: 16, flex: 1 }}>Lo más reciente</Text>
        {c.datos.length > 4 && <Button compact onPress={() => router.push('/notificaciones')}>Ver todo</Button>}
      </View>
      {!primera ? (
        <Tarjeta><Text style={{ color: Colores.gris }}>No tiene novedades por ahora.</Text></Tarjeta>
      ) : (
        <>
          <Tarjeta onPress={() => abrir(primera)} style={{ borderLeftWidth: 5, borderLeftColor: Colores.acento,
            backgroundColor: primera.leida ? '#fff' : aclarar(Colores.acento, 0.06) }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 12, color: Colores.acento, fontWeight: '700' }}>
                  {primera.leida ? 'ÚLTIMA NOVEDAD' : 'NUEVO'} · {hace(primera.fecha_creacion)}
                </Text>
                <Text style={{ fontSize: 17, fontWeight: '800', color: Colores.navy, marginTop: 2 }}>{primera.titulo}</Text>
                <Text style={{ marginTop: 2 }}>{primera.mensaje}</Text>
              </View>
              {!!primera.enlace && (
                <View style={{ backgroundColor: Colores.acento, borderRadius: 20, paddingHorizontal: 16, paddingVertical: 8,
                  flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                  <Text style={{ color: '#fff', fontWeight: '700' }}>Abrir</Text>
                  <Icon nombre="arrow-right" color="#fff" tam={18} />
                </View>
              )}
            </View>
          </Tarjeta>
          {resto.map((n) => (
            <Tarjeta key={n.id_notificacion} onPress={() => abrir(n)}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <Icon nombre={n.leida ? 'bell-outline' : 'bell-ring'} color={n.leida ? Colores.gris : Colores.acento} tam={18} />
                <Text numberOfLines={1} style={{ flex: 1, fontWeight: n.leida ? '400' : '700' }}>{n.titulo}</Text>
                <Text style={{ fontSize: 12, color: Colores.gris }}>{hace(n.fecha_creacion)}</Text>
                {!!n.enlace && <Icon nombre="chevron-right" tam={18} />}
              </View>
            </Tarjeta>
          ))}
        </>
      )}
    </View>
  );
}
