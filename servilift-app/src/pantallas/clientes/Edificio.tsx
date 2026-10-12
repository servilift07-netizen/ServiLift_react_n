// Edificio: sus datos y los equipos que existen en él (GET /equipos?id_edificio=), con su historial de servicios.
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { RefreshControl, View } from 'react-native';
import { Button, IconButton, Text } from 'react-native-paper';

import { Api } from '@/api/cliente';
import { Contenido, Dato, EstadoCarga, EstadoChip, Fila, Icon, Tarjeta, Titulo, Vacio } from '@/componentes/Comunes';
import { useDialogos } from '@/componentes/Dialogos';
import { BotonHistorial } from '@/componentes/Historial';
import { useCarga } from '@/hooks/useCarga';
import { Rol, useSesion } from '@/sesion/SesionContext';
import { Colores } from '@/tema';
import { CAMPOS_EDIFICIO, CAMPOS_EQUIPO, TIPOS_EQUIPO } from '../catalogos';

export default function Edificio() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const d = useDialogos();
  const { es } = useSesion();
  const edificio = useCarga<any>(() => Api.get(`/edificios/${id}`), [id]);
  const equipos = useCarga<any[]>(() => Api.get('/equipos', { id_edificio: id }), [id]);
  // Último servicio de cada equipo (estado actual en el proceso de certificación)
  const servicios = useCarga<any[]>(() => Api.get('/seguimiento', { id_edificio: id }), [id]);
  const e = edificio.datos;
  const recargar = () => Promise.all([edificio.recargar(), equipos.recargar(), servicios.recargar()]);
  const ultimoServicio = (idEquipo: number) => (servicios.datos ?? []).find((s) => s.id_equipo === idEquipo);

  return (
    <>
      <Stack.Screen options={{ title: e?.nombre ?? 'Edificio' }} />
      {!e ? <EstadoCarga error={edificio.error} onReintentar={edificio.recargar} /> : (
        <Contenido ancho={1000} refreshControl={<RefreshControl refreshing={false} onRefresh={recargar} />}>
          <Tarjeta>
            <Fila>
              <Text style={{ flex: 1, fontSize: 20, fontWeight: '800', color: Colores.navy }}>{e.nombre}</Text>
              {es(Rol.asesor) && (
                <IconButton icon="pencil" onPress={async () => {
                  if (await d.formulario({ titulo: 'Editar edificio', campos: CAMPOS_EDIFICIO, valores: e,
                    guardar: (v) => Api.put(`/edificios/${id}`, v) })) void edificio.recargar();
                }} />
              )}
            </Fila>
            <Dato etiqueta="Dirección" valor={[e.direccion, e.barrio, e.ciudad].filter(Boolean).join(', ')} />
            <Dato etiqueta="Pisos" valor={e.numero_pisos} />
            <Dato etiqueta="Ascensores" valor={`${e.equipos_registrados} registrados de ${e.numero_equipos} declarados`} />
            <Dato etiqueta="Representante" valor={[e.administrador_nombre, e.administrador_telefono, e.administrador_correo].filter(Boolean).join(' · ')} />
            <Dato etiqueta="Mantenimiento" valor={e.empresa_mantenimiento} />
            <Fila style={{ marginTop: 8 }}>
              <Button mode="outlined" icon="account-group-outline" onPress={() => router.push(`/clientes/${e.id_cliente}`)}>Ver cliente</Button>
              {es(Rol.asesor) && !!equipos.datos?.length && (
                <Button mode="contained" icon="file-document-edit-outline"
                  onPress={() => router.push({ pathname: '/cotizaciones/formulario', params: { idEdificio: String(e.id_edificio) } })}>
                  Nueva cotización
                </Button>
              )}
            </Fila>
          </Tarjeta>

          <Titulo texto="Equipos del edificio" accion={es(Rol.asesor) && (
            <Button icon="plus" onPress={async () => {
              if (await d.formulario({ titulo: `Nuevo ascensor en ${e.nombre}`, campos: CAMPOS_EQUIPO,
                guardar: (v) => Api.post(`/edificios/${id}/equipos`, v) })) void recargar();
            }}>Agregar ascensor</Button>
          )} />
          {!equipos.datos ? <EstadoCarga error={equipos.error} onReintentar={equipos.recargar} />
            : !equipos.datos.length ? <Vacio texto="El edificio no tiene equipos registrados" icono="elevator-passenger-outline" />
              : equipos.datos.map((q) => {
                const s = ultimoServicio(q.id_equipo);
                return (
                  <Tarjeta key={q.id_equipo}>
                    <Fila>
                      <Icon nombre="elevator-passenger-outline" tam={28} />
                      <View style={{ flex: 1, minWidth: 180 }}>
                        <Text style={{ fontWeight: '700' }}>{q.identificacion}</Text>
                        <Text style={{ fontSize: 12, color: Colores.gris }}>
                          {[TIPOS_EQUIPO.find((t) => t.valor === q.tipo_equipo)?.texto, q.marca, q.numero_serie,
                            q.capacidad_kg && `${q.capacidad_kg} kg`, q.numero_paradas && `${q.numero_paradas} paradas`].filter(Boolean).join(' · ')}
                        </Text>
                        {s && <Text style={{ fontSize: 12, color: Colores.gris }}>Último servicio: {s.codigo_servicio}</Text>}
                      </View>
                      {s && <EstadoChip estado={s.estado_equipo} texto={s.estado_etiqueta} />}
                      {s && <BotonHistorial idCotizacionEquipo={s.id_cotizacion_equipo} compacto />}
                      {es(Rol.asesor) && (
                        <IconButton icon="pencil" onPress={async () => {
                          if (await d.formulario({ titulo: `Editar ${q.identificacion}`, campos: CAMPOS_EQUIPO, valores: q,
                            guardar: (v) => Api.put(`/equipos/${q.id_equipo}`, v) })) void equipos.recargar();
                        }} />
                      )}
                    </Fila>
                  </Tarjeta>
                );
              })}
        </Contenido>
      )}
    </>
  );
}
