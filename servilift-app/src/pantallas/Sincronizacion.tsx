// Estado de la sincronización: qué sigue guardado en el teléfono, qué falló y por qué.
// Nada se borra solo: un cambio con error espera a que el usuario decida reintentar o descartar.
import { Stack } from 'expo-router';
import { View } from 'react-native';
import { Button, Text } from 'react-native-paper';

import { Contenido, EstadoChip, Fila, Icon, Tarjeta, Vacio } from '@/componentes/Comunes';
import { useDialogos } from '@/componentes/Dialogos';
import { cola } from '@/offline/cola';
import { useSincronizacion } from '@/offline/SincronizacionContext';
import { Colores, fechaHoraLocal } from '@/tema';

export default function Sincronizacion() {
  const s = useSincronizacion();
  const d = useDialogos();
  return (
    <>
      <Stack.Screen options={{ title: 'Sincronización' }} />
      <Contenido ancho={800}>
        <Tarjeta>
          <Fila>
            <Icon nombre={s.enLinea ? 'wifi' : 'wifi-off'} color={s.enLinea ? Colores.exito : Colores.alerta} tam={28} />
            <View style={{ flex: 1 }}>
              <Text style={{ fontWeight: '700' }}>{s.enLinea ? 'Con conexión' : 'Sin conexión'}</Text>
              <Text style={{ color: Colores.gris, fontSize: 12 }}>
                {s.pendientes
                  ? `${s.pendientes} cambio(s) guardados en este teléfono${s.enviando ? ': enviando…' : ''}`
                  : 'Todo lo diligenciado ya está en el servidor'}
                {s.ultimaSincronizacion ? ` · Última sincronización: ${fechaHoraLocal(s.ultimaSincronizacion)}` : ''}
              </Text>
            </View>
            <Button mode="contained" icon="sync" onPress={s.sincronizar} disabled={!s.pendientes || s.enviando}>Enviar ahora</Button>
          </Fila>
        </Tarjeta>
        <Text style={{ color: Colores.gris, fontSize: 12, padding: 8 }}>
          Los cambios se guardan primero en el teléfono y se envían solos cuando hay señal, en el orden en que se hicieron.
          Si cierra la app o se apaga el celular, siguen aquí.
        </Text>
        {!s.operaciones.length && <Vacio texto="No hay cambios pendientes" icono="cloud-check-outline" />}
        {s.operaciones.map((o) => (
          <Tarjeta key={o.id}>
            <Fila>
              <View style={{ flex: 1, minWidth: 200 }}>
                <Text style={{ fontWeight: '600' }}>{o.descripcion}</Text>
                <Text style={{ color: Colores.gris, fontSize: 12 }}>
                  Inspección #{o.idInspeccion} · {fechaHoraLocal(o.creada)}
                  {o.tipo === 'resultados' || o.tipo === 'segunda' ? ` · ${Object.keys(o.items).length} ítem(s)` : ''}
                  {o.intentos ? ` · ${o.intentos} intento(s)` : ''}
                </Text>
              </View>
              {o.error ? <EstadoChip estado="DEVUELTO" texto="Con error" /> : <EstadoChip estado="PENDIENTE_REVISION" texto="Pendiente" />}
            </Fila>
            {o.error && (
              <>
                <Text style={{ color: Colores.error, marginTop: 6 }}>{o.error}</Text>
                <Fila style={{ justifyContent: 'flex-end', marginTop: 6 }}>
                  <Button textColor={Colores.error} onPress={async () => {
                    if (await d.confirmar('Descartar cambio', 'Este cambio no se enviará y se borrará del teléfono. ¿Continuar?', 'Descartar')) {
                      await cola.descartar(o.id);
                    }
                  }}>Descartar</Button>
                  <Button mode="outlined" onPress={async () => {
                    await cola.reintentar(o.id);
                    s.sincronizar();
                  }}>Reintentar</Button>
                </Fila>
              </>
            )}
          </Tarjeta>
        ))}
      </Contenido>
    </>
  );
}
