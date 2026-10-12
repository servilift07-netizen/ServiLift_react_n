// Página de inicio de cada rol: indicadores, gráficas y pendientes (GET /dashboard).
import { router, Stack } from 'expo-router';
import { RefreshControl, useWindowDimensions, View } from 'react-native';
import { List, Text } from 'react-native-paper';

import { Api } from '@/api/cliente';
import { AvisoCache, Contenido, EstadoCarga, EstadoChip, Tarjeta, Titulo } from '@/componentes/Comunes';
import { Barras, Columnas, DatoGrafica, Dona } from '@/componentes/Graficas';
import { useCarga } from '@/hooks/useCarga';
import { useSesion } from '@/sesion/SesionContext';
import { Colores, colorNombre } from '@/tema';

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
