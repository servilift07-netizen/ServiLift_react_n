// Certificados: informes conformes (de 1ª o 2ª visita) que esperan certificado, y certificados emitidos.
import { Stack } from 'expo-router';
import { useState } from 'react';
import { RefreshControl, View } from 'react-native';
import { Button, Text, TextInput } from 'react-native-paper';

import { Api } from '@/api/cliente';
import { Contenido, EstadoCarga, EstadoChip, Fila, Icon, Tarjeta, Vacio } from '@/componentes/Comunes';
import { useDialogos } from '@/componentes/Dialogos';
import { BotonHistorial } from '@/componentes/Historial';
import { useCarga } from '@/hooks/useCarga';
import { Colores, fecha } from '@/tema';

export function CertificadosPendientes() {
  const d = useDialogos();
  const c = useCarga<any[]>(() => Api.get('/certificados/pendientes'), []);
  return (
    <>
      <Stack.Screen options={{ title: 'Certificados por elaborar' }} />
      {!c.datos ? <EstadoCarga error={c.error} onReintentar={c.recargar} /> : (
        <Contenido refreshControl={<RefreshControl refreshing={false} onRefresh={c.recargar} />}>
          {!c.datos.length && <Vacio texto="No hay certificados por elaborar" icono="certificate-outline" />}
          {c.datos.map((inf) => (
            <Tarjeta key={inf.id_informe}>
              <Text style={{ fontSize: 16, fontWeight: '800', color: Colores.navy }}>{inf.edificio} · {inf.servicio.equipo.identificacion}</Text>
              <Text>{inf.cliente} · {inf.numero_cotizacion} · {inf.norma}</Text>
              <Text style={{ color: Colores.gris }}>
                Informe {inf.numero_informe} ({inf.numero_visita}ª visita) · conforme · aprobado {fecha(inf.fecha_aprobacion)}
              </Text>
              <Fila style={{ marginTop: 8 }}>
                <Button mode="outlined" icon="file-pdf-box" onPress={() => d.ejecutar(() => Api.abrirPdf(`/informes/${inf.id_informe}/enlace-pdf`))}>
                  Ver informe
                </Button>
                <BotonHistorial idCotizacionEquipo={inf.servicio.id_cotizacion_equipo} />
                <Button mode="contained" icon="certificate" onPress={async () => {
                  if (!(await d.confirmar('Emitir certificado', 'Se genera el certificado con número consecutivo, vigencia y código QR de verificación.', 'Emitir'))) return;
                  let cert: any;
                  if (await d.ejecutar(async () => { cert = await d.progreso('Generando certificado…', () => Api.post('/certificados', { id_informe: inf.id_informe })); },
                    { exito: 'Certificado emitido' })) {
                    await d.ejecutar(() => Api.abrirPdf(`/certificados/${cert.id_certificado}/enlace-pdf`));
                    void c.recargar();
                  }
                }}>Elaborar certificado</Button>
              </Fila>
            </Tarjeta>
          ))}
        </Contenido>
      )}
    </>
  );
}

export default function CertificadosEmitidos() {
  const d = useDialogos();
  const [texto, setTexto] = useState('');
  const [numero, setNumero] = useState('');
  const c = useCarga<any[]>(() => Api.get('/certificados', { numero_cotizacion: numero }), [numero]);
  return (
    <>
      <Stack.Screen options={{ title: 'Certificados emitidos' }} />
      <Contenido refreshControl={<RefreshControl refreshing={false} onRefresh={c.recargar} />}>
        <TextInput mode="outlined" dense label="Número de cotización" value={texto} onChangeText={setTexto}
          onSubmitEditing={() => setNumero(texto.trim())} left={<TextInput.Icon tabIndex={-1} icon="magnify" />} />
        {!c.datos ? <EstadoCarga error={c.error} onReintentar={c.recargar} />
          : !c.datos.length ? <Vacio texto="No hay certificados" />
            : c.datos.map((x) => (
              <Tarjeta key={x.id_certificado}>
                <Fila>
                  <Icon nombre="certificate" color={Colores.acento} />
                  <View style={{ flex: 1, minWidth: 200 }}>
                    <Text style={{ fontWeight: '700' }}>{x.numero_certificado} · {x.edificio} · {x.servicio.equipo.identificacion}</Text>
                    <Text style={{ fontSize: 12, color: Colores.gris }}>
                      {x.cliente} · {x.numero_cotizacion} · {x.norma}{'\n'}Emitido {fecha(x.fecha_emision)} · vence {fecha(x.fecha_vencimiento)}
                      {' '}· informe {x.numero_informe}
                    </Text>
                  </View>
                  <EstadoChip estado={x.estado} />
                  <BotonHistorial idCotizacionEquipo={x.id_cotizacion_equipo} compacto />
                </Fila>
                <Fila style={{ justifyContent: 'flex-end', marginTop: 6 }}>
                  <Button icon="file-pdf-box" onPress={() => d.ejecutar(() => Api.abrirPdf(`/certificados/${x.id_certificado}/enlace-pdf`))}>PDF</Button>
                  {x.estado === 'EMITIDO' && (
                    <Button mode="contained" icon="send" onPress={async () => {
                      if (await d.confirmar('Enviar al cliente', `El cliente podrá ver y descargar el certificado ${x.numero_certificado}.`, 'Enviar')
                        && await d.ejecutar(() => Api.post(`/certificados/${x.id_certificado}/enviar`), { exito: 'Certificado enviado al cliente' })) {
                        void c.recargar();
                      }
                    }}>Enviar</Button>
                  )}
                  {x.estado !== 'ANULADO' && (
                    <Button textColor={Colores.error} onPress={async () => {
                      const motivo = await d.pedirTexto('Anular certificado', { etiqueta: 'Motivo' });
                      if (motivo && await d.ejecutar(() => Api.post(`/certificados/${x.id_certificado}/anular`, { motivo }), { exito: 'Certificado anulado' })) {
                        void c.recargar();
                      }
                    }}>Anular</Button>
                  )}
                </Fila>
              </Tarjeta>
            ))}
      </Contenido>
    </>
  );
}
