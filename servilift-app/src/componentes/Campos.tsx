// Campos de formulario reutilizables: selector de opciones, fecha (calendario) y hora (reloj).
// Los tres son un botón con aspecto de campo: cualquier parte (texto, ícono o borde) abre su ventana.
// (No se usa un campo de texto bloqueado porque en el navegador el ícono y el texto capturaban el clic.)
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { ComponentProps, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { Button, Dialog, Portal, RadioButton, Searchbar, Text } from 'react-native-paper';

import { Colores, fechaApi } from '@/tema';
import { Calendario } from './Calendario';
import { Reloj } from './Reloj';

export interface Opcion<T extends string | number = string> {
  valor: T;
  texto: string;
}

/** Botón con aspecto de campo de formulario (borde, etiqueta flotante e ícono a la derecha). */
export function CampoBoton({ etiqueta, texto, icono, onPress, deshabilitado, error }: {
  etiqueta: string;
  texto: string;
  icono: ComponentProps<typeof MaterialCommunityIcons>['name'];
  onPress: () => void;
  deshabilitado?: boolean;
  error?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={deshabilitado}
      accessibilityRole="button"
      accessibilityLabel={`${etiqueta}: ${texto || 'sin seleccionar'}`}
      style={{ paddingTop: 6 }}
    >
      {(estado) => {
        const encima = (estado as { hovered?: boolean }).hovered && !deshabilitado;
        const borde = error ? Colores.error : encima ? Colores.acento : '#79747E';
        return (
          <View>
            <View style={{
              minHeight: 42, flexDirection: 'row', alignItems: 'center', paddingLeft: 14, paddingRight: 8,
              borderWidth: encima || error ? 2 : 1, borderColor: borde, borderRadius: 10, backgroundColor: '#fff',
              opacity: deshabilitado ? 0.55 : 1,
            }}>
              <Text numberOfLines={1} style={{ flex: 1, fontSize: 16, color: texto ? Colores.navy : Colores.gris }}>
                {texto || etiqueta}
              </Text>
              <MaterialCommunityIcons name={icono} size={22} color={Colores.gris} />
            </View>
            {!!texto && (
              <Text numberOfLines={1} style={{ position: 'absolute', top: -7, left: 10, right: 30, alignSelf: 'flex-start' }}>
                <Text style={{ fontSize: 12, color: error ? Colores.error : Colores.gris, backgroundColor: '#fff' }}> {etiqueta} </Text>
              </Text>
            )}
          </View>
        );
      }}
    </Pressable>
  );
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
  const texto = elegida?.texto ?? (permitirVacio && (valor === null || valor === undefined) ? textoVacio : '');
  return (
    <View style={style}>
      <CampoBoton etiqueta={etiqueta} texto={texto} icono="menu-down" deshabilitado={deshabilitado} onPress={() => setAbierto(true)} />
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

/** Fechas en pantalla (dd/mm/aaaa) y para el API (aaaa-mm-dd). "NI" o vacío = no informa / no aplica. */
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
  hoy(): string {
    return fechaApi(new Date());
  },
};

/** Campo de fecha: abre el calendario. `valor` y `onCambiar` usan dd/mm/aaaa ('' = NI).
 *  minimo / maximo en aaaa-mm-dd (ej. minimo = hoy para no programar en días pasados). */
export function CampoFecha({ etiqueta, valor, onCambiar, deshabilitado, minimo, maximo, permitirNI = true, style }: {
  etiqueta: string;
  valor: string;
  onCambiar: (texto: string) => void;
  deshabilitado?: boolean;
  minimo?: string;
  maximo?: string;
  permitirNI?: boolean;
  style?: any;
}) {
  const [abierto, setAbierto] = useState(false);
  let iso: string | null = null;
  try {
    iso = Fechas.paraApi(valor);
  } catch {
    iso = null;
  }
  const fueraDeRango = !!iso && ((!!minimo && iso < minimo) || (!!maximo && iso > maximo));
  return (
    <View style={style}>
      <CampoBoton etiqueta={etiqueta} texto={iso ? Fechas.mostrar(iso) : permitirNI ? 'NI' : ''}
        icono="calendar-month" deshabilitado={deshabilitado} error={fueraDeRango} onPress={() => setAbierto(true)} />
      {fueraDeRango && (
        <Text style={{ color: Colores.error, fontSize: 12 }}>
          {minimo && iso! < minimo ? 'No se pueden elegir días pasados' : 'La fecha no puede ser posterior a hoy'}
        </Text>
      )}
      <Calendario
        visible={abierto}
        titulo={etiqueta}
        valor={iso}
        minimo={minimo}
        maximo={maximo}
        permitirNI={permitirNI}
        onCerrar={() => setAbierto(false)}
        onElegir={(nuevo) => {
          setAbierto(false);
          onCambiar(nuevo ? Fechas.mostrar(nuevo) : '');
        }}
      />
    </View>
  );
}

/** Campo de hora: abre el reloj. `valor` y `onCambiar` usan HH:MM ('' = sin hora). */
export function CampoHora({ etiqueta, valor, onCambiar, deshabilitado, permitirVacio, style }: {
  etiqueta: string;
  valor: string;
  onCambiar: (hhmm: string) => void;
  deshabilitado?: boolean;
  /** muestra "Quitar" para dejar el campo vacío (hora opcional) */
  permitirVacio?: boolean;
  style?: any;
}) {
  const [abierto, setAbierto] = useState(false);
  return (
    <View style={style}>
      <CampoBoton etiqueta={etiqueta} texto={valor} icono="clock-outline" deshabilitado={deshabilitado} onPress={() => setAbierto(true)} />
      {permitirVacio && !!valor && !deshabilitado && (
        <View style={{ flexDirection: 'row', justifyContent: 'flex-end' }}>
          <Button compact onPress={() => onCambiar('')}>Quitar</Button>
        </View>
      )}
      <Reloj
        visible={abierto}
        titulo={etiqueta}
        valor={valor || null}
        onCerrar={() => setAbierto(false)}
        onElegir={(hhmm) => {
          setAbierto(false);
          onCambiar(hhmm);
        }}
      />
    </View>
  );
}
