// Checklist de la norma del servicio, por zonas. Cada cambio se guarda en el teléfono al instante
// y se sincroniza solo. En la segunda visita muestra solo los hallazgos para marcarlos corregidos / no corregidos.
import { memo, useMemo, useState } from 'react';
import { Image, ScrollView, View } from 'react-native';
import { Button, Chip, List, ProgressBar, SegmentedButtons, Text } from 'react-native-paper';

import { Api, url } from '@/api/cliente';
import { CampoDiferido } from '@/componentes/CampoDiferido';
import { EstadoCarga, Icon } from '@/componentes/Comunes';
import { useDialogos } from '@/componentes/Dialogos';
import { useCarga } from '@/hooks/useCarga';
import { cola } from '@/offline/cola';
import { useSincronizacion } from '@/offline/SincronizacionContext';
import { aclarar, Colores } from '@/tema';
import { agregarFotos } from './fotos';
import { aplicarPendientes, Checklist, fotosPendientes, ItemChecklist, resumenLocal, useEnvios } from './pendientes';
import { clavesCache } from './precarga';

const COLOR_CALIF: Record<string, string> = { L: '#2F6FB0', G: '#C97B1A', MG: '#C0392B' };
const FONDO_RESULTADO: Record<string, string> = { CUMPLE: '#D4EDDA', NO_CUMPLE: '#F8D7DA', NO_APLICA: '#E2E8F0' };
const SIN_FOTOS: { id: string; uri: string }[] = [];
const FILTROS = [['TODOS', 'Todos'], ['PENDIENTES', 'Pendientes'], ['NO_CUMPLE', 'No cumple'], ['MEDICION', 'Con medición']] as const;

export default function ChecklistTab({ idInspeccion, editable, segundaVisita }: {
  idInspeccion: number;
  editable: boolean;
  segundaVisita: boolean;
}) {
  const c = useCarga<Checklist>(() => Api.get(`/inspecciones/${idInspeccion}/checklist`), [idInspeccion],
    { intervalo: null, cache: clavesCache.checklist(idInspeccion) });
  const sync = useSincronizacion();
  const [filtro, setFiltro] = useState<string>('TODOS');
  const [abiertas, setAbiertas] = useState<Set<number>>(new Set());

  // Lo que ya llegó al servidor se incorpora a los datos guardados (sin volver a descargar todo)
  useEnvios(idInspeccion, (e) => {
    if (e.op.tipo === 'resultados' || e.op.tipo === 'segunda') c.fijar((d) => aplicarPendientes(d, [e.op], false));
    else if (e.op.tipo === 'foto' || e.op.tipo === 'borrar_foto' || (e.op.tipo === 'put' && e.op.clave === 'variantes')) {
      void c.recargar();
    }
  });

  const ops = useMemo(() => sync.operaciones.filter((o) => o.idInspeccion === idInspeccion), [sync.operaciones, idInspeccion]);
  const datos = useMemo(() => (c.datos ? aplicarPendientes(c.datos, ops) : undefined), [c.datos, ops]);
  const fotosPorItem = useMemo(() => {
    const m = new Map<number, { id: string; uri: string }[]>();
    for (const f of fotosPendientes(ops)) {
      const idItem = Number(f.campos.id_item);
      if (idItem) m.set(idItem, [...(m.get(idItem) ?? []), f]);
    }
    return m;
  }, [ops]);
  if (!datos) return <EstadoCarga error={c.error} onReintentar={c.recargar} />;
  const r = resumenLocal(datos);

  const visible = (it: ItemChecklist) => {
    const res = it.resultado?.resultado;
    if (segundaVisita) return res === 'NO_CUMPLE';
    switch (filtro) {
      case 'PENDIENTES': return !res || res === 'NO_VERIFICADO';
      case 'NO_CUMPLE': return res === 'NO_CUMPLE';
      case 'MEDICION': return it.requiere_medicion && res !== 'NO_APLICA';
      default: return true;
    }
  };

  return (
    <View style={{ flex: 1 }}>
      <View style={{ backgroundColor: '#fff', paddingHorizontal: 12, paddingBottom: 8, gap: 6 }}>
        <Text style={{ fontWeight: '600' }}>
          {segundaVisita
            ? `Hallazgos: ${r.no_cumple} · Corregidos ${r.corregidos} · No corregidos ${r.no_corregidos} · Por revisar ${r.no_cumple - r.corregidos - r.no_corregidos}`
            : `${r.calificados}/${r.total} calificados · NC: L ${r.leves} G ${r.graves} MG ${r.muy_graves} · NA ${r.no_aplica}`}
        </Text>
        {!segundaVisita && (
          <>
            <ProgressBar progress={r.total ? r.calificados / r.total : 0} color={Colores.acento} />
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
              {FILTROS.map(([v, t]) => (
                <Chip key={v} selected={filtro === v} onPress={() => setFiltro(v)} compact>{t}</Chip>
              ))}
            </ScrollView>
          </>
        )}
      </View>
      <ScrollView contentContainerStyle={{ padding: 8, paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
        <View style={{ width: '100%', maxWidth: 900, alignSelf: 'center' }}>
          {datos.categorias.map((cat) => {
            const items = cat.items.filter(visible);
            if (!items.length) return null;
            const hechos = cat.items.filter((i) => i.resultado && i.resultado.resultado !== 'NO_VERIFICADO').length;
            const abierta = segundaVisita || filtro !== 'TODOS' || abiertas.has(cat.id_categoria);
            return (
              <View key={cat.id_categoria} style={{ backgroundColor: '#fff', borderRadius: 12, borderWidth: 1, borderColor: Colores.borde, marginVertical: 4, overflow: 'hidden' }}>
                <List.Accordion
                  title={cat.nombre}
                  titleStyle={{ fontWeight: '700' }}
                  description={segundaVisita ? undefined : `${hechos} de ${cat.items.length}`}
                  expanded={abierta}
                  onPress={() => setAbiertas((s) => {
                    const n = new Set(s);
                    if (n.has(cat.id_categoria)) n.delete(cat.id_categoria); else n.add(cat.id_categoria);
                    return n;
                  })}
                  style={{ backgroundColor: '#fff' }}
                >
                  {abierta && items.map((it) => (
                    <Item key={it.id_item} it={it} idInspeccion={idInspeccion} editable={editable} segundaVisita={segundaVisita}
                      fotosLocales={fotosPorItem.get(it.id_item) ?? SIN_FOTOS} />
                  ))}
                </List.Accordion>
              </View>
            );
          })}
        </View>
      </ScrollView>
    </View>
  );
}

const Item = memo(function Item({ it, idInspeccion, editable, segundaVisita, fotosLocales }: {
  it: ItemChecklist;
  idInspeccion: number;
  editable: boolean;
  segundaVisita: boolean;
  fotosLocales: { id: string; uri: string }[];
}) {
  const d = useDialogos();
  const r = it.resultado;
  const resultado = r?.resultado && r.resultado !== 'NO_VERIFICADO' ? r.resultado : '';

  const guardar = (cambios: Record<string, string | null>) => {
    const ahora = new Date().toISOString();
    if (segundaVisita) {
      const estado = (cambios.estado_segunda_visita ?? r?.estado_segunda_visita) as string | null;
      if (!estado) return;
      void cola.segunda(idInspeccion, {
        id_item: it.id_item, estado_segunda_visita: estado, modificado_en: ahora,
        observacion_segunda_visita: 'observacion_segunda_visita' in cambios ? cambios.observacion_segunda_visita : r?.observacion_segunda_visita ?? null,
      });
      return;
    }
    const v = { resultado: r?.resultado ?? 'NO_VERIFICADO', valor_medido: r?.valor_medido ?? null,
      unidad_medida: r?.unidad_medida ?? it.unidad_medida ?? null, observacion: r?.observacion ?? null, ...cambios };
    void cola.resultado(idInspeccion, { id_item: it.id_item, resultado: v.resultado as string, valor_medido: v.valor_medido,
      unidad_medida: v.unidad_medida, observacion: v.observacion, modificado_en: ahora });
  };

  const fotos = [...(it.fotos ?? []).map((f: any) => ({ clave: `s${f.id_foto}`, uri: url(f.url_miniatura), pendiente: false })),
    ...fotosLocales.map((f) => ({ clave: f.id, uri: f.uri, pendiente: true }))];
  const sinFoto = resultado === 'NO_CUMPLE' && !fotos.length;

  return (
    <View style={{ borderTopWidth: 1, borderTopColor: '#EFF2F5', padding: 12, gap: 6 }}>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <Text style={{ width: 30, fontWeight: '800' }}>{it.numero}</Text>
        <Text style={{ flex: 1 }}>{it.descripcion}</Text>
        <View style={{ backgroundColor: COLOR_CALIF[it.calificacion_corta], borderRadius: 6, paddingHorizontal: 6, alignSelf: 'flex-start' }}>
          <Text style={{ color: '#fff', fontSize: 11, fontWeight: '700' }}>{it.calificacion_corta}</Text>
        </View>
      </View>
      {it.criterio_cumplimiento && <Text style={{ marginLeft: 38, fontSize: 12, color: Colores.alerta }}>{it.criterio_cumplimiento}</Text>}
      {r?.no_aplica_automatico && <Text style={{ marginLeft: 38, fontSize: 12, color: Colores.gris }}>No aplica según las variantes del equipo</Text>}
      {it.pendiente && (
        <View style={{ marginLeft: 38, flexDirection: 'row', alignItems: 'center', gap: 4 }}>
          <Icon nombre="cellphone-arrow-down" tam={14} color={Colores.alerta} />
          <Text style={{ fontSize: 11, color: Colores.alerta }}>Guardado en el teléfono, pendiente de enviar</Text>
        </View>
      )}
      <View style={{ marginLeft: 38, gap: 8 }}>
        {segundaVisita ? (
          <>
            {r?.observacion && <Text style={{ fontSize: 12, color: Colores.gris }}>Hallazgo 1ª visita: {r.observacion}</Text>}
            <SegmentedButtons
              value={r?.estado_segunda_visita ?? ''}
              onValueChange={(v) => editable && guardar({ estado_segunda_visita: v })}
              buttons={[
                { value: 'CORREGIDO', label: 'Corregido', icon: 'check', disabled: !editable,
                  style: r?.estado_segunda_visita === 'CORREGIDO' ? { backgroundColor: '#D4EDDA' } : undefined },
                { value: 'NO_CORREGIDO', label: 'No corregido', icon: 'close', disabled: !editable,
                  style: r?.estado_segunda_visita === 'NO_CORREGIDO' ? { backgroundColor: '#F8D7DA' } : undefined },
              ]}
            />
            <CampoDiferido label="Observación segunda visita" valor={r?.observacion_segunda_visita ?? ''}
              disabled={!editable || !r?.estado_segunda_visita} multiline
              onGuardar={(t) => guardar({ observacion_segunda_visita: t || null })} />
          </>
        ) : (
          <>
            <SegmentedButtons
              value={resultado}
              onValueChange={(v) => editable && guardar({ resultado: v || 'NO_VERIFICADO' })}
              buttons={(['CUMPLE', 'NO_CUMPLE', 'NO_APLICA'] as const).map((v) => ({
                value: v, label: v === 'CUMPLE' ? 'Cumple' : v === 'NO_CUMPLE' ? 'No cumple' : 'N/A', disabled: !editable,
                style: resultado === v ? { backgroundColor: FONDO_RESULTADO[v] } : undefined,
              }))}
            />
            {it.requiere_medicion && resultado !== 'NO_APLICA' && (
              <CampoDiferido label={`Medida *${it.unidad_medida ? ` (${it.unidad_medida})` : ''}`} valor={r?.valor_medido ?? ''}
                keyboardType="decimal-pad" disabled={!editable} style={{ maxWidth: 220 }}
                onGuardar={(t) => guardar({ valor_medido: t.trim() || null, unidad_medida: it.unidad_medida ?? null })} />
            )}
            {(resultado === 'NO_CUMPLE' || !!r?.observacion) && (
              <CampoDiferido label="Observación del hallazgo" valor={r?.observacion ?? ''} multiline disabled={!editable}
                onGuardar={(t) => guardar({ observacion: t || null })} />
            )}
            {sinFoto && <Text style={{ color: Colores.error, fontSize: 12 }}>Agregue al menos una foto de evidencia de esta no conformidad (va en el informe).</Text>}
          </>
        )}
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
          {editable && (
            <Button compact icon="camera-plus-outline" mode="outlined"
              onPress={() => agregarFotos(d, idInspeccion, { idItem: it.id_item, descripcion: segundaVisita ? 'Corrección 2ª visita' : undefined })}>
              {segundaVisita ? 'Foto de la corrección' : `Foto (${fotos.length})`}
            </Button>
          )}
          {fotos.map((f) => (
            <View key={f.clave}>
              <Image source={{ uri: f.uri }} style={{ width: 60, height: 60, borderRadius: 6, backgroundColor: Colores.borde }} />
              {f.pendiente && (
                <View style={{ position: 'absolute', right: 2, bottom: 2, backgroundColor: aclarar('#000000', 0.55), borderRadius: 8, padding: 2 }}>
                  <Icon nombre="cloud-upload-outline" tam={12} color="#fff" />
                </View>
              )}
            </View>
          ))}
        </View>
      </View>
    </View>
  );
});
