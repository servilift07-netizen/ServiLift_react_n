// Notificaciones: al tocarlas se marcan como leídas y abren lo que avisan.
import { router, Stack } from 'expo-router';
import { RefreshControl } from 'react-native';
import { Button, List } from 'react-native-paper';

import { Api } from '@/api/cliente';
import { Contenido, EstadoCarga, Icon, Tarjeta, Vacio } from '@/componentes/Comunes';
import { useDialogos } from '@/componentes/Dialogos';
import { useCarga } from '@/hooks/useCarga';
import { Rol, useSesion } from '@/sesion/SesionContext';
import { Colores, fechaHora } from '@/tema';

export default function Notificaciones() {
  const c = useCarga<any[]>(() => Api.get('/notificaciones'), []);
  const d = useDialogos();
  const { rol } = useSesion();

  /** Abre la pantalla a la que apunta el campo "enlace" del backend. */
  const abrir = async (n: any) => {
    const partes = String(n.enlace ?? '').split('/').filter(Boolean);
    if (!partes.length) return;
    const id = partes[1] && /^\d+$/.test(partes[1]) ? Number(partes[1]) : null;
    switch (partes[0]) {
      case 'cotizaciones':
        if (id) router.push(`/cotizaciones/${id}`);
        break;
      case 'inspecciones':
        router.push(id ? `/inspeccion/${id}` : '/agenda');
        break;
      case 'informes':
        if (!id) router.push('/informes');
        else if (rol === Rol.director || rol === Rol.admin) router.push(`/informes/revision/${id}`);
        else await d.ejecutar(() => Api.abrirPdf(`/informes/${id}/enlace-pdf`));
        break;
      case 'programacion':
        router.push('/programacion');
        break;
      case 'certificados':
        if (id) await d.ejecutar(() => Api.abrirPdf(`/certificados/${id}/enlace-pdf`));
        else router.push('/certificados');
        break;
    }
  };

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
              if (!n.leida) {
                try {
                  await Api.put(`/notificaciones/${n.id_notificacion}/leida`);
                } catch {
                  // se marcará la próxima vez
                }
              }
              await abrir(n);
              void c.recargar();
            }}>
              <List.Item
                style={{ paddingHorizontal: 0 }}
                title={n.titulo}
                titleStyle={{ fontWeight: n.leida ? '400' : '700' }}
                description={`${n.mensaje}\n${fechaHora(n.fecha_creacion)}`}
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
