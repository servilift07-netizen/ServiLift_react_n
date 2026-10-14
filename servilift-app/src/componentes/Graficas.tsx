// Gráficas del tablero de inicio (barras, columnas por mes y dona), dibujadas sin librerías externas.
import { View } from 'react-native';
import { Text } from 'react-native-paper';
import Svg, { Circle, G } from 'react-native-svg';

import { Colores, colorNombre } from '@/tema';

export interface DatoGrafica {
  etiqueta: string;
  valor: number;
  color?: string;
}

export function Barras({ datos }: { datos: DatoGrafica[] }) {
  const max = Math.max(0, ...datos.map((d) => d.valor));
  return (
    <View style={{ gap: 6 }}>
      {datos.map((d, i) => (
        <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Text style={{ width: 150, fontSize: 12 }} numberOfLines={2}>{d.etiqueta}</Text>
          <View style={{ flex: 1 }}>
            <View style={{ height: 16, borderRadius: 4, width: `${max ? (100 * d.valor) / max : 0}%`,
              backgroundColor: colorNombre(d.color, i) }} />
          </View>
          <Text style={{ width: 32, textAlign: 'right', fontWeight: '700' }}>{d.valor}</Text>
        </View>
      ))}
    </View>
  );
}

export function Columnas({ datos }: { datos: DatoGrafica[] }) {
  const max = Math.max(0, ...datos.map((d) => d.valor));
  return (
    <View style={{ height: 170, flexDirection: 'row', alignItems: 'flex-end' }}>
      {datos.map((d, i) => (
        <View key={i} style={{ flex: 1, alignItems: 'center', justifyContent: 'flex-end', paddingHorizontal: 3 }}>
          <Text style={{ fontSize: 11, fontWeight: '700' }}>{d.valor}</Text>
          <View style={{ width: '80%', height: max ? (120 * d.valor) / max : 0, backgroundColor: colorNombre(d.color, 0),
            borderTopLeftRadius: 4, borderTopRightRadius: 4 }} />
          <Text style={{ fontSize: 10, color: Colores.gris, marginTop: 4 }} numberOfLines={1}>{d.etiqueta}</Text>
        </View>
      ))}
    </View>
  );
}

export function Dona({ datos }: { datos: DatoGrafica[] }) {
  const total = datos.reduce((a, d) => a + d.valor, 0);
  const r = 60;
  const c = 2 * Math.PI * r;
  let acumulado = 0;
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 20 }}>
      <View style={{ width: 150, height: 150, alignItems: 'center', justifyContent: 'center' }}>
        <Svg width={150} height={150} style={{ position: 'absolute' }}>
          {/* El giro va como transform SVG: rotation/origin en la web genera el atributo inválido transform-origin */}
          <G transform="rotate(-90 75 75)">
            {datos.map((d, i) => {
              const largo = total ? (c * d.valor) / total : 0;
              const arco = (
                <Circle key={i} cx={75} cy={75} r={r} stroke={colorNombre(d.color, i)} strokeWidth={24} fill="none"
                  strokeDasharray={`${largo} ${c - largo}`} strokeDashoffset={-acumulado} />
              );
              acumulado += largo;
              return arco;
            })}
          </G>
        </Svg>
        <Text style={{ fontSize: 24, fontWeight: '800' }}>{total}</Text>
        <Text style={{ fontSize: 11, color: Colores.gris }}>total</Text>
      </View>
      <View style={{ gap: 4 }}>
        {datos.map((d, i) => (
          <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <View style={{ width: 12, height: 12, borderRadius: 3, backgroundColor: colorNombre(d.color, i) }} />
            <Text style={{ fontSize: 12 }}>{d.etiqueta}: {d.valor}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}
