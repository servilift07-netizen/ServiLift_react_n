// Revisión y atestación de un informe (1ª o 2ª visita): resumen, checklist, fotos; devolver o aprobar con firma.
// 1ª visita: conforme -> certificados; no conforme -> plazo y 2ª visita.
// 2ª visita: conforme solo si todo quedó corregido; si no, el equipo requiere cotización nueva.
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Image, ScrollView, View } from 'react-native';
import { Button, Chip, Text, TextInput } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Api, url } from '@/api/cliente';
import { Selector } from '@/componentes/Campos';
import { Cifra, Dato, EstadoCarga, EstadoChip, Fila, Tarjeta, Titulo } from '@/componentes/Comunes';
import { useDialogos } from '@/componentes/Dialogos';
import { BotonHistorial } from '@/componentes/Historial';
import { Segmentos } from '@/componentes/Segmentos';
import { useCarga } from '@/hooks/useCarga';
import { Colores, etiqueta, fecha, fechaHora } from '@/tema';
import ChecklistTab from '../inspeccion/ChecklistTab';
import FotosTab from '../inspeccion/FotosTab';

export default function Revision() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const d = useDialogos();
  const ins = useSafeAreaInsets();
  const [pestana, setPestana] = useState('resumen');
  const inf = useCarga<any>(() => Api.get(`/informes/${id}`), [id], { intervalo: null });
  const insp = useCarga<any>(() => (inf.datos ? Api.get(`/inspecciones/${inf.datos.id_inspeccion}`) : Promise.resolve(null)),
    [inf.datos?.id_inspeccion], { intervalo: null });
  const [aprobando, setAprobando] = useState(false);

  if (!inf.datos || !insp.datos) {
    return (<><Stack.Screen options={{ title: 'Revisión' }} /><EstadoCarga error={inf.error ?? insp.error} onReintentar={inf.recargar} /></>);
  }
  const i = inf.datos;
  const pendiente = i.estado === 'PENDIENTE_REVISION';
  const segunda = i.numero_visita === 2;

  const devolver = async () => {
    const obs = await d.pedirTexto('Devolver al inspector', { etiqueta: 'Qué debe corregir' });
    if (obs && await d.ejecutar(() => Api.post(`/informes/${id}/devolver`, { observaciones: obs }), { exito: 'Informe devuelto al inspector' })) {
      router.back();
    }
  };

  return (
    <View style={{ flex: 1 }}>
      <Stack.Screen options={{ title: `${i.numero_informe} · ${i.servicio.equipo.identificacion}` }} />
      <View style={{ backgroundColor: '#fff', padding: 12, paddingBottom: 8 }}>
        <Segmentos valor={pestana} onCambiar={setPestana}
          opciones={[{ valor: 'resumen', texto: 'Resumen' }, { valor: 'checklist', texto: 'Checklist' }, { valor: 'fotos', texto: 'Fotos' }]} />
      </View>
      <View style={{ flex: 1 }}>
        {pestana === 'resumen' && <Resumen inf={i} insp={insp.datos} irA={setPestana} />}
        {pestana === 'checklist' && <ChecklistTab idInspeccion={i.id_inspeccion} editable={pendiente} segundaVisita={segunda} />}
        {pestana === 'fotos' && <FotosTab idInspeccion={i.id_inspeccion} editable={pendiente} modoDirector={pendiente} />}
      </View>
      {pendiente && (
        <View style={{ flexDirection: 'row', gap: 10, padding: 12, paddingBottom: 12 + ins.bottom, backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: Colores.borde }}>
          <Button mode="outlined" icon="undo" style={{ flex: 1 }} onPress={devolver}>Devolver</Button>
          <Button mode="contained" icon="check-decagram" buttonColor={Colores.exito} style={{ flex: 2 }} onPress={() => setAprobando(true)}>
            Aprobar, firmar y generar PDF
          </Button>
        </View>
      )}
      {aprobando && <Aprobar inf={i} cerrar={(ok) => { setAprobando(false); if (ok) router.back(); }} />}
    </View>
  );
}

function Aprobar({ inf, cerrar }: { inf: any; cerrar: (ok: boolean) => void }) {
  const d = useDialogos();
  const r = inf.resumen_actual;
  const segunda = inf.numero_visita === 2;
  const pendientes = segunda ? r.total_no_cumple - r.corregidos : r.total_no_cumple;
  const calculado = pendientes === 0 ? 'CONFORME' : 'NO_CONFORME';
  const [concepto, setConcepto] = useState<string>(calculado);
  const [atestacion, setAtestacion] = useState('');
  const params = useCarga<any>(() => Api.get('/catalogos/parametros'), [], { intervalo: null });
  const textoAtestacion = atestacion || params.datos?.TEXTO_ATESTACION || '';

  const firmarYAprobar = async () => {
    const dibujo = await d.firma('Firma del director técnico');
    if (!dibujo) return;
    const ok = await d.ejecutar(() => d.progreso('Generando PDF…', () => Api.post(`/informes/${inf.id_informe}/aprobar`, {
      concepto: segunda ? null : concepto, atestacion: textoAtestacion.trim() || null, dibujo,
    })), { exito: 'Informe aprobado. Ya está disponible para el cliente.' });
    if (ok) {
      await d.ejecutar(() => Api.abrirPdf(`/informes/${inf.id_informe}/enlace-pdf`));
      cerrar(true);
    }
  };

  return (
    <View style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, backgroundColor: '#0008', justifyContent: 'center', padding: 12 }}>
      <View style={{ backgroundColor: '#fff', borderRadius: 16, padding: 20, maxWidth: 600, width: '100%', alignSelf: 'center', maxHeight: '92%' }}>
        <ScrollView contentContainerStyle={{ gap: 10 }}>
          <Text variant="titleLarge">Aprobar y firmar informe de {segunda ? '2ª' : '1ª'} visita</Text>
          <Text>{segunda
            ? `Segunda visita: ${r.corregidos} corregidos, ${r.no_corregidos} no corregidos de ${r.total_no_cumple} hallazgos.`
            : `Hallazgos: ${r.leves} leves, ${r.graves} graves, ${r.muy_graves} muy graves.`}</Text>
          {segunda ? <EstadoChip estado={calculado} texto={`Concepto: ${etiqueta(calculado)}`} /> : (
            <Selector etiqueta="Concepto" valor={concepto} onCambiar={(v) => v && setConcepto(v)}
              opciones={[{ valor: 'CONFORME', texto: 'Conforme' }, { valor: 'NO_CONFORME', texto: 'No conforme' }]} />
          )}
          <Text style={{ fontSize: 12, color: concepto === 'CONFORME' && !(segunda && calculado !== 'CONFORME') ? Colores.exito : Colores.error }}>
            {segunda
              ? calculado === 'CONFORME' ? 'Todos los hallazgos se corrigieron: pasa a Certificados.'
                : 'Quedan hallazgos sin corregir: el equipo queda cerrado no conforme y necesita una cotización nueva (no hay tercera visita).'
              : concepto === 'CONFORME' ? 'Pasa a Certificados para emitir el certificado.'
                : 'El certificado queda bloqueado: el cliente o el asesor solicitan la segunda visita dentro del plazo.'}
          </Text>
          <TextInput mode="outlined" label="Atestación" multiline numberOfLines={6} value={textoAtestacion} onChangeText={setAtestacion} />
          <Fila style={{ justifyContent: 'flex-end' }}>
            <Button onPress={() => cerrar(false)}>Cancelar</Button>
            <Button mode="contained" icon="draw" onPress={firmarYAprobar}>Firmar</Button>
          </Fila>
        </ScrollView>
      </View>
    </View>
  );
}

function Resumen({ inf, insp, irA }: { inf: any; insp: any; irA: (p: string) => void }) {
  const d = useDialogos();
  const dd = insp.datos_equipo ?? {};
  const r = inf.resumen_actual;
  const segunda = inf.numero_visita === 2;
  const hallazgos = useCarga<any>(() => Api.get(`/inspecciones/${insp.id_inspeccion}/checklist`), [insp.id_inspeccion], { intervalo: null });
  const nc = (hallazgos.datos?.categorias ?? []).flatMap((c: any) => c.items).filter((x: any) => x.resultado?.resultado === 'NO_CUMPLE');
  const pdf = (path: string) => d.ejecutar(() => Api.abrirPdf(path));
  return (
    <ScrollView contentContainerStyle={{ padding: 12, paddingBottom: 40 }}>
      <View style={{ width: '100%', maxWidth: 900, alignSelf: 'center' }}>
        <Tarjeta>
          <Fila>
            <Text style={{ flex: 1, fontSize: 18, fontWeight: '800' }}>{inf.numero_informe}</Text>
            <EstadoChip estado={inf.estado} />
            <BotonHistorial idCotizacionEquipo={inf.servicio.id_cotizacion_equipo} compacto />
          </Fila>
          <Dato etiqueta="Visita" valor={segunda ? 'Segunda visita (cierre de hallazgos)' : 'Primera visita'} />
          <Dato etiqueta="Norma" valor={inf.norma} />
          <Dato etiqueta="Cotización" valor={`${dd.numero_cotizacion} · ${dd.codigo_servicio}`} />
          <Dato etiqueta="Cliente" valor={dd.cliente?.razon_social} />
          <Dato etiqueta="Edificio" valor={`${dd.edificio?.nombre} · ${dd.edificio?.direccion}`} />
          <Dato etiqueta="Equipo" valor={`${dd.equipo?.identificacion} · serial ${dd.equipo?.numero_serie ?? 'NI'}`} />
          <Dato etiqueta="Inspector" valor={`${inf.inspector} · ${fechaHora(segunda ? insp.fecha_inicio_visita2 : insp.fecha_inicio)}`} />
          {inf.otro_informe && <Dato etiqueta={`Informe ${inf.otro_informe.numero_visita}ª visita`}
            valor={`${inf.otro_informe.numero_informe} · ${etiqueta(inf.otro_informe.concepto ?? inf.otro_informe.estado)}`} />}
          {inf.concepto && <Dato etiqueta="Concepto" valor={etiqueta(inf.concepto)} />}
          {inf.plazo_dias !== null && inf.plazo_dias !== undefined && inf.estado === 'APROBADO' && inf.concepto === 'NO_CONFORME' && (
            <Dato etiqueta="Plazo de corrección" valor={`${inf.plazo_dias} días (hasta ${fecha(inf.fecha_limite_correccion)})`} />
          )}
        </Tarjeta>
        <Fila style={{ marginVertical: 8 }}>
          {inf.estado !== 'APROBADO' && <Button mode="contained" icon="file-pdf-box" onPress={() => pdf(`/informes/${inf.id_informe}/vista-previa`)}>Ver borrador PDF</Button>}
          {inf.tiene_pdf && <Button mode="outlined" icon="file-pdf-box" onPress={() => pdf(`/informes/${inf.id_informe}/enlace-pdf`)}>PDF del informe</Button>}
          {inf.otro_informe?.estado === 'APROBADO' && (
            <Button mode="outlined" icon="file-pdf-box" onPress={() => pdf(`/informes/${inf.otro_informe.id_informe}/enlace-pdf`)}>
              PDF {inf.otro_informe.numero_visita}ª visita
            </Button>
          )}
          <Button mode="outlined" icon="image-multiple-outline" onPress={() => irA('fotos')}>Ver las {inf.total_fotos} fotos</Button>
          <Button mode="outlined" icon="format-list-checks" onPress={() => irA('checklist')}>Checklist completo</Button>
        </Fila>
        <Titulo texto="Resumen de hallazgos" />
        <Fila>
          <Cifra titulo="Leves" valor={r.leves} color="#2F6FB0" />
          <Cifra titulo="Graves" valor={r.graves} color={Colores.alerta} />
          <Cifra titulo="Muy graves" valor={r.muy_graves} color={Colores.error} />
          <Cifra titulo="No aplica" valor={r.no_aplica} color={Colores.gris} />
          {segunda && <Cifra titulo="Corregidos" valor={r.corregidos} color={Colores.exito} />}
          {segunda && <Cifra titulo="No corregidos" valor={r.no_corregidos} color={Colores.error} />}
        </Fila>
        <Titulo texto="Hallazgos (No cumple)" />
        {!nc.length && <Tarjeta><Text>Sin hallazgos</Text></Tarjeta>}
        {nc.map((x: any) => (
          <Tarjeta key={x.id_item}>
            <Fila>
              <Text style={{ width: 32, fontWeight: '800' }}>{x.numero}</Text>
              <Text style={{ flex: 1 }}>{x.descripcion}</Text>
              <Chip compact>{x.calificacion_corta}</Chip>
            </Fila>
            {!!x.resultado.observacion && <Text style={{ color: Colores.gris, marginLeft: 40 }}>Observación: {x.resultado.observacion}</Text>}
            {!!x.resultado.valor_medido && <Text style={{ color: Colores.gris, marginLeft: 40 }}>Medida: {x.resultado.valor_medido} {x.resultado.unidad_medida ?? ''}</Text>}
            {!!x.resultado.estado_segunda_visita && (
              <Text style={{ marginLeft: 40 }}>2ª visita: {etiqueta(x.resultado.estado_segunda_visita)}{x.resultado.observacion_segunda_visita ? ` · ${x.resultado.observacion_segunda_visita}` : ''}</Text>
            )}
            <Fila style={{ marginLeft: 40, marginTop: 6 }}>
              {x.fotos.map((f: any) => <Image key={f.id_foto} source={{ uri: url(f.url_miniatura) }} style={{ width: 80, height: 80, borderRadius: 6 }} />)}
            </Fila>
          </Tarjeta>
        ))}
        <Titulo texto="Variantes del equipo" />
        <Fila>{insp.variantes.map((v: any) => <Chip key={v.id_variante_tipo} compact>{v.tipo}: {v.opcion}</Chip>)}</Fila>
        {!!insp.observaciones_generales && (<><Titulo texto="Observaciones del inspector" /><Text>{insp.observaciones_generales}</Text></>)}
        <Titulo texto="Firmas" />
        {insp.firmas.map((f: any) => (
          <Fila key={f.id_firma} style={{ paddingVertical: 4 }}>
            <Text style={{ width: 28 }}>{f.numero_visita}ª</Text>
            <Text style={{ flex: 1 }}>{etiqueta(f.tipo_firmante)}: {f.nombre}</Text>
            <Image source={{ uri: url(f.url) }} style={{ width: 90, height: 36 }} resizeMode="contain" />
          </Fila>
        ))}
      </View>
    </ScrollView>
  );
}
