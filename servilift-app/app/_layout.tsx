import { Slot } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { View } from 'react-native';
import { ActivityIndicator, PaperProvider } from 'react-native-paper';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { DialogosProvider } from '@/componentes/Dialogos';
import { SincronizacionProvider } from '@/offline/SincronizacionContext';
import { SesionProvider, useSesion } from '@/sesion/SesionContext';
import { Colores, tema } from '@/tema';

function Puerta() {
  const { cargando } = useSesion();
  if (cargando) {
    return (
      <View style={{ flex: 1, backgroundColor: Colores.navy, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color="#fff" />
      </View>
    );
  }
  return <Slot />;
}

export default function Raiz() {
  return (
    <SafeAreaProvider>
      <PaperProvider theme={tema}>
        <SesionProvider>
          <SincronizacionProvider>
            <DialogosProvider>
              <StatusBar style="light" />
              <Puerta />
            </DialogosProvider>
          </SincronizacionProvider>
        </SesionProvider>
      </PaperProvider>
    </SafeAreaProvider>
  );
}
