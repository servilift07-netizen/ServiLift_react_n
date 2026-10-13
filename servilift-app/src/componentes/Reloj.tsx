// Selector de hora tipo reloj (como el de la versión Flutter): primero la hora en la esfera
// (anillo exterior 1–12, interior 13–00) y luego los minutos (de 5 en 5).
import { useEffect, useState } from 'react';
import { Pressable, View } from 'react-native';
import { Button, Dialog, Portal, Text } from 'react-native-paper';
import Svg, { Circle, Line } from 'react-native-svg';

import { aclarar, Colores } from '@/tema';

const TAM = 260;
const CENTRO = TAM / 2;

function posicion(indice: number, radio: number) {
  const angulo = (indice / 12) * 2 * Math.PI - Math.PI / 2;
  return { x: CENTRO + radio * Math.cos(angulo), y: CENTRO + radio * Math.sin(angulo) };
}

const dos = (n: number) => String(n).padStart(2, '0');

export function Reloj({ visible, valor, titulo = 'Elegir hora', onElegir, onCerrar }: {
  visible: boolean;
  /** 'HH:MM' o null */
  valor: string | null;
  titulo?: string;
  onElegir: (hhmm: string) => void;
  onCerrar: () => void;
}) {
  const [hora, setHora] = useState(8);
  const [minuto, setMinuto] = useState(0);
  const [modo, setModo] = useState<'hora' | 'minuto'>('hora');

  useEffect(() => {
    if (!visible) return;
    const m = valor ? /^(\d{1,2}):(\d{2})/.exec(valor) : null;
    setHora(m ? Number(m[1]) : 8);
    setMinuto(m ? Number(m[2]) : 0);
    setModo('hora');
  }, [visible, valor]);

  // Números de la esfera según el modo
  const marcas = modo === 'hora'
    ? [...Array.from({ length: 12 }, (_, i) => ({ valor: i === 0 ? 12 : i, indice: i, radio: 104, chico: false })),
      ...Array.from({ length: 12 }, (_, i) => ({ valor: i === 0 ? 0 : i + 12, indice: i, radio: 68, chico: true }))]
    : Array.from({ length: 12 }, (_, i) => ({ valor: i * 5, indice: i, radio: 104, chico: false }));
  const actual = modo === 'hora' ? hora : minuto;
  const elegida = marcas.find((m) => m.valor === actual)
    ?? (modo === 'minuto' ? { indice: minuto / 5, radio: 104 } : null);
  const punta = elegida ? posicion(elegida.indice, elegida.radio) : null;

  const Cabecera = ({ texto, activo, onPress }: { texto: string; activo: boolean; onPress: () => void }) => (
    <Pressable onPress={onPress} accessibilityRole="button"
      style={{ paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10, backgroundColor: activo ? aclarar(Colores.acento, 0.15) : '#EEF1F5' }}>
      <Text style={{ fontSize: 40, fontWeight: '600', color: activo ? Colores.acento : Colores.navy }}>{texto}</Text>
    </Pressable>
  );

  return (
    <Portal>
      <Dialog visible={visible} onDismiss={onCerrar} style={{ maxWidth: 340, width: '94%', alignSelf: 'center' }}>
        <Dialog.Title style={{ fontSize: 18 }}>{titulo}</Dialog.Title>
        <Dialog.Content style={{ alignItems: 'center', gap: 12 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Cabecera texto={dos(hora)} activo={modo === 'hora'} onPress={() => setModo('hora')} />
            <Text style={{ fontSize: 40, fontWeight: '600' }}>:</Text>
            <Cabecera texto={dos(minuto)} activo={modo === 'minuto'} onPress={() => setModo('minuto')} />
          </View>
          <View style={{ width: TAM, height: TAM }}>
            <Svg width={TAM} height={TAM} style={{ position: 'absolute' }}>
              <Circle cx={CENTRO} cy={CENTRO} r={CENTRO - 2} fill="#EEF1F5" />
              {punta && <Line x1={CENTRO} y1={CENTRO} x2={punta.x} y2={punta.y} stroke={Colores.acento} strokeWidth={2} />}
              <Circle cx={CENTRO} cy={CENTRO} r={4} fill={Colores.acento} />
            </Svg>
            {marcas.map((m) => {
              const p = posicion(m.indice, m.radio);
              const activo = m.valor === actual;
              const lado = m.chico ? 30 : 36;
              return (
                <Pressable
                  key={`${modo}-${m.valor}`}
                  accessibilityRole="button"
                  accessibilityLabel={modo === 'hora' ? `${m.valor} horas` : `${m.valor} minutos`}
                  onPress={() => {
                    if (modo === 'hora') {
                      setHora(m.valor);
                      setModo('minuto');
                    } else setMinuto(m.valor);
                  }}
                  style={{ position: 'absolute', left: p.x - lado / 2, top: p.y - lado / 2, width: lado, height: lado,
                    borderRadius: lado / 2, alignItems: 'center', justifyContent: 'center',
                    backgroundColor: activo ? Colores.acento : 'transparent' }}
                >
                  <Text style={{ fontSize: m.chico ? 12 : 15, color: activo ? '#fff' : m.chico ? Colores.gris : Colores.navy }}>
                    {modo === 'minuto' ? dos(m.valor) : m.chico ? dos(m.valor) : m.valor}
                  </Text>
                </Pressable>
              );
            })}
          </View>
          <Text style={{ fontSize: 12, color: Colores.gris }}>
            {modo === 'hora' ? 'Elija la hora (anillo interior: 13 a 00)' : 'Elija los minutos'}
          </Text>
        </Dialog.Content>
        <Dialog.Actions>
          <Button onPress={onCerrar}>Cancelar</Button>
          <Button mode="contained" onPress={() => onElegir(`${dos(hora)}:${dos(minuto)}`)}>Aceptar</Button>
        </Dialog.Actions>
      </Dialog>
    </Portal>
  );
}
