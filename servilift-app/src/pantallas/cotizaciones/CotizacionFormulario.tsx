// Crear o editar (borrador) una cotización: un edificio y sus equipos elegidos uno a uno, con valor,
// tipo de servicio y norma (por defecto la edición vigente de la NTC 5926-1).
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { Button, Checkbox, Text, TextInput } from 'react-native-paper';

import { Api } from '@/api/cliente';
import { Selector } from '@/componentes/Campos';
import { Contenido, EstadoCarga, Fila, Tarjeta, Titulo, Vacio } from '@/componentes/Comunes';
import { useDialogos } from '@/componentes/Dialogos';
import { Colores, moneda } from '@/tema';
import { TIPOS_SERVICIO } from '../catalogos';

interface Linea {
  incluido: boolean;
  valor: string;
  tipo: string;
  norma: number | null;
  descripcion: string;
}

const numero = (t: string) => Number(t.replace(/\./g, '').replace(',', '.'));

export default function CotizacionFormulario() {
  const { id, idEdificio } = useLocalSearchParams<{ id?: string; idEdificio?: string }>();
  const d = useDialogos();
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [cot, setCot] = useState<any>(null);
  const [clientes, setClientes] = useState<any[]>([]);
  const [normas, setNormas] = useState<any[]>([]);
  const [edificios, setEdificios] = useState<any[]>([]);
  const [idCliente, setIdCliente] = useState<number | null>(null);
  const [idEd, setIdEd] = useState<number | null>(null);
  const [lineas, setLineas] = useState<Record<number, Linea>>({});
  const [iva, setIva] = useState('19');
  const [validez, setValidez] = useState('30');
  const [valorTodos, setValorTodos] = useState('');
  const [observaciones, setObservaciones] = useState('');
  const [guardando, setGuardando] = useState(false);
  const vigente = normas.find((n) => n.vigente && n.parte === 1)?.id_norma ?? null;

  const cargarEdificios = async (cliente: number | null, seleccionar: number | null, base?: any) => {
    const eds = cliente ? await Api.get(`/clientes/${cliente}/edificios`) : [];
    setEdificios(eds);
    const elegido = seleccionar ?? (eds.length === 1 ? eds[0].id_edificio : null);
    elegirEdificio(eds, elegido, base);
  };

  const elegirEdificio = (eds: any[], id: number | null, base?: any) => {
    setIdEd(id);
    const ed = eds.find((e) => e.id_edificio === id);
    const nuevas: Record<number, Linea> = {};
    for (const q of ed?.equipos ?? []) {
      const previo = base?.equipos?.find((e: any) => e.id_equipo === q.id_equipo);
      nuevas[q.id_equipo] = previo
        ? { incluido: true, valor: String(Math.round(Number(previo.valor))), tipo: previo.tipo_servicio, norma: previo.id_norma, descripcion: previo.descripcion ?? '' }
        : { incluido: false, valor: '', tipo: 'INSPECCION_PERIODICA', norma: null, descripcion: '' };
    }
    setLineas(nuevas);
  };

  useEffect(() => {
    (async () => {
      try {
        const [cls, ns] = await Promise.all([Api.get('/clientes'), Api.get('/catalogos/normas')]);
        setClientes(cls);
        setNormas(ns);
        if (id) {
          const c = await Api.get(`/cotizaciones/${id}`);
          setCot(c);
          setIdCliente(c.id_cliente);
          setIva(String(Number(c.iva_porcentaje)));
          setValidez(String(c.dias_validez));
          setObservaciones(c.observaciones ?? '');
          await cargarEdificios(c.id_cliente, c.id_edificio, c);
        } else if (idEdificio) {
          const ed = await Api.get(`/edificios/${idEdificio}`);
          setIdCliente(ed.id_cliente);
          await cargarEdificios(ed.id_cliente, Number(idEdificio));
        }
      } catch (e) {
        setError(String(e));
      }
      setCargando(false);
    })();
  }, [id, idEdificio]); // eslint-disable-line react-hooks/exhaustive-deps

  const equipos = edificios.find((e) => e.id_edificio === idEd)?.equipos ?? [];
  const subtotal = Object.values(lineas).filter((l) => l.incluido).reduce((a, l) => a + (numero(l.valor) || 0), 0);
  const pIva = (Number(iva.replace(',', '.')) || 0) / 100;
  const fijar = (idEquipo: number, cambios: Partial<Linea>) => setLineas((x) => ({ ...x, [idEquipo]: { ...x[idEquipo], ...cambios } }));

  const guardar = async () => {
    const seleccion = Object.entries(lineas).filter(([, l]) => l.incluido);
    if (!idEd || !seleccion.length) {
      d.mensaje('Seleccione el edificio y al menos un equipo', true);
      return;
    }
    if (seleccion.some(([, l]) => Number.isNaN(numero(l.valor)) || !l.valor.trim())) {
      d.mensaje('Ingrese el valor de cada equipo seleccionado', true);
      return;
    }
    const body = {
      id_edificio: idEd, dias_validez: Number(validez) || 30, iva_porcentaje: Number(iva.replace(',', '.')) || 19,
      observaciones: observaciones.trim() || null,
      equipos: seleccion.map(([idEquipo, l]) => ({ id_equipo: Number(idEquipo), valor: numero(l.valor), tipo_servicio: l.tipo,
        id_norma: l.norma ?? vigente, descripcion: l.descripcion.trim() || null })),
    };
    setGuardando(true);
    let r: any;
    const ok = await d.ejecutar(async () => {
      r = id ? await Api.put(`/cotizaciones/${id}`, body) : await Api.post('/cotizaciones', body);
    }, { exito: id ? 'Cotización actualizada' : 'Cotización creada' });
    setGuardando(false);
    if (ok) router.replace(`/cotizaciones/${r.id_cotizacion}`);
  };

  if (cargando || error) return (<><Stack.Screen options={{ title: 'Cotización' }} /><EstadoCarga error={error} /></>);

  return (
    <>
      <Stack.Screen options={{ title: cot ? `Editar ${cot.numero_cotizacion}` : 'Nueva cotización' }} />
      <Contenido ancho={900}>
        <View style={{ gap: 12 }}>
          <Selector etiqueta="Cliente" valor={idCliente} deshabilitado={!!cot}
            opciones={clientes.map((c) => ({ valor: c.id_cliente, texto: `${c.razon_social} (${c.numero_documento})` }))}
            onCambiar={(v) => { setIdCliente(v); void cargarEdificios(v, null); }} />
          <Selector etiqueta="Edificio" valor={idEd} deshabilitado={!!cot}
            opciones={edificios.map((e) => ({ valor: e.id_edificio, texto: `${e.nombre} · ${e.direccion}` }))}
            onCambiar={(v) => elegirEdificio(edificios, v)} />
        </View>
        <Titulo texto={`Equipos a certificar (${Object.values(lineas).filter((l) => l.incluido).length} de ${equipos.length})`} />
        {!!equipos.length && (
          <TextInput mode="outlined" dense label="Mismo valor a todos" keyboardType="number-pad" value={valorTodos}
            onChangeText={setValorTodos} style={{ maxWidth: 280, marginBottom: 6 }}
            right={<TextInput.Icon tabIndex={-1} icon="check-all" onPress={() => setLineas((x) => Object.fromEntries(
              Object.entries(x).map(([k, l]) => [k, { ...l, incluido: true, valor: valorTodos }])))} />} />
        )}
        {!equipos.length && <Vacio texto={idEd ? 'El edificio no tiene equipos registrados' : 'Elija el cliente y el edificio'} />}
        {equipos.map((q: any) => {
          const l = lineas[q.id_equipo];
          if (!l) return null;
          return (
            <Tarjeta key={q.id_equipo}>
              <Fila>
                <Checkbox.Item style={{ paddingHorizontal: 0, minWidth: 220 }} position="leading" status={l.incluido ? 'checked' : 'unchecked'}
                  label={q.identificacion} labelStyle={{ fontWeight: '600', textAlign: 'left' }}
                  onPress={() => fijar(q.id_equipo, { incluido: !l.incluido })} />
                {l.incluido && (
                  <>
                    <TextInput mode="outlined" dense label="Valor" keyboardType="number-pad" value={l.valor} left={<TextInput.Affix text="$" />}
                      style={{ width: 160 }} onChangeText={(t) => fijar(q.id_equipo, { valor: t })} />
                    <Selector style={{ width: 220 }} etiqueta="Servicio" valor={l.tipo} opciones={TIPOS_SERVICIO}
                      onCambiar={(v) => v && fijar(q.id_equipo, { tipo: v })} />
                    <Selector style={{ width: 220 }} etiqueta="Norma" valor={l.norma ?? vigente}
                      opciones={normas.map((n) => ({ valor: n.id_norma, texto: `${n.etiqueta}${n.vigente ? ' (vigente)' : ''}` }))}
                      onCambiar={(v) => fijar(q.id_equipo, { norma: v })} />
                  </>
                )}
              </Fila>
            </Tarjeta>
          );
        })}
        <Fila style={{ marginTop: 12 }}>
          <TextInput mode="outlined" dense label="IVA %" keyboardType="decimal-pad" value={iva} onChangeText={setIva} style={{ flex: 1, minWidth: 120 }} />
          <TextInput mode="outlined" dense label="Validez (días)" keyboardType="number-pad" value={validez} onChangeText={setValidez} style={{ flex: 1, minWidth: 120 }} />
        </Fila>
        <TextInput mode="outlined" label="Observaciones" multiline numberOfLines={3} value={observaciones} onChangeText={setObservaciones} style={{ marginTop: 12 }} />
        <Tarjeta style={{ marginTop: 12 }}>
          {[['Subtotal', subtotal], ['IVA', subtotal * pIva], ['Total', subtotal * (1 + pIva)]].map(([t, v], i) => (
            <View key={String(t)} style={{ flexDirection: 'row' }}>
              <Text style={{ flex: 1, fontSize: i === 2 ? 18 : 14, fontWeight: i === 2 ? '800' : '400', color: i === 2 ? Colores.navy : undefined }}>{t}</Text>
              <Text style={{ fontSize: i === 2 ? 18 : 14, fontWeight: i === 2 ? '800' : '400' }}>{moneda(v)}</Text>
            </View>
          ))}
        </Tarjeta>
        <Button mode="contained" icon="content-save" onPress={guardar} loading={guardando} disabled={guardando}
          style={{ marginTop: 16 }} contentStyle={{ height: 46 }}>
          {cot ? 'Guardar cambios' : 'Crear cotización'}
        </Button>
      </Contenido>
    </>
  );
}
