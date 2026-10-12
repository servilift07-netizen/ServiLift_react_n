// Diálogos y mensajes de toda la app con una API de promesas:
//   const d = useDialogos();
//   if (await d.confirmar('Título', 'Texto')) ...
//   const texto = await d.pedirTexto('Título', { etiqueta: 'Motivo' });
//   const r = await d.formulario({ titulo, campos, guardar });
//   const dibujo = await d.firma('Firma del inspector');
//   await d.ejecutar(() => Api.post(...), { exito: 'Guardado' });
import { createContext, ReactNode, useCallback, useContext, useMemo, useRef, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { ActivityIndicator, Button, Dialog, Portal, Snackbar, Text, TextInput } from 'react-native-paper';

import { ApiError } from '@/api/cliente';
import { Colores } from '@/tema';
import { Opcion, Selector } from './Campos';
import { Dibujo, LienzoFirma, LienzoFirmaRef } from './LienzoFirma';

export interface Campo {
  clave: string;
  etiqueta: string;
  obligatorio?: boolean;
  numero?: boolean;
  decimal?: boolean;
  opciones?: Opcion<string>[];
  inicial?: string;
  oculto?: boolean;
  multilinea?: boolean;
}

interface FormularioOpciones {
  titulo: string;
  campos: Campo[];
  valores?: Record<string, any>;
  guardar: (datos: Record<string, any>) => Promise<any>;
  textoGuardar?: string;
}

type Activo =
  | { tipo: 'confirmar'; titulo: string; texto: string; si: string; resolver: (v: boolean) => void }
  | { tipo: 'texto'; titulo: string; etiqueta: string; obligatorio: boolean; inicial: string; resolver: (v: string | null) => void }
  | { tipo: 'alerta'; titulo: string; texto: string; resolver: () => void }
  | ({ tipo: 'formulario'; resolver: (v: any) => void } & FormularioOpciones)
  | { tipo: 'firma'; titulo: string; resolver: (v: Dibujo | null) => void }
  | { tipo: 'elegir'; titulo: string; opciones: { valor: string; texto: string; icono?: string }[]; resolver: (v: string | null) => void }
  | { tipo: 'progreso'; texto: string; resolver: () => void };

interface Api {
  confirmar: (titulo: string, texto: string, si?: string) => Promise<boolean>;
  pedirTexto: (titulo: string, o?: { etiqueta?: string; obligatorio?: boolean; inicial?: string }) => Promise<string | null>;
  alerta: (titulo: string, texto: string) => Promise<void>;
  formulario: (o: FormularioOpciones) => Promise<any>;
  firma: (titulo: string) => Promise<Dibujo | null>;
  /** Lista de opciones (ej. "Tomar foto" / "Elegir de la galería") */
  elegir: (titulo: string, opciones: { valor: string; texto: string; icono?: string }[]) => Promise<string | null>;
  mensaje: (texto: string, error?: boolean) => void;
  /** Muestra "procesando…" mientras corre la acción */
  progreso: <T>(texto: string, accion: () => Promise<T>) => Promise<T>;
  /** Ejecuta una acción contra el backend mostrando el resultado. Devuelve true si salió bien. */
  ejecutar: (accion: () => Promise<any>, o?: { exito?: string }) => Promise<boolean>;
}

const Contexto = createContext<Api | null>(null);

export function DialogosProvider({ children }: { children: ReactNode }) {
  const [activo, setActivo] = useState<Activo | null>(null);
  // El texto se conserva al cerrar para que no se vea vacío durante la animación de salida
  const [snack, setSnack] = useState<{ texto: string; error: boolean; visible: boolean }>({ texto: '', error: false, visible: false });
  const cola = useRef<Activo[]>([]);

  const abrir = useCallback((d: Activo) => {
    setActivo((actual) => {
      if (actual && actual.tipo !== 'progreso') {
        cola.current.push(d);
        return actual;
      }
      return d;
    });
  }, []);

  const cerrar = useCallback(() => {
    setActivo(cola.current.shift() ?? null);
  }, []);

  const mensaje = useCallback((texto: string, error = false) => setSnack({ texto, error, visible: true }), []);

  const alerta = useCallback((titulo: string, texto: string) =>
    new Promise<void>((resolver) => abrir({ tipo: 'alerta', titulo, texto, resolver })), [abrir]);

  const ejecutar = useCallback(async (accion: () => Promise<any>, o?: { exito?: string }) => {
    try {
      await accion();
      if (o?.exito) mensaje(o.exito);
      return true;
    } catch (e) {
      if (e instanceof ApiError && e.pendientes.length) {
        await alerta(e.message, e.pendientes.map((p) => `• ${p}`).join('\n'));
      } else {
        mensaje(e instanceof ApiError ? e.message : `${e}`, true);
      }
      return false;
    }
  }, [alerta, mensaje]);

  const api = useMemo<Api>(() => ({
    confirmar: (titulo, texto, si = 'Confirmar') =>
      new Promise((resolver) => abrir({ tipo: 'confirmar', titulo, texto, si, resolver })),
    pedirTexto: (titulo, o = {}) =>
      new Promise((resolver) => abrir({ tipo: 'texto', titulo, etiqueta: o.etiqueta ?? '', obligatorio: o.obligatorio ?? true,
        inicial: o.inicial ?? '', resolver })),
    alerta,
    formulario: (o) => new Promise((resolver) => abrir({ tipo: 'formulario', ...o, resolver })),
    firma: (titulo) => new Promise((resolver) => abrir({ tipo: 'firma', titulo, resolver })),
    elegir: (titulo, opciones) => new Promise((resolver) => abrir({ tipo: 'elegir', titulo, opciones, resolver })),
    mensaje,
    progreso: async (texto, accion) => {
      setActivo({ tipo: 'progreso', texto, resolver: () => undefined });
      try {
        return await accion();
      } finally {
        setActivo((a) => (a?.tipo === 'progreso' ? cola.current.shift() ?? null : a));
      }
    },
    ejecutar,
  }), [abrir, alerta, mensaje, ejecutar]);

  return (
    <Contexto.Provider value={api}>
      {children}
      <Portal>
        {activo && <DialogoActivo d={activo} cerrar={cerrar} ejecutar={ejecutar} />}
        <Snackbar
          visible={snack.visible}
          onDismiss={() => setSnack((x) => ({ ...x, visible: false }))}
          duration={snack.error ? 6000 : 3000}
          wrapperStyle={{ bottom: 76 }}
          style={{ backgroundColor: snack.error ? Colores.error : Colores.navy, maxWidth: 600, alignSelf: 'center' }}
          action={{ label: 'OK', textColor: '#fff', onPress: () => setSnack((x) => ({ ...x, visible: false })) }}
        >
          <Text style={{ color: '#fff' }}>{snack.texto}</Text>
        </Snackbar>
      </Portal>
    </Contexto.Provider>
  );
}

const estiloDialogo = { maxWidth: 560, width: '94%' as const, alignSelf: 'center' as const };

function DialogoActivo({ d, cerrar, ejecutar }: { d: Activo; cerrar: () => void; ejecutar: Api['ejecutar'] }) {
  const terminar = (fn: () => void) => {
    cerrar();
    fn();
  };
  switch (d.tipo) {
    case 'confirmar':
      return (
        <Dialog visible onDismiss={() => terminar(() => d.resolver(false))} style={estiloDialogo}>
          <Dialog.Title>{d.titulo}</Dialog.Title>
          <Dialog.Content><Text>{d.texto}</Text></Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => terminar(() => d.resolver(false))}>Cancelar</Button>
            <Button mode="contained" onPress={() => terminar(() => d.resolver(true))}>{d.si}</Button>
          </Dialog.Actions>
        </Dialog>
      );
    case 'alerta':
      return (
        <Dialog visible onDismiss={() => terminar(d.resolver)} style={estiloDialogo}>
          <Dialog.Title>{d.titulo}</Dialog.Title>
          <Dialog.ScrollArea style={{ maxHeight: 400 }}>
            <ScrollView contentContainerStyle={{ paddingVertical: 12 }}><Text>{d.texto}</Text></ScrollView>
          </Dialog.ScrollArea>
          <Dialog.Actions><Button onPress={() => terminar(d.resolver)}>Entendido</Button></Dialog.Actions>
        </Dialog>
      );
    case 'texto':
      return <DialogoTexto d={d} terminar={terminar} />;
    case 'formulario':
      return <DialogoFormulario d={d} terminar={terminar} ejecutar={ejecutar} />;
    case 'firma':
      return <DialogoFirma d={d} terminar={terminar} />;
    case 'elegir':
      return (
        <Dialog visible onDismiss={() => terminar(() => d.resolver(null))} style={estiloDialogo}>
          <Dialog.Title>{d.titulo}</Dialog.Title>
          <Dialog.Content style={{ gap: 8 }}>
            {d.opciones.map((o) => (
              <Button key={o.valor} mode="outlined" icon={o.icono} contentStyle={{ height: 48, justifyContent: 'flex-start' }}
                onPress={() => terminar(() => d.resolver(o.valor))}>
                {o.texto}
              </Button>
            ))}
          </Dialog.Content>
          <Dialog.Actions><Button onPress={() => terminar(() => d.resolver(null))}>Cancelar</Button></Dialog.Actions>
        </Dialog>
      );
    case 'progreso':
      return (
        <Dialog visible dismissable={false} style={estiloDialogo}>
          <Dialog.Content style={{ flexDirection: 'row', alignItems: 'center', gap: 16, paddingTop: 24 }}>
            <ActivityIndicator />
            <Text>{d.texto}</Text>
          </Dialog.Content>
        </Dialog>
      );
  }
}

function DialogoTexto({ d, terminar }: { d: Extract<Activo, { tipo: 'texto' }>; terminar: (fn: () => void) => void }) {
  const [texto, setTexto] = useState(d.inicial);
  return (
    <Dialog visible onDismiss={() => terminar(() => d.resolver(null))} style={estiloDialogo}>
      <Dialog.Title>{d.titulo}</Dialog.Title>
      <Dialog.Content>
        <TextInput mode="outlined" label={d.etiqueta} value={texto} onChangeText={setTexto} multiline numberOfLines={4} autoFocus />
      </Dialog.Content>
      <Dialog.Actions>
        <Button onPress={() => terminar(() => d.resolver(null))}>Cancelar</Button>
        <Button mode="contained" disabled={d.obligatorio && !texto.trim()} onPress={() => terminar(() => d.resolver(texto.trim()))}>
          Aceptar
        </Button>
      </Dialog.Actions>
    </Dialog>
  );
}

function DialogoFormulario({ d, terminar, ejecutar }: {
  d: Extract<Activo, { tipo: 'formulario' }>;
  terminar: (fn: () => void) => void;
  ejecutar: Api['ejecutar'];
}) {
  const [valores, setValores] = useState<Record<string, string>>(() =>
    Object.fromEntries(d.campos.map((c) => [c.clave, `${d.valores?.[c.clave] ?? c.inicial ?? ''}`])));
  const [errores, setErrores] = useState<Record<string, string>>({});
  const [enviando, setEnviando] = useState(false);

  const guardar = async () => {
    const err: Record<string, string> = {};
    const datos: Record<string, any> = {};
    for (const c of d.campos) {
      const t = (valores[c.clave] ?? '').trim();
      if (c.obligatorio && !t) err[c.clave] = 'Obligatorio';
      if (!t) {
        if (d.valores) datos[c.clave] = null; // editar: vacío = borrar el valor
        continue;
      }
      if (c.numero) {
        const n = Number(t.replace(',', '.'));
        if (Number.isNaN(n)) err[c.clave] = 'Número inválido';
        datos[c.clave] = c.decimal ? n : Math.round(n);
      } else datos[c.clave] = t;
    }
    setErrores(err);
    if (Object.keys(err).length) return;
    setEnviando(true);
    let resultado: any;
    const ok = await ejecutar(async () => {
      resultado = await d.guardar(datos);
    });
    setEnviando(false);
    if (ok) terminar(() => d.resolver(resultado ?? true));
  };

  return (
    <Dialog visible onDismiss={() => terminar(() => d.resolver(null))} style={estiloDialogo}>
      <Dialog.Title>{d.titulo}</Dialog.Title>
      <Dialog.ScrollArea style={{ maxHeight: 480, paddingHorizontal: 16 }}>
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingVertical: 12, gap: 10 }}>
          {d.campos.map((c) => (
            <View key={c.clave}>
              {c.opciones ? (
                <Selector
                  etiqueta={c.etiqueta + (c.obligatorio ? ' *' : '')}
                  valor={valores[c.clave] || null}
                  opciones={c.opciones}
                  permitirVacio={!c.obligatorio}
                  textoVacio="(sin seleccionar)"
                  onCambiar={(v) => setValores((x) => ({ ...x, [c.clave]: v ?? '' }))}
                />
              ) : (
                <TextInput
                  mode="outlined"
                  dense
                  label={c.etiqueta + (c.obligatorio ? ' *' : '')}
                  value={valores[c.clave]}
                  onChangeText={(t) => setValores((x) => ({ ...x, [c.clave]: t }))}
                  secureTextEntry={c.oculto}
                  multiline={c.multilinea}
                  keyboardType={c.numero ? 'decimal-pad' : 'default'}
                  autoCapitalize={c.oculto || c.clave.includes('correo') ? 'none' : 'sentences'}
                  error={!!errores[c.clave]}
                />
              )}
              {errores[c.clave] && <Text style={{ color: Colores.error, fontSize: 12 }}>{errores[c.clave]}</Text>}
            </View>
          ))}
        </ScrollView>
      </Dialog.ScrollArea>
      <Dialog.Actions>
        <Button onPress={() => terminar(() => d.resolver(null))}>Cancelar</Button>
        <Button mode="contained" loading={enviando} disabled={enviando} onPress={guardar}>{d.textoGuardar ?? 'Guardar'}</Button>
      </Dialog.Actions>
    </Dialog>
  );
}

function DialogoFirma({ d, terminar }: { d: Extract<Activo, { tipo: 'firma' }>; terminar: (fn: () => void) => void }) {
  const lienzo = useRef<LienzoFirmaRef>(null);
  const [aviso, setAviso] = useState(false);
  return (
    <Dialog visible dismissable={false} style={estiloDialogo}>
      <Dialog.Title>{d.titulo}</Dialog.Title>
      <Dialog.Content>
        <LienzoFirma ref={lienzo} alto={220} />
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <Button icon="eraser" onPress={() => lienzo.current?.borrar()}>Borrar</Button>
          {aviso && <Text style={{ color: Colores.error }}>Firme dentro del recuadro</Text>}
        </View>
      </Dialog.Content>
      <Dialog.Actions>
        <Button onPress={() => terminar(() => d.resolver(null))}>Cancelar</Button>
        <Button
          mode="contained"
          onPress={() => {
            if (!lienzo.current || lienzo.current.vacio()) {
              setAviso(true);
              return;
            }
            const dibujo = lienzo.current.dibujo();
            terminar(() => d.resolver(dibujo));
          }}
        >
          Guardar firma
        </Button>
      </Dialog.Actions>
    </Dialog>
  );
}

export function useDialogos(): Api {
  const d = useContext(Contexto);
  if (!d) throw new Error('useDialogos fuera de DialogosProvider');
  return d;
}
