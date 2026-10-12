// Usuarios: solo el administrador crea usuarios, cambia roles y restablece contraseñas.
import { Stack } from 'expo-router';
import { RefreshControl, View } from 'react-native';
import { FAB, IconButton, List } from 'react-native-paper';

import { Api } from '@/api/cliente';
import { Campo, useDialogos } from '@/componentes/Dialogos';
import { Contenido, EstadoCarga, EstadoChip, Tarjeta } from '@/componentes/Comunes';
import { useCarga } from '@/hooks/useCarga';
import { Colores } from '@/tema';
import { ROLES } from '../catalogos';

export default function Usuarios() {
  const d = useDialogos();
  const c = useCarga<any[]>(() => Api.get('/usuarios'), []);

  const clientes = async () => ((await Api.get('/clientes')) as any[])
    .map((x) => ({ valor: String(x.id_cliente), texto: `${x.razon_social} (${x.numero_documento})` }));

  const conCliente = (v: Record<string, any>): Record<string, any> => ({ ...v, id_cliente: v.id_cliente ? Number(v.id_cliente) : null });

  const crear = async () => {
    const opcionesCliente = await clientes();
    const campos: Campo[] = [
      { clave: 'rol', etiqueta: 'Rol', obligatorio: true, opciones: ROLES },
      { clave: 'nombre_completo', etiqueta: 'Nombre completo', obligatorio: true },
      { clave: 'correo', etiqueta: 'Correo', obligatorio: true },
      { clave: 'contrasena', etiqueta: 'Contraseña (mín. 6)', obligatorio: true, oculto: true },
      { clave: 'id_cliente', etiqueta: 'Cliente (solo para rol Cliente)', opciones: opcionesCliente },
      { clave: 'documento', etiqueta: 'Documento' },
      { clave: 'telefono', etiqueta: 'Teléfono' },
      { clave: 'cargo', etiqueta: 'Cargo' },
      { clave: 'matricula_profesional', etiqueta: 'Matrícula profesional' },
    ];
    if (await d.formulario({ titulo: 'Nuevo usuario', campos, guardar: (v) => Api.post('/usuarios', conCliente(v)) })) void c.recargar();
  };

  const editar = async (u: any) => {
    const opcionesCliente = await clientes();
    const campos: Campo[] = [
      { clave: 'rol', etiqueta: 'Rol', obligatorio: true, opciones: ROLES },
      { clave: 'nombre_completo', etiqueta: 'Nombre completo', obligatorio: true },
      { clave: 'id_cliente', etiqueta: 'Cliente (solo para rol Cliente)', opciones: opcionesCliente },
      { clave: 'estado', etiqueta: 'Estado', obligatorio: true, opciones: [{ valor: 'ACTIVO', texto: 'Activo' }, { valor: 'INACTIVO', texto: 'Inactivo' }] },
      { clave: 'telefono', etiqueta: 'Teléfono' },
      { clave: 'cargo', etiqueta: 'Cargo' },
      { clave: 'matricula_profesional', etiqueta: 'Matrícula profesional' },
      { clave: 'contrasena', etiqueta: 'Nueva contraseña (vacío = no cambiarla)', oculto: true },
    ];
    const ok = await d.formulario({
      titulo: `Editar ${u.correo}`, campos, valores: { ...u, id_cliente: u.id_cliente ? String(u.id_cliente) : '', contrasena: '' },
      guardar: (v) => {
        const datos = conCliente(v);
        if (!datos.contrasena) delete datos.contrasena;
        return Api.put(`/usuarios/${u.id_usuario}`, datos);
      },
    });
    if (ok) void c.recargar();
  };

  return (
    <View style={{ flex: 1 }}>
      <Stack.Screen options={{ title: 'Usuarios' }} />
      {!c.datos ? <EstadoCarga error={c.error} onReintentar={c.recargar} /> : (
        <Contenido refreshControl={<RefreshControl refreshing={false} onRefresh={c.recargar} />}>
          {c.datos.map((u) => (
            <Tarjeta key={u.id_usuario} style={u.estado !== 'ACTIVO' ? { backgroundColor: Colores.superficie } : undefined}>
              <List.Item style={{ paddingHorizontal: 0 }} title={u.nombre_completo} titleStyle={{ fontWeight: '700' }}
                description={`${u.correo} · ${u.rol_nombre}`}
                right={() => (
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    {u.estado !== 'ACTIVO' && <EstadoChip estado="ANULADO" texto="Inactivo" />}
                    <IconButton icon="pencil" onPress={() => editar(u)} />
                  </View>
                )} />
            </Tarjeta>
          ))}
        </Contenido>
      )}
      <FAB icon="account-plus" label="Nuevo usuario" style={{ position: 'absolute', right: 16, bottom: 16 }} onPress={crear} />
    </View>
  );
}
