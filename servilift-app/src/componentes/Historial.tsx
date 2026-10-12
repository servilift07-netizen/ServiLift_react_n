// Línea de tiempo de un equipo cotizado (estados y hechos: envío, visitas, devoluciones, certificado...).
import { useState } from 'react';
import { ScrollView, View } from 'react-native';
import { Button, Dialog, IconButton, Portal, Text } from 'react-native-paper';

import { Api } from '@/api/cliente';
import { Colores, colorEstado, fechaHora } from '@/tema';
import { EstadoChip, Icon } from './Comunes';
import { useDialogos } from './Dialogos';

export function BotonHistorial({ idCotizacionEquipo, compacto, color }: { idCotizacionEquipo?: number | null; compacto?: boolean; color?: string }) {
  const d = useDialogos();
  const [datos, setDatos] = useState<any>(null);
  if (!idCotizacionEquipo) return null;
  const abrir = () => d.ejecutar(async () => setDatos(await Api.get(`/seguimiento/equipo/${idCotizacionEquipo}/historial`)));
  return (
    <>
      {compacto
        ? <IconButton icon="history" iconColor={color} onPress={abrir} accessibilityLabel="Historial" />
        : <Button icon="history" compact onPress={abrir}>Historial</Button>}
      <Portal>
        {datos && (
          <Dialog visible onDismiss={() => setDatos(null)} style={{ maxWidth: 560, width: '94%', alignSelf: 'center' }}>
            <Dialog.Title>Historial {datos.codigo_servicio}</Dialog.Title>
            <View style={{ paddingHorizontal: 24, gap: 6 }}>
              <Text style={{ color: Colores.gris }}>{datos.edificio} · {datos.equipo} · {datos.norma}</Text>
              <EstadoChip estado={datos.estado_actual} texto={`Estado actual: ${datos.estado_etiqueta}`} />
            </View>
            <Dialog.ScrollArea style={{ maxHeight: 420, marginTop: 8 }}>
              <ScrollView contentContainerStyle={{ paddingVertical: 8, gap: 10 }}>
                {datos.historial.length === 0 && <Text>Sin movimientos todavía</Text>}
                {datos.historial.map((e: any, i: number) => (
                  <View key={i} style={{ flexDirection: 'row', gap: 10 }}>
                    <Icon nombre={e.evento ? 'information-outline' : 'circle'} tam={e.evento ? 18 : 12} color={colorEstado(e.estado_nuevo)} />
                    <View style={{ flex: 1 }}>
                      <Text>{e.estado_etiqueta}</Text>
                      <Text style={{ fontSize: 12, color: Colores.gris }}>
                        {[fechaHora(e.fecha), e.usuario, e.comentario].filter(Boolean).join(' · ')}
                      </Text>
                    </View>
                  </View>
                ))}
              </ScrollView>
            </Dialog.ScrollArea>
            <Dialog.Actions><Button onPress={() => setDatos(null)}>Cerrar</Button></Dialog.Actions>
          </Dialog>
        )}
      </Portal>
    </>
  );
}
