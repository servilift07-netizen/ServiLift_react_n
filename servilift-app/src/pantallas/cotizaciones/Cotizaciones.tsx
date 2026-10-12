import { router, Stack } from 'expo-router';
import { useState } from 'react';
import { RefreshControl, View } from 'react-native';
import { FAB, List, TextInput } from 'react-native-paper';

import { Api } from '@/api/cliente';
import { Selector } from '@/componentes/Campos';
import { Contenido, EstadoCarga, EstadoChip, Fila, Tarjeta, Vacio } from '@/componentes/Comunes';
import { useCarga } from '@/hooks/useCarga';
import { Rol, useSesion } from '@/sesion/SesionContext';
import { etiqueta, fecha, moneda } from '@/tema';

export default function Cotizaciones() {
  const { es } = useSesion();
  const esAsesor = es(Rol.asesor);
  const [texto, setTexto] = useState('');
  const [filtro, setFiltro] = useState({ numero: '', estado: null as string | null });
  const c = useCarga<any[]>(() => Api.get('/cotizaciones', filtro), [filtro.numero, filtro.estado]);
  const estados = [...(esAsesor ? ['BORRADOR'] : []), 'ENVIADA_CLIENTE', 'APROBADA_CLIENTE', 'RECHAZADA_CLIENTE',
    'ENVIADA_PROGRAMACION', 'EN_EJECUCION', 'FINALIZADA', 'ANULADA'];

  return (
    <View style={{ flex: 1 }}>
      <Stack.Screen options={{ title: 'Cotizaciones' }} />
      <Contenido refreshControl={<RefreshControl refreshing={false} onRefresh={c.recargar} />}>
        <Fila style={{ marginBottom: 8 }}>
          <TextInput mode="outlined" dense style={{ flexGrow: 1, minWidth: 220 }} label="Buscar por número" value={texto}
            onChangeText={setTexto} onSubmitEditing={() => setFiltro((f) => ({ ...f, numero: texto.trim() }))}
            left={<TextInput.Icon icon="magnify" />} />
          <Selector style={{ flexGrow: 1, minWidth: 220 }} etiqueta="Estado" valor={filtro.estado} permitirVacio
            opciones={estados.map((e) => ({ valor: e, texto: etiqueta(e) }))} onCambiar={(v) => setFiltro((f) => ({ ...f, estado: v }))} />
        </Fila>
        {!c.datos ? <EstadoCarga error={c.error} onReintentar={c.recargar} />
          : !c.datos.length ? <Vacio texto="No hay cotizaciones" />
            : c.datos.map((x) => (
              <Tarjeta key={x.id_cotizacion} onPress={() => router.push(`/cotizaciones/${x.id_cotizacion}`)}>
                <List.Item style={{ paddingHorizontal: 0 }} title={`${x.numero_cotizacion} · ${x.edificio}`} titleStyle={{ fontWeight: '700' }}
                  description={`${x.cliente}\n${x.cantidad_equipos} equipos · ${moneda(x.total)} · ${fecha(x.fecha_cotizacion)}`}
                  right={() => <EstadoChip estado={x.estado} />} />
              </Tarjeta>
            ))}
      </Contenido>
      {esAsesor && (
        <FAB icon="plus" label="Nueva cotización" style={{ position: 'absolute', right: 16, bottom: 16 }}
          onPress={() => router.push('/cotizaciones/formulario')} />
      )}
    </View>
  );
}
