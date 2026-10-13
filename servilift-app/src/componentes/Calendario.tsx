// Calendario para elegir una fecha (igual en el celular y en el navegador).
// Respeta límites: por ejemplo, una visita no se puede programar en un día pasado.
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { Button, Dialog, IconButton, Portal, Text } from 'react-native-paper';

import { Colores, fechaApi } from '@/tema';

const MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre',
  'Noviembre', 'Diciembre'];
const DIAS = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];

/** 'AAAA-MM-DD' -> Date local (sin problemas de zona horaria) */
function aFecha(iso: string): Date {
  const [a, m, d] = iso.slice(0, 10).split('-').map(Number);
  return new Date(a, m - 1, d);
}

export function Calendario({ visible, valor, minimo, maximo, permitirNI, titulo = 'Elegir fecha', onElegir, onCerrar }: {
  visible: boolean;
  /** fecha elegida en formato AAAA-MM-DD (o null) */
  valor: string | null;
  minimo?: string;
  maximo?: string;
  /** muestra el botón "NI" (no informa / no aplica) */
  permitirNI?: boolean;
  titulo?: string;
  onElegir: (iso: string | null) => void;
  onCerrar: () => void;
}) {
  const hoy = fechaApi(new Date());
  const inicial = () => aFecha(valor ?? (minimo && hoy < minimo ? minimo : maximo && hoy > maximo ? maximo : hoy));
  const [mes, setMes] = useState(() => { const d = inicial(); return new Date(d.getFullYear(), d.getMonth(), 1); });
  const [verAnios, setVerAnios] = useState(false);

  useEffect(() => {
    if (visible) {
      const d = inicial();
      setMes(new Date(d.getFullYear(), d.getMonth(), 1));
      setVerAnios(false);
    }
  }, [visible]); // eslint-disable-line react-hooks/exhaustive-deps

  const permitido = (iso: string) => (!minimo || iso >= minimo) && (!maximo || iso <= maximo);
  const mesAnterior = new Date(mes.getFullYear(), mes.getMonth() - 1, 1);
  const mesSiguiente = new Date(mes.getFullYear(), mes.getMonth() + 1, 1);
  const puedeAtras = !minimo || fechaApi(new Date(mes.getFullYear(), mes.getMonth(), 0)) >= minimo;
  const puedeAdelante = !maximo || fechaApi(mesSiguiente) <= maximo;

  // Celdas del mes (la semana empieza el lunes)
  const desfase = (mes.getDay() + 6) % 7;
  const diasMes = new Date(mes.getFullYear(), mes.getMonth() + 1, 0).getDate();
  const celdas: (string | null)[] = [...Array(desfase).fill(null),
    ...Array.from({ length: diasMes }, (_, i) => fechaApi(new Date(mes.getFullYear(), mes.getMonth(), i + 1)))];
  while (celdas.length % 7) celdas.push(null);

  const anioMin = minimo ? aFecha(minimo).getFullYear() : 1950;
  const anioMax = maximo ? aFecha(maximo).getFullYear() : new Date().getFullYear() + 5;
  const anios = Array.from({ length: anioMax - anioMin + 1 }, (_, i) => anioMax - i);

  return (
    <Portal>
      <Dialog visible={visible} onDismiss={onCerrar} style={{ maxWidth: 380, width: '94%', alignSelf: 'center' }}>
        <Dialog.Title style={{ fontSize: 18 }}>{titulo}</Dialog.Title>
        <Dialog.Content>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <IconButton icon="chevron-left" disabled={!puedeAtras || verAnios} onPress={() => setMes(mesAnterior)}
              accessibilityLabel="Mes anterior" />
            <Pressable onPress={() => setVerAnios(!verAnios)} style={{ flex: 1, alignItems: 'center' }} accessibilityRole="button"
              accessibilityLabel="Cambiar año">
              <Text style={{ fontWeight: '700', fontSize: 16 }}>{MESES[mes.getMonth()]} {mes.getFullYear()} ▾</Text>
            </Pressable>
            <IconButton icon="chevron-right" disabled={!puedeAdelante || verAnios} onPress={() => setMes(mesSiguiente)}
              accessibilityLabel="Mes siguiente" />
          </View>
          {verAnios ? (
            <ScrollView style={{ maxHeight: 260 }} contentContainerStyle={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, justifyContent: 'center' }}>
              {anios.map((a) => (
                <Pressable key={a} onPress={() => { setMes(new Date(a, mes.getMonth(), 1)); setVerAnios(false); }}
                  style={{ width: 72, paddingVertical: 8, borderRadius: 16, alignItems: 'center',
                    backgroundColor: a === mes.getFullYear() ? Colores.acento : 'transparent' }}>
                  <Text style={{ color: a === mes.getFullYear() ? '#fff' : Colores.navy }}>{a}</Text>
                </Pressable>
              ))}
            </ScrollView>
          ) : (
            <View>
              <View style={{ flexDirection: 'row' }}>
                {DIAS.map((d, i) => <Text key={i} style={{ flex: 1, textAlign: 'center', color: Colores.gris, fontSize: 12 }}>{d}</Text>)}
              </View>
              {Array.from({ length: celdas.length / 7 }, (_, s) => (
                <View key={s} style={{ flexDirection: 'row' }}>
                  {celdas.slice(s * 7, s * 7 + 7).map((iso, i) => {
                    if (!iso) return <View key={i} style={{ flex: 1, height: 40 }} />;
                    const ok = permitido(iso);
                    const elegido = iso === valor;
                    return (
                      <Pressable key={i} disabled={!ok} onPress={() => onElegir(iso)} accessibilityRole="button"
                        accessibilityLabel={iso} style={{ flex: 1, height: 40, alignItems: 'center', justifyContent: 'center' }}>
                        <View style={{ width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center',
                          backgroundColor: elegido ? Colores.acento : 'transparent',
                          borderWidth: iso === hoy && !elegido ? 1 : 0, borderColor: Colores.acento }}>
                          <Text style={{ color: elegido ? '#fff' : ok ? Colores.navy : '#C3CAD3',
                            textDecorationLine: ok ? 'none' : 'line-through' }}>
                            {Number(iso.slice(8, 10))}
                          </Text>
                        </View>
                      </Pressable>
                    );
                  })}
                </View>
              ))}
            </View>
          )}
          {(minimo === hoy) && <Text style={{ fontSize: 12, color: Colores.gris, marginTop: 6 }}>No se pueden elegir días pasados.</Text>}
        </Dialog.Content>
        <Dialog.Actions>
          {permitirNI && <Button onPress={() => onElegir(null)}>NI</Button>}
          {permitido(hoy) && <Button onPress={() => onElegir(hoy)}>Hoy</Button>}
          <Button onPress={onCerrar}>Cancelar</Button>
        </Dialog.Actions>
      </Dialog>
    </Portal>
  );
}
