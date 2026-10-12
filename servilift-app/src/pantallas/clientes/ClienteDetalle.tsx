// Cliente: datos, usuarios del portal y sus edificios.
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { RefreshControl } from 'react-native';
import { Button, IconButton, List, Text } from 'react-native-paper';

import { Api } from '@/api/cliente';
import { Contenido, Dato, EstadoCarga, Fila, Icon, Tarjeta, Titulo, Vacio } from '@/componentes/Comunes';
import { useDialogos } from '@/componentes/Dialogos';
import { useCarga } from '@/hooks/useCarga';
import { Rol, useSesion } from '@/sesion/SesionContext';
import { Colores } from '@/tema';
import { CAMPOS_CLIENTE, CAMPOS_EDIFICIO } from '../catalogos';

export default function ClienteDetalle() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const d = useDialogos();
  const { rol, es } = useSesion();
  const c = useCarga<any>(() => Api.get(`/clientes/${id}`), [id]);
  const cl = c.datos;

  const nuevoEdificio = async () => {
    const e = await d.formulario({ titulo: 'Nuevo edificio', campos: CAMPOS_EDIFICIO, guardar: (v) => Api.post(`/clientes/${id}/edificios`, v) });
    if (e?.numero_equipos > 0 && await d.confirmar('Registrar ascensores',
      `¿Crear ${e.numero_equipos} ascensores (Ascensor 1, 2, ...) para completar sus datos después?`, 'Crear')) {
      await d.ejecutar(() => Api.post(`/edificios/${e.id_edificio}/equipos/generar`));
    }
    void c.recargar();
  };

  return (
    <>
      <Stack.Screen options={{ title: 'Cliente' }} />
      {!cl ? <EstadoCarga error={c.error} onReintentar={c.recargar} /> : (
        <Contenido ancho={1000} refreshControl={<RefreshControl refreshing={false} onRefresh={c.recargar} />}>
          <Tarjeta>
            <Fila>
              <Text style={{ flex: 1, fontSize: 20, fontWeight: '800', color: Colores.navy }}>{cl.razon_social}</Text>
              {es(Rol.asesor) && (
                <IconButton icon="pencil" onPress={async () => {
                  if (await d.formulario({ titulo: 'Editar cliente', campos: CAMPOS_CLIENTE, valores: cl, guardar: (v) => Api.put(`/clientes/${id}`, v) })) {
                    void c.recargar();
                  }
                }} />
              )}
            </Fila>
            <Dato etiqueta="Documento" valor={`${cl.tipo_documento} ${cl.numero_documento}`} />
            <Dato etiqueta="Contacto" valor={[cl.contacto_nombre, cl.contacto_cargo, cl.contacto_telefono, cl.contacto_correo].filter(Boolean).join(' · ')} />
            <Dato etiqueta="Dirección" valor={`${cl.direccion ?? ''} ${cl.ciudad ?? ''}`} />
            <Dato etiqueta="Asesor" valor={cl.asesor} />
          </Tarjeta>

          <Titulo texto="Acceso al portal del cliente" accion={rol === Rol.admin && (
            <Button icon="account-plus" onPress={async () => {
              if (await d.formulario({
                titulo: 'Usuario del portal',
                campos: [
                  { clave: 'nombre_completo', etiqueta: 'Nombre completo', obligatorio: true },
                  { clave: 'correo', etiqueta: 'Correo', obligatorio: true },
                  { clave: 'contrasena', etiqueta: 'Contraseña inicial (mín. 6)', obligatorio: true, oculto: true },
                  { clave: 'cargo', etiqueta: 'Cargo' },
                  { clave: 'telefono', etiqueta: 'Teléfono' },
                ],
                guardar: (v) => Api.post(`/clientes/${id}/usuarios`, v),
              })) void c.recargar();
            }}>Crear usuario</Button>
          )} />
          {!cl.usuarios.length && (
            <Tarjeta>
              <Fila>
                <Icon nombre="information-outline" color={Colores.alerta} />
                <Text style={{ flex: 1 }}>Sin usuarios. El administrador debe crear uno para poder enviarle cotizaciones.</Text>
              </Fila>
            </Tarjeta>
          )}
          {cl.usuarios.map((u: any) => (
            <Tarjeta key={u.id_usuario}>
              <List.Item style={{ paddingHorizontal: 0 }} title={u.nombre_completo} description={u.correo} left={() => <Icon nombre="account-outline" />} />
            </Tarjeta>
          ))}

          <Titulo texto="Edificios" accion={es(Rol.asesor) && <Button icon="domain-plus" onPress={nuevoEdificio}>Agregar edificio</Button>} />
          {!cl.edificios.length && <Vacio texto="Agregue el primer edificio del cliente" icono="domain" />}
          {cl.edificios.map((e: any) => (
            <Tarjeta key={e.id_edificio} onPress={() => router.push(`/clientes/edificio/${e.id_edificio}`)}>
              <List.Item style={{ paddingHorizontal: 0 }} title={e.nombre} titleStyle={{ fontWeight: '700' }}
                description={`${e.direccion}, ${e.ciudad} · ${e.equipos.length} de ${e.numero_equipos} ascensores registrados`}
                left={() => <Icon nombre="office-building-outline" color={Colores.acento} />} right={() => <Icon nombre="chevron-right" />} />
            </Tarjeta>
          ))}
        </Contenido>
      )}
    </>
  );
}
