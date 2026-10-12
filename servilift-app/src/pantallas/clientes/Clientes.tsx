// Clientes y edificios: búsqueda por nombre (cliente, NIT, contacto, ciudad) o por edificio.
import { router, Stack } from 'expo-router';
import { useState } from 'react';
import { RefreshControl, View } from 'react-native';
import { FAB, List, TextInput } from 'react-native-paper';

import { Api } from '@/api/cliente';
import { Contenido, EstadoCarga, Icon, Tarjeta, Vacio } from '@/componentes/Comunes';
import { useDialogos } from '@/componentes/Dialogos';
import { Segmentos } from '@/componentes/Segmentos';
import { useCarga } from '@/hooks/useCarga';
import { Rol, useSesion } from '@/sesion/SesionContext';
import { CAMPOS_CLIENTE } from '../catalogos';

export default function Clientes() {
  const d = useDialogos();
  const { es } = useSesion();
  const [modo, setModo] = useState<'clientes' | 'edificios'>('clientes');
  const [texto, setTexto] = useState('');
  const [buscar, setBuscar] = useState('');
  const c = useCarga<any[]>(() => Api.get(modo === 'clientes' ? '/clientes' : '/edificios', { buscar }), [modo, buscar]);

  const nuevo = async () => {
    const cli = await d.formulario({ titulo: 'Nuevo cliente', campos: CAMPOS_CLIENTE, guardar: (v) => Api.post('/clientes', v) });
    if (cli?.id_cliente) router.push(`/clientes/${cli.id_cliente}`);
    void c.recargar();
  };

  return (
    <View style={{ flex: 1 }}>
      <Stack.Screen options={{ title: 'Clientes y edificios' }} />
      <Contenido refreshControl={<RefreshControl refreshing={false} onRefresh={c.recargar} />}>
        <Segmentos
          valor={modo}
          onCambiar={(v) => setModo(v as 'clientes' | 'edificios')}
          opciones={[{ valor: 'clientes', texto: 'Clientes' }, { valor: 'edificios', texto: 'Edificios' }]}
          style={{ marginBottom: 8 }}
        />
        <TextInput
          mode="outlined"
          dense
          label={modo === 'clientes' ? 'Buscar por nombre, NIT, contacto o ciudad' : 'Buscar edificio por nombre, dirección, barrio o cliente'}
          value={texto}
          onChangeText={setTexto}
          onSubmitEditing={() => setBuscar(texto.trim())}
          left={<TextInput.Icon icon="magnify" />}
          right={<TextInput.Icon icon="arrow-right" onPress={() => setBuscar(texto.trim())} />}
        />
        {!c.datos ? <EstadoCarga error={c.error} onReintentar={c.recargar} />
          : !c.datos.length ? <Vacio texto={buscar ? 'Sin resultados para la búsqueda' : 'No hay registros'} />
            : c.datos.map((x) => (modo === 'clientes' ? (
              <Tarjeta key={x.id_cliente} onPress={() => router.push(`/clientes/${x.id_cliente}`)}>
                <List.Item style={{ paddingHorizontal: 0 }} title={x.razon_social} titleStyle={{ fontWeight: '700' }}
                  description={`${x.tipo_documento} ${x.numero_documento} · ${x.ciudad ?? ''}\nAsesor: ${x.asesor ?? '-'}`}
                  left={() => <Icon nombre="domain" />} right={() => <Icon nombre="chevron-right" />} />
              </Tarjeta>
            ) : (
              <Tarjeta key={x.id_edificio} onPress={() => router.push(`/clientes/edificio/${x.id_edificio}`)}>
                <List.Item style={{ paddingHorizontal: 0 }} title={x.nombre} titleStyle={{ fontWeight: '700' }}
                  description={`${x.direccion}, ${x.ciudad} · ${x.cliente}\n${x.equipos_registrados} de ${x.numero_equipos} ascensores registrados`}
                  left={() => <Icon nombre="office-building-outline" />} right={() => <Icon nombre="chevron-right" />} />
              </Tarjeta>
            )))}
      </Contenido>
      {es(Rol.asesor) && modo === 'clientes' && (
        <FAB icon="account-plus-outline" label="Nuevo cliente" style={{ position: 'absolute', right: 16, bottom: 16 }} onPress={nuevo} />
      )}
    </View>
  );
}
