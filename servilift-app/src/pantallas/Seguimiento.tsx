// Estado por equipo: búsqueda por número de cotización o por nombre de cliente / edificio / equipo.
// Para el cliente es "Mis equipos" (informes de 1ª y 2ª visita y certificado).
import { Stack } from 'expo-router';
import { useState } from 'react';
import { RefreshControl, View } from 'react-native';
import { Button, Divider, Text, TextInput } from 'react-native-paper';

import { Api } from '@/api/cliente';
import { Selector } from '@/componentes/Campos';
import { AvisoCache, Contenido, EstadoCarga, EstadoChip, Fila, Tarjeta, Vacio } from '@/componentes/Comunes';
import { useDialogos } from '@/componentes/Dialogos';
import { BotonHistorial } from '@/componentes/Historial';
import { AvisoCotizacionNueva, BotonSolicitarSegundaVisita, PlazoCorreccion } from '@/componentes/Plazo';
import { useCarga } from '@/hooks/useCarga';
import { Rol, useSesion } from '@/sesion/SesionContext';
import { Colores, etiqueta, fecha, hora } from '@/tema';

const ESTADOS = ['PENDIENTE_APROBACION', 'APROBADO_CLIENTE', 'POR_PROGRAMAR', 'PROGRAMADO', 'EN_INSPECCION', 'EN_REVISION',
  'NO_CONFORME', 'SEGUNDA_VISITA_SOLICITADA', 'INFORME_APROBADO', 'CERTIFICADO_LISTO', 'CERRADO_NO_CONFORME', 'RECHAZADO', 'ANULADO'];

export default function Seguimiento() {
  const { rol, usuario } = useSesion();
  const esCliente = rol === Rol.cliente;
  const [texto, setTexto] = useState('');
  const [filtro, setFiltro] = useState({ buscar: '', estado: null as string | null });
  const c = useCarga<any[]>(() => Api.get('/seguimiento', { buscar: filtro.buscar, estado: filtro.estado }),
    [filtro.buscar, filtro.estado], { cache: !filtro.buscar && !filtro.estado ? `seguimiento:${usuario?.id_usuario}` : null });

  const grupos = new Map<string, any[]>();
  for (const f of c.datos ?? []) {
    if (!grupos.has(f.numero_cotizacion)) grupos.set(f.numero_cotizacion, []);
    grupos.get(f.numero_cotizacion)!.push(f);
  }

  return (
    <>
      <Stack.Screen options={{ title: esCliente ? 'Mis equipos' : 'Seguimiento' }} />
      <AvisoCache visible={c.desdeCache} guardadoEn={c.guardadoEn} />
      <Contenido refreshControl={<RefreshControl refreshing={false} onRefresh={c.recargar} />}>
        <Fila style={{ marginBottom: 8 }}>
          <TextInput
            mode="outlined"
            dense
            style={{ flexGrow: 1, minWidth: 240 }}
            label="Buscar"
            placeholder="COT-2026-0001, cliente, edificio o equipo"
            value={texto}
            onChangeText={setTexto}
            onSubmitEditing={() => setFiltro((f) => ({ ...f, buscar: texto.trim() }))}
            left={<TextInput.Icon icon="magnify" />}
            right={<TextInput.Icon icon="arrow-right" onPress={() => setFiltro((f) => ({ ...f, buscar: texto.trim() }))} />}
          />
          <Selector
            style={{ flexGrow: 1, minWidth: 240 }}
            etiqueta="Estado del equipo"
            valor={filtro.estado}
            permitirVacio
            opciones={ESTADOS.map((e) => ({ valor: e, texto: etiqueta(e) }))}
            onCambiar={(v) => setFiltro((f) => ({ ...f, estado: v }))}
          />
        </Fila>
        {!c.datos ? <EstadoCarga error={c.error} onReintentar={c.recargar} />
          : !c.datos.length ? <Vacio texto={esCliente ? 'Aún no tiene equipos en proceso' : 'No hay resultados'} />
            : [...grupos.entries()].map(([numero, filas]) => (
              <Tarjeta key={numero}>
                <Fila>
                  <Text style={{ fontSize: 16, fontWeight: '800', color: Colores.navy }}>{numero}</Text>
                  <Text style={{ flexShrink: 1 }}>{filas[0].cliente} · {filas[0].edificio}</Text>
                </Fila>
                <Divider style={{ marginVertical: 8 }} />
                {filas.map((f) => <FilaEquipo key={f.id_cotizacion_equipo} f={f} recargar={c.recargar} />)}
              </Tarjeta>
            ))}
      </Contenido>
    </>
  );
}

function FilaEquipo({ f, recargar }: { f: any; recargar: () => void }) {
  const d = useDialogos();
  const prog = f.fecha_programada
    ? `${f.tipo_visita === 'SEGUNDA' ? '2ª visita' : 'Visita'} ${fecha(f.fecha_programada)} ${hora(f.hora_inicio)}${f.inspector ? ` · ${f.inspector}` : ''}`
    : null;
  const pdf = (path: string) => d.ejecutar(() => Api.abrirPdf(path));
  return (
    <View style={{ paddingVertical: 8, gap: 6 }}>
      <Fila>
        <View style={{ minWidth: 220, flexGrow: 1 }}>
          <Text style={{ fontWeight: '700' }}>{f.equipo}</Text>
          <Text style={{ fontSize: 12, color: Colores.gris }}>{f.codigo_servicio} · {f.norma}</Text>
          {prog && <Text style={{ fontSize: 12, color: Colores.gris }}>{prog}</Text>}
        </View>
        <EstadoChip estado={f.estado_equipo} texto={f.estado_etiqueta} />
        <BotonHistorial idCotizacionEquipo={f.id_cotizacion_equipo} compacto />
      </Fila>
      <PlazoCorreccion datos={f} />
      <AvisoCotizacionNueva estado={f.estado_equipo} />
      <Fila>
        <BotonSolicitarSegundaVisita idCotizacionEquipo={f.id_cotizacion_equipo} estado={f.estado_equipo} alSolicitar={recargar} />
        {f.informe_visita1 && (
          <Button mode="outlined" compact icon="file-pdf-box" onPress={() => pdf(`/informes/${f.id_informe_v1}/enlace-pdf`)}>
            Informe 1ª visita
          </Button>
        )}
        {f.informe_visita2 && (
          <Button mode="outlined" compact icon="file-pdf-box" onPress={() => pdf(`/informes/${f.id_informe_v2}/enlace-pdf`)}>
            Informe 2ª visita
          </Button>
        )}
        {f.id_certificado && f.estado_certificado && (
          <Button mode="contained" compact icon="certificate" onPress={() => pdf(`/certificados/${f.id_certificado}/enlace-pdf`)}>
            Certificado {f.numero_certificado ?? ''}
          </Button>
        )}
      </Fila>
    </View>
  );
}
