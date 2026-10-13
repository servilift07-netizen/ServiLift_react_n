// Imagen ampliable: rueda del ratón para acercar/alejar (hacia donde apunta el cursor), arrastrar para moverla,
// doble clic para volver al tamaño normal. En el celular: pellizcar con dos dedos y arrastrar con uno.
import { useEffect, useRef, useState } from 'react';
import { GestureResponderEvent, Image, PanResponder, Platform, View } from 'react-native';
import { Button, Dialog, Portal, Text } from 'react-native-paper';

import { Icon } from './Comunes';

const MIN = 1;
const MAX = 6;

type Vista = { escala: number; x: number; y: number };
const NORMAL: Vista = { escala: 1, x: 0, y: 0 };

/** Limita el desplazamiento para que la imagen no se salga del recuadro */
function ajustar(v: Vista, ancho: number, alto: number): Vista {
  const escala = Math.min(MAX, Math.max(MIN, v.escala));
  const mx = (ancho * (escala - 1)) / 2;
  const my = (alto * (escala - 1)) / 2;
  return { escala, x: Math.min(mx, Math.max(-mx, v.x)), y: Math.min(my, Math.max(-my, v.y)) };
}

/** Acerca o aleja manteniendo fijo el punto (px, py) medido desde el centro del recuadro */
function zoomEn(v: Vista, nuevaEscala: number, px: number, py: number): Vista {
  const f = nuevaEscala / v.escala;
  return { escala: nuevaEscala, x: px - (px - v.x) * f, y: py - (py - v.y) * f };
}

const distancia = (e: GestureResponderEvent) => {
  const [a, b] = e.nativeEvent.touches;
  return a && b ? Math.hypot(a.pageX - b.pageX, a.pageY - b.pageY) : 0;
};

export function ImagenZoom({ uri, alto = 360 }: { uri: string; alto?: number }) {
  const [vista, setVista] = useState<Vista>(NORMAL);
  const [ancho, setAncho] = useState(0);
  const caja = useRef<View>(null);
  const actual = useRef(vista);
  actual.current = vista;
  const medidas = useRef({ ancho: 0, alto });
  medidas.current = { ancho, alto };
  const gesto = useRef<{ inicio: Vista; dist: number } | null>(null);

  useEffect(() => setVista(NORMAL), [uri]);

  // Rueda del ratón (solo web): se escucha sobre el elemento para poder evitar que la página se desplace
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const nodo = caja.current as unknown as HTMLElement | null;
    if (!nodo?.addEventListener) return;
    const rueda = (e: WheelEvent) => {
      e.preventDefault();
      const r = nodo.getBoundingClientRect();
      const px = e.clientX - r.left - r.width / 2;
      const py = e.clientY - r.top - r.height / 2;
      const v = actual.current;
      const nueva = Math.min(MAX, Math.max(MIN, v.escala * Math.exp(-e.deltaY * 0.0015)));
      setVista(ajustar(zoomEn(v, nueva, px, py), r.width, r.height));
    };
    const normal = () => setVista(NORMAL);
    const sinArrastreNativo = (e: Event) => e.preventDefault();
    nodo.addEventListener('wheel', rueda, { passive: false });
    nodo.addEventListener('dblclick', normal);
    nodo.addEventListener('dragstart', sinArrastreNativo);
    return () => {
      nodo.removeEventListener('wheel', rueda);
      nodo.removeEventListener('dblclick', normal);
      nodo.removeEventListener('dragstart', sinArrastreNativo);
    };
  }, []);

  const arrastre = useRef(PanResponder.create({
    onStartShouldSetPanResponder: (e) => actual.current.escala > 1 || e.nativeEvent.touches.length === 2,
    onMoveShouldSetPanResponder: (e) => actual.current.escala > 1 || e.nativeEvent.touches.length === 2,
    onPanResponderGrant: (e) => { gesto.current = { inicio: actual.current, dist: distancia(e) }; },
    onPanResponderMove: (e, g) => {
      const ini = gesto.current;
      if (!ini) return;
      const { ancho: w, alto: h } = medidas.current;
      const d = distancia(e);
      if (d && ini.dist) {
        setVista(ajustar({ ...ini.inicio, escala: ini.inicio.escala * (d / ini.dist) }, w, h));
      } else {
        setVista(ajustar({ ...ini.inicio, x: ini.inicio.x + g.dx, y: ini.inicio.y + g.dy }, w, h));
      }
    },
    onPanResponderRelease: () => { gesto.current = null; },
  })).current;

  const paso = (factor: number) => setVista((v) => ajustar({ ...v, escala: v.escala * factor }, ancho, alto));
  const ampliada = vista.escala > 1.01;

  return (
    <View>
      <View ref={caja} onLayout={(e) => setAncho(e.nativeEvent.layout.width)} {...arrastre.panHandlers}
        style={{ height: alto, backgroundColor: '#000', overflow: 'hidden',
          ...(Platform.OS === 'web' ? { cursor: ampliada ? 'grab' : 'zoom-in' } as object : {}) }}>
        <Image source={{ uri }} resizeMode="contain" style={{ width: '100%', height: '100%',
          transform: [{ translateX: vista.x }, { translateY: vista.y }, { scale: vista.escala }] }} />
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 }}>
        <Button compact icon="magnify-minus-outline" disabled={!ampliada} onPress={() => paso(1 / 1.5)}>{''}</Button>
        <Text style={{ fontSize: 12, minWidth: 44, textAlign: 'center' }}>{Math.round(vista.escala * 100)}%</Text>
        <Button compact icon="magnify-plus-outline" disabled={vista.escala >= MAX} onPress={() => paso(1.5)}>{''}</Button>
        {ampliada && <Button compact onPress={() => setVista(NORMAL)}>Ajustar</Button>}
        <View style={{ flex: 1, flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center', gap: 4 }}>
          <Icon nombre={Platform.OS === 'web' ? 'mouse' : 'gesture-pinch'} tam={14} />
          <Text style={{ fontSize: 11 }}>{Platform.OS === 'web' ? 'Rueda: zoom · arrastre: mover' : 'Pellizque para ampliar'}</Text>
        </View>
      </View>
    </View>
  );
}

/** Diálogo para ver una foto en grande con zoom */
export function VisorImagen({ uri, titulo, onCerrar }: { uri: string | null; titulo?: string; onCerrar: () => void }) {
  if (!uri) return null;
  return (
    <Portal>
      <Dialog visible onDismiss={onCerrar} style={{ maxWidth: 900, width: '96%', alignSelf: 'center' }}>
        {!!titulo && <Dialog.Title style={{ fontSize: 16 }}>{titulo}</Dialog.Title>}
        <Dialog.Content><ImagenZoom uri={uri} alto={420} /></Dialog.Content>
        <Dialog.Actions><Button onPress={onCerrar}>Cerrar</Button></Dialog.Actions>
      </Dialog>
    </Portal>
  );
}
