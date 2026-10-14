// Notificaciones: al tocarlas se marcan como leídas y abren lo que avisan.
import { Stack } from 'expo-router';
import { RefreshControl } from 'react-native';
import { Button, List } from 'react-native-paper';

import { Api } from '@/api/cliente';
import { Contenido, EstadoCarga, Icon, Tarjeta, Vacio } from '@/componentes/Comunes';
import { useDialogos } from '@/componentes/Dialogos';
import { useCarga } from '@/hooks/useCarga';
import { useSesion } from '@/sesion/SesionContext';
import { Colores, fechaHora } from '@/tema';
import { abrirNotificacion } from './abrirNotificacion';

export default function Notificaciones() {
  const c = useCarga<any[]>(() => Api.get('/notificaciones'), []);
  const d = useDialogos();
  const { rol } = useSesion();

  return (
    <>
      <Stack.Screen options={{ title: 'Notificaciones' }} />
      {!c.datos ? <EstadoCarga error={c.error} onReintentar={c.recargar} /> : (
        <Contenido ancho={800} refreshControl={<RefreshControl refreshing={false} onRefresh={c.recargar} />}>
          {c.datos.some((n) => !n.leida) && (
            <Button icon="check-all" style={{ alignSelf: 'flex-end' }}
              onPress={() => d.ejecutar(async () => { await Api.put('/notificaciones/leidas'); await c.recargar(); })}>
              Marcar todas como leídas
            </Button>
          )}
          {!c.datos.length && <Vacio texto="No tiene notificaciones" icono="bell-off-outline" />}
          {c.datos.map((n) => (
            <Tarjeta key={n.id_notificacion} onPress={async () => {
              await abrirNotificacion(n, rol, d);
              void c.recargar();
            }}>
              <List.Item
                style={{ paddingHorizontal: 0 }}
                title={n.titulo}
                titleStyle={{ fontWeight: n.leida ? '400' : '700' }}
                description={`${n.mensaje}\n${fechaHora(n.fecha_creacion)}${n.vigente === false ? ' · Ya atendida' : ''}`}
                descriptionNumberOfLines={5}
                left={() => <Icon nombre={n.leida ? 'bell-outline' : 'bell-ring'} color={n.leida ? Colores.gris : Colores.acento} />}
                right={() => (n.enlace ? <Icon nombre="chevron-right" /> : null)}
              />
            </Tarjeta>
          ))}
        </Contenido>
      )}
    </>
  );
}
