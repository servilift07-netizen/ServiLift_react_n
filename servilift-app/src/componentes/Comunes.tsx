import { MaterialCommunityIcons } from '@expo/vector-icons';
import { ReactNode } from 'react';
import { ScrollView, ScrollViewProps, StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import { ActivityIndicator, Button, Card, Text } from 'react-native-paper';

import { aclarar, Colores, colorEstado, etiqueta, fechaHoraLocal } from '@/tema';

export type Icono = keyof typeof MaterialCommunityIcons.glyphMap;

export function Icon({ nombre, tam = 22, color = Colores.gris }: { nombre: Icono; tam?: number; color?: string }) {
  return <MaterialCommunityIcons name={nombre} size={tam} color={color} />;
}

/** Etiqueta de color para un estado del backend. */
export function EstadoChip({ estado, texto }: { estado?: string | null; texto?: string | null }) {
  const c = colorEstado(estado);
  return (
    <View style={[s.chip, { backgroundColor: aclarar(c) }]}>
      <Text style={[s.chipTexto, { color: c }]} numberOfLines={2}>{texto ?? etiqueta(estado)}</Text>
    </View>
  );
}

export function Vacio({ texto, icono = 'inbox-outline' }: { texto: string; icono?: Icono }) {
  return (
    <View style={s.centro}>
      <Icon nombre={icono} tam={56} color={aclarar(Colores.gris, 0.6)} />
      <Text style={s.gris}>{texto}</Text>
    </View>
  );
}

export function Titulo({ texto, accion }: { texto: string; accion?: ReactNode }) {
  return (
    <View style={s.titulo}>
      <Text variant="titleMedium" style={{ flex: 1, fontWeight: '700' }}>{texto}</Text>
      {accion}
    </View>
  );
}

/** Contenedor con ancho máximo para que en el computador no se estire todo. */
export function Contenido({ children, ancho = 1100, style, ...props }: ScrollViewProps & { ancho?: number; children: ReactNode }) {
  return (
    <ScrollView {...props} style={[{ flex: 1 }, style]} contentContainerStyle={[s.contenido, props.contentContainerStyle]}>
      <View style={{ width: '100%', maxWidth: ancho, alignSelf: 'center' }}>{children}</View>
    </ScrollView>
  );
}

/** Fila etiqueta: valor */
export function Dato({ etiqueta: e, valor }: { etiqueta: string; valor?: string | number | null }) {
  const v = valor === null || valor === undefined || `${valor}`.trim() === '' ? '-' : `${valor}`;
  return (
    <View style={s.dato}>
      <Text style={[s.gris, { width: 150, fontSize: 13 }]}>{e}</Text>
      <Text style={{ flex: 1, fontSize: 13 }}>{v}</Text>
    </View>
  );
}

export function Tarjeta({ children, style, onPress }: { children: ReactNode; style?: StyleProp<ViewStyle>; onPress?: () => void }) {
  return (
    <Card mode="outlined" style={[s.tarjeta, style]} onPress={onPress}>
      <Card.Content style={{ paddingVertical: 12 }}>{children}</Card.Content>
    </Card>
  );
}

export function Fila({ children, style, espacio = 8 }: { children: ReactNode; style?: StyleProp<ViewStyle>; espacio?: number }) {
  return <View style={[{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: espacio }, style]}>{children}</View>;
}

/** Pantalla de carga / error con botón de reintentar. */
export function EstadoCarga({ error, onReintentar }: { error?: string | null; onReintentar?: () => void }) {
  if (!error) return <View style={s.centro}><ActivityIndicator /></View>;
  return (
    <View style={s.centro}>
      <Icon nombre="cloud-off-outline" tam={48} />
      <Text style={{ textAlign: 'center', marginVertical: 8 }}>{error}</Text>
      {onReintentar && <Button mode="outlined" icon="refresh" onPress={onReintentar}>Reintentar</Button>}
    </View>
  );
}

/** Aviso de que lo que se ve está guardado en el teléfono (no se pudo actualizar). */
export function AvisoCache({ visible, guardadoEn }: { visible: boolean; guardadoEn?: string | null }) {
  if (!visible) return null;
  return (
    <View style={s.avisoCache}>
      <Icon nombre="cellphone-arrow-down" tam={16} color={Colores.alerta} />
      <Text style={{ color: Colores.alerta, fontSize: 12, flex: 1 }}>
        Sin conexión: mostrando lo guardado en el teléfono{guardadoEn ? ` (${fechaHoraLocal(guardadoEn)})` : ''}
      </Text>
    </View>
  );
}

export function Cifra({ titulo, valor, color }: { titulo: string; valor: ReactNode; color: string }) {
  return (
    <View style={[s.cifra, { backgroundColor: aclarar(color, 0.08) }]}>
      <Text style={{ fontSize: 24, fontWeight: '800', color }}>{valor}</Text>
      <Text style={{ color }}>{titulo}</Text>
    </View>
  );
}

export const s = StyleSheet.create({
  chip: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20, alignSelf: 'flex-start', maxWidth: 260 },
  chipTexto: { fontWeight: '600', fontSize: 12 },
  centro: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 8, minHeight: 200 },
  gris: { color: Colores.gris },
  titulo: { flexDirection: 'row', alignItems: 'center', paddingTop: 16, paddingBottom: 6, paddingHorizontal: 4, gap: 8 },
  contenido: { padding: 12, paddingBottom: 96 },
  dato: { flexDirection: 'row', paddingVertical: 3 },
  tarjeta: { marginVertical: 5, backgroundColor: Colores.blanco, borderColor: Colores.borde },
  avisoCache: { flexDirection: 'row', gap: 6, alignItems: 'center', backgroundColor: '#FFF4E5', padding: 8 },
  cifra: { width: 120, padding: 12, borderRadius: 10, alignItems: 'center' },
});
