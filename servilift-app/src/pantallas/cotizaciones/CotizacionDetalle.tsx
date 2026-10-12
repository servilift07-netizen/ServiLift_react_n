// Cotización: equipos con su estado y norma, totales y acciones según el rol.
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { RefreshControl, View } from 'react-native';
import { Button, Text } from 'react-native-paper';

import { Api } from '@/api/cliente';
import { Contenido, Dato, EstadoCarga, EstadoChip, Fila, Icon, Tarjeta, Titulo } from '@/componentes/Comunes';
import { useDialogos } from '@/componentes/Dialogos';
import { BotonHistorial } from '@/componentes/Historial';
import { AvisoCotizacionNueva, BotonSolicitarSegundaVisita, PlazoCorreccion } from '@/componentes/Plazo';
import { useCarga } from '@/hooks/useCarga';
import { Rol, useSesion } from '@/sesion/SesionContext';
import { Colores, etiqueta, fecha, moneda } from '@/tema';

export default function CotizacionDetalle() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const d = useDialogos();
  const { rol, es } = useSesion();
  const c = useCarga<any>(() => Api.get(`/cotizaciones/${id}`), [id]);
  const cot = c.datos;

  const accion = async (path: string, exito: string, body?: unknown) => {
    if (await d.ejecutar(() => Api.post(`/cotizaciones/${id}/${path}`, body), { exito })) void c.recargar();
  };

  return (
    <>
      <Stack.Screen options={{ title: cot?.numero_cotizacion ?? 'Cotización' }} />
      {!cot ? <EstadoCarga error={c.error} onReintentar={c.recargar} /> : (
        <Contenido ancho={900} refreshControl={<RefreshControl refreshing={false} onRefresh={c.recargar} />}>
          <Tarjeta>
            <Fila>
              <Text style={{ flex: 1, fontSize: 22, fontWeight: '800', color: Colores.navy }}>{cot.numero_cotizacion}</Text>
              <EstadoChip estado={cot.estado} />
            </Fila>
            <Dato etiqueta="Cliente" valor={cot.cliente} />
            <Dato etiqueta="Edificio" valor={`${cot.edificio} · ${cot.edificio_detalle?.direccion ?? ''}, ${cot.edificio_detalle?.ciudad ?? ''}`} />
            <Dato etiqueta="Asesor" valor={cot.asesor} />
            <Dato etiqueta="Fecha" valor={`${fecha(cot.fecha_cotizacion)} · válida ${cot.dias_validez} días`} />
            {cot.comentario_cliente && <Dato etiqueta="Comentario del cliente" valor={cot.comentario_cliente} />}
            {cot.observaciones && <Dato etiqueta="Observaciones" valor={cot.observaciones} />}
          </Tarjeta>

          <Titulo texto="Equipos cotizados" />
          {cot.equipos.map((e: any) => (
            <Tarjeta key={e.id_cotizacion_equipo}>
              <Fila>
                <Icon nombre="elevator-passenger-outline" />
                <View style={{ flex: 1, minWidth: 200 }}>
                  <Text style={{ fontWeight: '600' }}>{e.equipo.identificacion} · {e.codigo_servicio}</Text>
                  <Text style={{ fontSize: 12, color: Colores.gris }}>
                    {etiqueta(e.tipo_servicio)} · {e.norma}{e.descripcion ? ` · ${e.descripcion}` : ''}
                    {e.id_servicio_anterior ? ' · continúa un servicio cerrado no conforme' : ''}
                  </Text>
                </View>
                <Text style={{ fontWeight: '700' }}>{moneda(e.valor)}</Text>
                <EstadoChip estado={e.estado} texto={e.estado_etiqueta} />
                <BotonHistorial idCotizacionEquipo={e.id_cotizacion_equipo} compacto />
              </Fila>
              <View style={{ gap: 6, marginTop: 4 }}>
                <PlazoCorreccion datos={e} />
                <AvisoCotizacionNueva estado={e.estado} />
                <BotonSolicitarSegundaVisita idCotizacionEquipo={e.id_cotizacion_equipo} estado={e.estado} alSolicitar={c.recargar} />
                {e.estado === 'CERRADO_NO_CONFORME' && es(Rol.asesor) && (
                  <Button mode="outlined" icon="file-replace-outline" style={{ alignSelf: 'flex-start' }}
                    onPress={() => router.push({ pathname: '/cotizaciones/formulario', params: { idEdificio: String(cot.id_edificio) } })}>
                    Crear cotización nueva para este equipo
                  </Button>
                )}
              </View>
            </Tarjeta>
          ))}

          <Tarjeta>
            <Total etiqueta="Subtotal" valor={moneda(cot.subtotal)} />
            <Total etiqueta={`IVA ${cot.iva_porcentaje}%`} valor={moneda(cot.iva_valor)} />
            <Total etiqueta="Total" valor={moneda(cot.total)} fuerte />
          </Tarjeta>

          <Fila style={{ marginTop: 12 }}>
            {es(Rol.asesor) && cot.estado === 'BORRADOR' && (
              <>
                <Button mode="outlined" icon="pencil" onPress={() => router.push({ pathname: '/cotizaciones/formulario', params: { id: String(cot.id_cotizacion) } })}>
                  Editar
                </Button>
                <Button mode="contained" icon="send" onPress={async () => {
                  if (await d.confirmar('Enviar al cliente', `La cotización ${cot.numero_cotizacion} quedará visible en el portal del cliente para su aprobación.`)) {
                    void accion('enviar-cliente', 'Cotización enviada al cliente');
                  }
                }}>Enviar al cliente</Button>
              </>
            )}
            {rol === Rol.cliente && cot.estado === 'ENVIADA_CLIENTE' && (
              <>
                <Button mode="contained" icon="check" buttonColor={Colores.exito} onPress={async () => {
                  if (await d.confirmar('Aprobar cotización', `¿Aprueba la cotización por ${moneda(cot.total)}?`, 'Aprobar')) {
                    void accion('responder', 'Cotización aprobada', { aprobada: true });
                  }
                }}>Aprobar</Button>
                <Button mode="outlined" icon="close" onPress={async () => {
                  const motivo = await d.pedirTexto('Rechazar cotización', { etiqueta: 'Motivo' });
                  if (motivo !== null) void accion('responder', 'Cotización rechazada', { aprobada: false, comentario: motivo });
                }}>Rechazar</Button>
              </>
            )}
            {es(Rol.asesor) && cot.estado === 'APROBADA_CLIENTE' && (
              <Button mode="contained" icon="calendar" onPress={async () => {
                if (await d.confirmar('Enviar a programación', 'Acepta la aprobación del cliente y envía los equipos a programación.')) {
                  void accion('enviar-programacion', 'Enviada a programación');
                }
              }}>Aceptar y enviar a programación</Button>
            )}
            {es(Rol.asesor) && ['BORRADOR', 'ENVIADA_CLIENTE', 'APROBADA_CLIENTE'].includes(cot.estado) && (
              <Button icon="cancel" textColor={Colores.error} onPress={async () => {
                const motivo = await d.pedirTexto('Anular cotización', { etiqueta: 'Motivo' });
                if (motivo !== null) void accion('anular', 'Cotización anulada', { motivo });
              }}>Anular</Button>
            )}
          </Fila>
        </Contenido>
      )}
    </>
  );
}

function Total({ etiqueta: e, valor, fuerte }: { etiqueta: string; valor: string; fuerte?: boolean }) {
  const st = { fontSize: fuerte ? 18 : 14, fontWeight: fuerte ? ('800' as const) : ('400' as const) };
  return (
    <View style={{ flexDirection: 'row', paddingVertical: 2 }}>
      <Text style={[st, { flex: 1 }]}>{e}</Text>
      <Text style={st}>{valor}</Text>
    </View>
  );
}
