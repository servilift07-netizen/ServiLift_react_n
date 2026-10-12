// Campos de formulario reutilizables: selector de opciones y fecha con opción "NI".
import { useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { Button, Dialog, Portal, RadioButton, Searchbar, Text, TextInput } from 'react-native-paper';

import { fechaApi } from '@/tema';

export interface Opcion<T extends string | number = string> {
  valor: T;
  texto: string;
}

/** Campo que abre una lista para elegir (funciona igual en celular y navegador). */
export function Selector<T extends string | number>({
  etiqueta, valor, opciones, onCambiar, deshabilitado, permitirVacio, textoVacio = 'Todos', style,
}: {
  etiqueta: string;
  valor: T | null | undefined;
  opciones: Opcion<T>[];
  onCambiar: (v: T | null) => void;
  deshabilitado?: boolean;
  permitirVacio?: boolean;
  textoVacio?: string;
  style?: any;
}) {
  const [abierto, setAbierto] = useState(false);
  const [buscar, setBuscar] = useState('');
  const elegida = opciones.find((o) => o.valor === valor);
  const filtradas = buscar ? opciones.filter((o) => o.texto.toLowerCase().includes(buscar.toLowerCase())) : opciones;
  return (
    <View style={style}>
      <Pressable onPress={() => !deshabilitado && setAbierto(true)}>
        <View pointerEvents="none">
          <TextInput
            mode="outlined"
            dense
            label={etiqueta}
            value={elegida?.texto ?? (permitirVacio && (valor === null || valor === undefined) ? textoVacio : '')}
            editable={false}
            disabled={deshabilitado}
            right={<TextInput.Icon icon="menu-down" />}
          />
        </View>
      </Pressable>
      <Portal>
        <Dialog visible={abierto} onDismiss={() => setAbierto(false)} style={{ maxWidth: 520, width: '92%', alignSelf: 'center' }}>
          <Dialog.Title>{etiqueta}</Dialog.Title>
          {opciones.length > 8 && (
            <View style={{ paddingHorizontal: 16 }}>
              <Searchbar placeholder="Buscar" value={buscar} onChangeText={setBuscar} style={{ marginBottom: 8 }} />
            </View>
          )}
          <Dialog.ScrollArea style={{ maxHeight: 420, paddingHorizontal: 0 }}>
            <ScrollView>
              <RadioButton.Group
                value={valor === null || valor === undefined ? '__vacio__' : String(valor)}
                onValueChange={(v) => {
                  onCambiar(v === '__vacio__' ? null : (opciones.find((o) => String(o.valor) === v)?.valor ?? null));
                  setAbierto(false);
                  setBuscar('');
                }}
              >
                {permitirVacio && <RadioButton.Item label={textoVacio} value="__vacio__" />}
                {filtradas.map((o) => (
                  <RadioButton.Item key={String(o.valor)} label={o.texto} value={String(o.valor)} labelStyle={{ fontSize: 14 }} />
                ))}
              </RadioButton.Group>
            </ScrollView>
          </Dialog.ScrollArea>
          <Dialog.Actions>
            <Button onPress={() => setAbierto(false)}>Cerrar</Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
    </View>
  );
}

/** Fechas: el usuario escribe dd/mm/aaaa (o usa "Hoy"); "NI" deja el campo vacío (no informa / no aplica). */
export const Fechas = {
  /** ISO (aaaa-mm-dd...) -> dd/mm/aaaa */
  mostrar(iso?: string | null): string {
    const m = iso ? /^(\d{4})-(\d{2})-(\d{2})/.exec(iso) : null;
    return m ? `${m[3]}/${m[2]}/${m[1]}` : '';
  },
  /** '' / NI / N/A -> null. Acepta dd/mm/aaaa o aaaa-mm-dd. Lanza Error si no es válida. */
  paraApi(texto: string): string | null {
    const t = texto.trim().toUpperCase();
    if (!t || ['NI', 'N/A', 'NA', 'NO APLICA'].includes(t)) return null;
    let m = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(t);
    let a: number, mes: number, d: number;
    if (m) [a, mes, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
    else {
      m = /^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/.exec(t);
      if (!m) throw new Error(`Fecha inválida: ${texto}`);
      [d, mes, a] = [Number(m[1]), Number(m[2]), Number(m[3])];
    }
    const f = new Date(a, mes - 1, d);
    if (a < 1900 || f.getMonth() !== mes - 1 || f.getDate() !== d) throw new Error(`Fecha inválida: ${texto}`);
    return fechaApi(f);
  },
};

export function CampoFecha({ etiqueta, valor, onCambiar, deshabilitado, style }: {
  etiqueta: string;
  valor: string;
  onCambiar: (texto: string) => void;
  deshabilitado?: boolean;
  style?: any;
}) {
  let invalida = false;
  try {
    Fechas.paraApi(valor);
  } catch {
    invalida = true;
  }
  return (
    <View style={style}>
      <TextInput
        mode="outlined"
        dense
        label={etiqueta}
        value={valor}
        placeholder="dd/mm/aaaa o NI"
        onChangeText={onCambiar}
        disabled={deshabilitado}
        error={invalida}
        keyboardType="numbers-and-punctuation"
        right={deshabilitado ? undefined : <TextInput.Icon icon="calendar-today" onPress={() => onCambiar(Fechas.mostrar(fechaApi(new Date())))} />}
      />
      {!deshabilitado && (
        <View style={{ flexDirection: 'row', justifyContent: 'flex-end' }}>
          <Button compact onPress={() => onCambiar('')}>NI</Button>
        </View>
      )}
      {invalida && <Text style={{ color: '#C0392B', fontSize: 12 }}>Use dd/mm/aaaa o deje NI</Text>}
    </View>
  );
}
