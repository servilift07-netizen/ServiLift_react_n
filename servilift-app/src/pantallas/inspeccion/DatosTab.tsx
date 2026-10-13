// Datos del cliente/edificio/equipo (precargados), datos del ascensor, variantes, encabezado e instrumentos.
// Datos del ascensor y variantes se abren con "Editar" y se cierran con "Guardar datos" (o "Cancelar").
// Guardar deja el cambio en el teléfono y lo envía cuando hay señal.
import { useState } from 'react';
import { ScrollView, View } from 'react-native';
import { Button, Chip, Text, TextInput } from 'react-native-paper';

import { Api } from '@/api/cliente';
import { CampoFecha, Fechas, Selector } from '@/componentes/Campos';
import { Dato, Tarjeta, Titulo } from '@/componentes/Comunes';
import { useDialogos } from '@/componentes/Dialogos';
import { useCarga } from '@/hooks/useCarga';
import { cola } from '@/offline/cola';
import { numeroParametro, RECORRIDO_POR_DEFECTO, recorridoEstimado } from '@/logica/recorrido';
import { Colores } from '@/tema';
import { TIPOS_EQUIPO } from '../catalogos';
import { clavesCache } from './precarga';

const CAMPOS_EQUIPO: [string, string, boolean][] = [
  ['marca', 'Marca', false], ['modelo', 'Modelo', false], ['numero_serie', 'Identificación del equipo (serial)', false],
  ['anio_fabricacion', 'Año de fabricación', true], ['capacidad_kg', 'Capacidad (kg)', true],
  ['capacidad_personas', 'Capacidad (personas)', true], ['numero_paradas', 'Número de paradas', true],
  ['velocidad_ms', 'Velocidad (m/s)', true], ['recorrido_m', 'Recorrido (m)', true],
  ['profundidad_foso_mm', 'Profundidad de foso (mm)', true], ['fecha_puesta_marcha', 'Puesta en marcha', false],
];

const CAMPOS_INFORME: [string, string][] = [
  ['tipo_acrilico', 'Tipo de acrílico de certificación'], ['empresa_mantenimiento', 'Empresa de mantenimiento'],
  ['tecnico_mantenimiento', 'Técnico de mantenimiento'], ['fecha_ultimo_mantenimiento', 'Último mantenimiento'],
  ['fecha_ultima_inspeccion', 'Última inspección'],
];

const texto = (k: string, v: any) => (v === null || v === undefined ? '' : k.startsWith('fecha_') ? Fechas.mostrar(v) : String(v));

export default function DatosTab({ insp, editable, fijar }: { insp: any; editable: boolean; fijar: (fn: (d: any) => any) => void }) {
  const d = useDialogos();
  const id = insp.id_inspeccion;
  const parte = insp.parte_norma ?? 1;
  const variantes = useCarga<any[]>(() => Api.get('/catalogos/variantes', { parte }), [parte],
    { intervalo: null, cache: clavesCache.variantes(parte) });
  const instrumentos = useCarga<any[]>(() => Api.get('/instrumentos'), [], { intervalo: null, cache: clavesCache.instrumentos });
  const parametros = useCarga<Record<string, string>>(() => Api.get('/catalogos/parametros'), [],
    { intervalo: null, cache: clavesCache.parametros });
  const porParada = numeroParametro(parametros.datos?.RECORRIDO_M_POR_PARADA, RECORRIDO_POR_DEFECTO.porParada);
  const sobreRecorrido = numeroParametro(parametros.datos?.RECORRIDO_SOBRE_RECORRIDO_M, RECORRIDO_POR_DEFECTO.sobreRecorrido);

  const eq = insp.datos_equipo?.equipo ?? {};
  const [equipo, setEquipo] = useState<Record<string, string>>(() =>
    Object.fromEntries(CAMPOS_EQUIPO.map(([k]) => [k, texto(k, eq[k])])));
  const [tipoEquipo, setTipoEquipo] = useState<string>(eq.tipo_equipo ?? 'ASCENSOR_PASAJEROS');
  const [seleccion, setSeleccion] = useState<Record<number, number>>(() =>
    Object.fromEntries(insp.variantes.map((v: any) => [v.id_variante_tipo, v.id_variante_opcion])));
  const [informe, setInforme] = useState<Record<string, string>>(() => ({
    ...Object.fromEntries(CAMPOS_INFORME.map(([k]) => [k, texto(k, insp[k])])),
    observaciones_generales: insp.observaciones_generales ?? '',
  }));
  const [conservacion, setConservacion] = useState<string>(insp.conservacion_informacion ?? 'DIGITAL');
  const [instrSel, setInstrSel] = useState<Set<number>>(() => new Set(insp.instrumentos.map((x: any) => x.id_instrumento)));
  // Copia de lo que había al pulsar "Editar", para poder cancelar; null = sección en solo lectura
  const [copiaEquipo, setCopiaEquipo] = useState<{ equipo: Record<string, string>; tipo: string } | null>(null);
  const [copiaVariantes, setCopiaVariantes] = useState<Record<number, number> | null>(null);
  const editandoEquipo = editable && !!copiaEquipo;
  const editandoVariantes = editable && !!copiaVariantes;

  const guardarEquipo = async () => {
    const body: Record<string, any> = { tipo_equipo: tipoEquipo };
    try {
      for (const [k, , numero] of CAMPOS_EQUIPO) {
        const t = equipo[k].trim().replace(',', '.');
        if (k.startsWith('fecha_')) body[k] = Fechas.paraApi(equipo[k]);
        else if (!t || t.toUpperCase() === 'NI') body[k] = null;
        else if (numero) {
          if (Number.isNaN(Number(t))) throw new Error(`Revise el valor numérico de "${k}"`);
          body[k] = Number(t);
        } else body[k] = t;
      }
    } catch (e) {
      d.mensaje(String((e as Error).message), true);
      return;
    }
    await cola.put(id, 'equipo', `/inspecciones/${id}/equipo`, body, 'Datos del ascensor');
    fijar((x) => ({ ...x, datos_equipo: { ...x.datos_equipo, equipo: { ...x.datos_equipo?.equipo, ...body } } }));
    setCopiaEquipo(null);
    d.mensaje('Datos del ascensor guardados');
  };

  const guardarVariantes = async () => {
    const lista = Object.entries(seleccion).map(([t, o]) => ({ id_variante_tipo: Number(t), id_variante_opcion: o }));
    await cola.put(id, 'variantes', `/inspecciones/${id}/variantes`, lista, 'Variantes del equipo');
    setCopiaVariantes(null);
    const faltan = (variantes.datos ?? []).filter((t) => t.obligatoria && !seleccion[t.id_variante_tipo]).length;
    d.mensaje(faltan ? `Guardado. Faltan ${faltan} variantes` : 'Variantes guardadas: el checklist se ajusta al sincronizar');
  };

  const guardarInforme = async () => {
    const body: Record<string, any> = { conservacion_informacion: conservacion };
    try {
      for (const [k] of CAMPOS_INFORME) body[k] = k.startsWith('fecha_') ? Fechas.paraApi(informe[k]) : informe[k].trim() || null;
    } catch (e) {
      d.mensaje(String((e as Error).message), true);
      return;
    }
    body.observaciones_generales = informe.observaciones_generales.trim();
    await cola.put(id, 'encabezado', `/inspecciones/${id}/encabezado`, body, 'Datos del informe');
    await cola.put(id, 'instrumentos', `/inspecciones/${id}/instrumentos`, [...instrSel], 'Equipos de medición');
    fijar((x) => ({ ...x, ...body }));
    d.mensaje('Datos del informe guardados');
  };

  const dd = insp.datos_equipo ?? {};
  const cli = dd.cliente ?? {};
  const ed = dd.edificio ?? {};
  const r = insp.resumen ?? {};
  const campo = { flexGrow: 1, flexBasis: 240 };

  return (
    <ScrollView contentContainerStyle={{ padding: 12, paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
      <View style={{ width: '100%', maxWidth: 900, alignSelf: 'center' }}>
        <Tarjeta>
          <Dato etiqueta="Cotización" valor={`${dd.numero_cotizacion} · ${dd.codigo_servicio}`} />
          <Dato etiqueta="Norma" valor={insp.norma} />
          <Dato etiqueta="Cliente" valor={`${cli.razon_social} (${cli.tipo_documento} ${cli.numero_documento})`} />
          <Dato etiqueta="Edificio" valor={`${ed.nombre} · ${ed.direccion}, ${ed.ciudad}`} />
          <Dato etiqueta="Equipo" valor={[eq.identificacion, eq.marca, eq.modelo].filter(Boolean).join(' · ')} />
          <Dato etiqueta="Avance (servidor)" valor={`${r.calificados ?? 0} calificados · ${r.total_no_cumple ?? 0} no cumple · ${r.no_aplica ?? 0} no aplica`} />
        </Tarjeta>

        <Titulo texto="Datos del ascensor" accion={editable && (
          <AccionesEdicion editando={editandoEquipo} onEditar={() => setCopiaEquipo({ equipo, tipo: tipoEquipo })}
            onGuardar={guardarEquipo}
            onCancelar={() => { if (copiaEquipo) { setEquipo(copiaEquipo.equipo); setTipoEquipo(copiaEquipo.tipo); } setCopiaEquipo(null); }} />
        )} />
        <Text style={{ color: Colores.gris, fontSize: 12, marginBottom: 8 }}>Los verifica el inspector en sitio; quedan en el equipo y en el informe.</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
          <Selector style={campo} etiqueta="Tipo de equipo" valor={tipoEquipo} opciones={TIPOS_EQUIPO} deshabilitado={!editandoEquipo}
            onCambiar={(v) => v && setTipoEquipo(v)} />
          {CAMPOS_EQUIPO.map(([k, etq, numero]) => (k.startsWith('fecha_')
            ? <CampoFecha key={k} style={campo} etiqueta={etq} valor={equipo[k]} deshabilitado={!editandoEquipo} maximo={Fechas.hoy()}
                onCambiar={(t) => setEquipo((x) => ({ ...x, [k]: t }))} />
            : <TextInput key={k} style={campo} mode="outlined" dense label={etq} placeholder="NI" value={equipo[k]} disabled={!editandoEquipo}
                keyboardType={numero ? 'decimal-pad' : 'default'} onChangeText={(t) => setEquipo((x) => (k === 'numero_paradas'
                  ? { ...x, numero_paradas: t, recorrido_m: recorridoEstimado(t, porParada, sobreRecorrido) || x.recorrido_m } : { ...x, [k]: t }))} />))}
        </View>
        <Text style={{ color: Colores.gris, fontSize: 12, marginTop: 4 }}>
          El recorrido se calcula solo al escribir el número de paradas ({porParada} m por parada + {sobreRecorrido} m de sobre recorrido); se puede corregir.
        </Text>

        <Titulo texto="Variantes del equipo" accion={editable && (
          <AccionesEdicion editando={editandoVariantes} onEditar={() => setCopiaVariantes(seleccion)} onGuardar={guardarVariantes}
            onCancelar={() => { if (copiaVariantes) setSeleccion(copiaVariantes); setCopiaVariantes(null); }} />
        )} />
        <Text style={{ color: Colores.gris, fontSize: 12, marginBottom: 8 }}>Según las variantes, los ítems que no aplican se marcan solos como "No aplica".</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
          {(variantes.datos ?? []).map((t) => (
            <Selector key={t.id_variante_tipo} style={campo} etiqueta={t.nombre + (t.obligatoria ? ' *' : '')}
              valor={seleccion[t.id_variante_tipo] ?? null} deshabilitado={!editandoVariantes}
              opciones={t.opciones.map((o: any) => ({ valor: o.id_variante_opcion, texto: o.nombre }))}
              onCambiar={(v) => v && setSeleccion((x) => ({ ...x, [t.id_variante_tipo]: v }))} />
          ))}
          {!variantes.datos && <Text style={{ color: Colores.gris }}>{variantes.error ?? 'Cargando variantes…'}</Text>}
        </View>

        <Titulo texto="Datos del informe" accion={editable && <Button mode="contained-tonal" onPress={guardarInforme}>Guardar</Button>} />
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
          <Selector style={campo} etiqueta="Conservación de la información" valor={conservacion} deshabilitado={!editable}
            opciones={[{ valor: 'DIGITAL', texto: 'Digital' }, { valor: 'FISICO', texto: 'Físico' }]}
            onCambiar={(v) => v && setConservacion(v)} />
          {CAMPOS_INFORME.map(([k, etq]) => (k.startsWith('fecha_')
            ? <CampoFecha key={k} style={campo} etiqueta={etq} valor={informe[k]} deshabilitado={!editable} maximo={Fechas.hoy()}
                onCambiar={(t) => setInforme((x) => ({ ...x, [k]: t }))} />
            : <TextInput key={k} style={campo} mode="outlined" dense label={etq} placeholder="NI" value={informe[k]} disabled={!editable}
                onChangeText={(t) => setInforme((x) => ({ ...x, [k]: t }))} />))}
        </View>
        <TextInput mode="outlined" label="Observaciones generales" multiline numberOfLines={4} style={{ marginTop: 10 }}
          value={informe.observaciones_generales} disabled={!editable}
          onChangeText={(t) => setInforme((x) => ({ ...x, observaciones_generales: t }))} />

        <Titulo texto="Equipos de medición utilizados" />
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
          {(instrumentos.datos ?? []).map((x) => (
            <Chip key={x.id_instrumento} selected={instrSel.has(x.id_instrumento)} disabled={!editable} showSelectedCheck
              onPress={() => setInstrSel((s) => {
                const n = new Set(s);
                if (n.has(x.id_instrumento)) n.delete(x.id_instrumento); else n.add(x.id_instrumento);
                return n;
              })}>
              {String(x.tipo).replace(/_/g, ' ').toLowerCase()} {x.codigo}
            </Chip>
          ))}
          {instrumentos.datos && !instrumentos.datos.length && <Text style={{ color: Colores.gris }}>No hay instrumentos registrados</Text>}
        </View>
        {editable && <Text style={{ color: Colores.gris, fontSize: 12, marginTop: 6 }}>Los instrumentos se guardan con "Datos del informe".</Text>}
      </View>
    </ScrollView>
  );
}

/** "Editar" en solo lectura; "Cancelar" y "Guardar datos" mientras se edita. */
function AccionesEdicion({ editando, onEditar, onGuardar, onCancelar }:
  { editando: boolean; onEditar: () => void; onGuardar: () => void; onCancelar: () => void }) {
  if (!editando) return <Button mode="outlined" icon="pencil" onPress={onEditar}>Editar</Button>;
  return (
    <View style={{ flexDirection: 'row', gap: 6 }}>
      <Button onPress={onCancelar}>Cancelar</Button>
      <Button mode="contained" icon="content-save" onPress={onGuardar}>Guardar datos</Button>
    </View>
  );
}
