// Bandeja del director técnico: informes por revisar o aprobados. Cada visita tiene su propio informe.
import { router, Stack } from 'expo-router';
import { useState } from 'react';
import { RefreshControl, View } from 'react-native';
import { Text } from 'react-native-paper';

import { Api } from '@/api/cliente';
import { Contenido, EstadoCarga, EstadoChip, Fila, Tarjeta, Vacio } from '@/componentes/Comunes';
import { Segmentos } from '@/componentes/Segmentos';
import { useCarga } from '@/hooks/useCarga';
import { Colores } from '@/tema';

export function ListaInformes({ estado }: { estado: 'PENDIENTE_REVISION' | 'APROBADO' }) {
  const [visita, setVisita] = useState('');
  const c = useCarga<any[]>(() => Api.get('/informes', { estado, numero_visita: visita || null }), [estado, visita]);
  return (
    <>
      <Stack.Screen options={{ title: estado === 'APROBADO' ? 'Informes aprobados' : 'Informes por revisar' }} />
      <Contenido refreshControl={<RefreshControl refreshing={false} onRefresh={c.recargar} />}>
        <Segmentos valor={visita} onCambiar={setVisita} style={{ marginBottom: 8 }}
          opciones={[{ valor: '', texto: 'Todos' }, { valor: '1', texto: '1ª visita' }, { valor: '2', texto: '2ª visita' }]} />
        {!c.datos ? <EstadoCarga error={c.error} onReintentar={c.recargar} />
          : !c.datos.length ? <Vacio texto={estado === 'APROBADO' ? 'No hay informes aprobados' : 'No hay informes por revisar'} icono="clipboard-check-outline" />
            : c.datos.map((inf) => {
              const r = inf.resumen_actual;
              return (
                <Tarjeta key={inf.id_informe} onPress={() => router.push(`/informes/revision/${inf.id_informe}`)}>
                  <Fila>
                    <View style={{ width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center',
                      backgroundColor: inf.numero_visita === 2 ? Colores.alerta : Colores.acento }}>
                      <Text style={{ color: '#fff', fontWeight: '700' }}>{inf.numero_visita}ª</Text>
                    </View>
                    <View style={{ flex: 1, minWidth: 200 }}>
                      <Text style={{ fontWeight: '700' }}>{inf.numero_informe} · {inf.edificio} · {inf.servicio.equipo.identificacion}</Text>
                      <Text style={{ fontSize: 12, color: Colores.gris }}>
                        {inf.cliente} · {inf.numero_cotizacion} · {inf.norma} · Inspector: {inf.inspector}{'\n'}
                        {inf.numero_visita === 2
                          ? `Hallazgos ${r.total_no_cumple}: corregidos ${r.corregidos} · no corregidos ${r.no_corregidos}`
                          : `No cumple: L ${r.leves} · G ${r.graves} · MG ${r.muy_graves}`} · {inf.total_fotos} fotos
                      </Text>
                    </View>
                    {inf.concepto && <EstadoChip estado={inf.concepto} />}
                  </Fila>
                </Tarjeta>
              );
            })}
      </Contenido>
    </>
  );
}

export default function InformesPorRevisar() {
  return <ListaInformes estado="PENDIENTE_REVISION" />;
}
