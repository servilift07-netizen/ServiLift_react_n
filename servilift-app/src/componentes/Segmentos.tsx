// Botones segmentados y barra de progreso propios: el texto siempre cabe (se reduce si hace falta)
// y se ven igual en el celular y en el navegador.
import { Pressable, StyleProp, Text, View, ViewStyle } from 'react-native';

import { Colores } from '@/tema';

export interface Segmento {
  valor: string;
  texto: string;
  /** color de fondo cuando está elegido */
  fondo?: string;
}

export function Segmentos({ valor, opciones, onCambiar, deshabilitado, style, alto = 40 }: {
  valor: string;
  opciones: Segmento[];
  onCambiar: (v: string) => void;
  deshabilitado?: boolean;
  style?: StyleProp<ViewStyle>;
  alto?: number;
}) {
  return (
    <View style={[{ flexDirection: 'row', borderWidth: 1, borderColor: '#79747E', borderRadius: alto / 2, overflow: 'hidden' }, style]}>
      {opciones.map((o, i) => {
        const activo = o.valor === valor;
        return (
          <Pressable
            key={o.valor}
            disabled={deshabilitado}
            onPress={() => onCambiar(o.valor)}
            accessibilityRole="button"
            accessibilityState={{ selected: activo, disabled: deshabilitado }}
            style={{
              flex: 1, height: alto, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4,
              borderLeftWidth: i ? 1 : 0, borderLeftColor: '#79747E',
              backgroundColor: activo ? o.fondo ?? '#E8DEF8' : '#fff', opacity: deshabilitado && !activo ? 0.6 : 1,
            }}
          >
            <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75}
              style={{ fontSize: 14, color: Colores.navy, fontWeight: activo ? '700' : '400' }}>
              {o.texto}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function BarraProgreso({ valor, color = Colores.acento }: { valor: number; color?: string }) {
  return (
    <View style={{ height: 4, borderRadius: 2, backgroundColor: Colores.borde, overflow: 'hidden' }}>
      <View style={{ height: 4, width: `${Math.max(0, Math.min(1, valor)) * 100}%`, backgroundColor: color }} />
    </View>
  );
}
