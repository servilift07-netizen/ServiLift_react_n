// Lienzo de firma: dibuja con el dedo (celular) o el mouse (navegador) y entrega los trazos.
// El servidor convierte los trazos en la imagen PNG de la firma.
import { forwardRef, useImperativeHandle, useMemo, useRef, useState } from 'react';
import { LayoutChangeEvent, PanResponder, StyleSheet, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { Colores } from '@/tema';

export interface Dibujo {
  ancho: number;
  alto: number;
  trazos: [number, number][][];
}

export interface LienzoFirmaRef {
  borrar: () => void;
  vacio: () => boolean;
  dibujo: () => Dibujo;
}

function camino(t: [number, number][]): string {
  if (t.length === 1) return `M${t[0][0]},${t[0][1]} l0.1,0.1`;
  return t.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
}

export const LienzoFirma = forwardRef<LienzoFirmaRef, { alto?: number }>(({ alto = 200 }, ref) => {
  const [trazos, setTrazos] = useState<[number, number][][]>([]);
  const actual = useRef<[number, number][]>([]);
  const tam = useRef({ ancho: 300, alto });
  const [, refrescar] = useState(0);

  const respuesta = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,
    onPanResponderTerminationRequest: () => false,
    onPanResponderGrant: (e) => {
      actual.current = [[e.nativeEvent.locationX, e.nativeEvent.locationY]];
      refrescar((n) => n + 1);
    },
    onPanResponderMove: (e) => {
      const { locationX: x, locationY: y } = e.nativeEvent;
      const ult = actual.current[actual.current.length - 1];
      if (!ult || Math.abs(ult[0] - x) + Math.abs(ult[1] - y) > 1.5) {
        actual.current.push([x, y]);
        refrescar((n) => n + 1);
      }
    },
    onPanResponderRelease: () => {
      const t = actual.current;
      actual.current = [];
      if (t.length) setTrazos((prev) => [...prev, t]);
    },
  }), []);

  useImperativeHandle(ref, () => ({
    borrar: () => setTrazos([]),
    vacio: () => trazos.length === 0,
    dibujo: () => ({
      ancho: tam.current.ancho,
      alto: tam.current.alto,
      trazos: trazos.map((t) => t.map(([x, y]) => [Math.round(x * 10) / 10, Math.round(y * 10) / 10] as [number, number])),
    }),
  }), [trazos]);

  const alCambiarTam = (e: LayoutChangeEvent) => {
    tam.current = { ancho: e.nativeEvent.layout.width, alto: e.nativeEvent.layout.height };
  };

  return (
    <View style={[st.marco, { height: alto }]} onLayout={alCambiarTam} {...respuesta.panHandlers}>
      <Svg width="100%" height="100%" pointerEvents="none">
        {[...trazos, actual.current].filter((t) => t.length).map((t, i) => (
          <Path key={i} d={camino(t)} stroke="#000" strokeWidth={2.5} fill="none" strokeLinecap="round" strokeLinejoin="round" />
        ))}
      </Svg>
    </View>
  );
});

LienzoFirma.displayName = 'LienzoFirma';

const st = StyleSheet.create({
  marco: { borderWidth: 1, borderColor: Colores.borde, borderRadius: 8, backgroundColor: '#fff', overflow: 'hidden' },
});
