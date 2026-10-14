// Estructura principal: menú lateral en el computador, menú desplegable en el celular.
// Las secciones dependen del rol. En la barra superior: estado de sincronización y notificaciones.
import { Href, Redirect, router, Stack, usePathname } from 'expo-router';
import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { Modal, Pressable, ScrollView, useWindowDimensions, View } from 'react-native';
import { Appbar, Badge, Divider, Text, TouchableRipple } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { alCambiarDatos, Api } from '@/api/cliente';
import { Icon, Icono } from '@/componentes/Comunes';
import { useDialogos } from '@/componentes/Dialogos';
import { AVISOS_MS } from '@/config';
import { alVolverALaApp } from '@/hooks/alVolver';
import { volver } from '@/navegacion';
import { useSincronizacion } from '@/offline/SincronizacionContext';
import { Rol, useSesion } from '@/sesion/SesionContext';
import { aclarar, Colores } from '@/tema';

interface Seccion {
  titulo: string;
  icono: Icono;
  href: Href;
}

function secciones(rol: string): Seccion[] {
  const inicio: Seccion = { titulo: 'Inicio', icono: 'view-dashboard-outline', href: '/' };
  const seguimiento: Seccion = { titulo: 'Seguimiento', icono: 'magnify', href: '/seguimiento' };
  const clientes: Seccion = { titulo: 'Clientes y edificios', icono: 'domain', href: '/clientes' };
  const cotizaciones: Seccion = { titulo: 'Cotizaciones', icono: 'file-document-outline', href: '/cotizaciones' };
  const porProgramar: Seccion = { titulo: 'Por programar', icono: 'calendar-check-outline', href: '/programacion' };
  const calendario: Seccion = { titulo: 'Calendario', icono: 'calendar-month-outline', href: '/programacion/calendario' };
  const porRevisar: Seccion = { titulo: 'Informes por revisar', icono: 'clipboard-check-outline', href: '/informes' };
  const aprobados: Seccion = { titulo: 'Informes aprobados', icono: 'clipboard-text-outline', href: '/informes/aprobados' };
  const porElaborar: Seccion = { titulo: 'Certificados por elaborar', icono: 'progress-clock', href: '/certificados' };
  const certificados: Seccion = { titulo: 'Certificados emitidos', icono: 'certificate-outline', href: '/certificados/emitidos' };
  switch (rol) {
    case Rol.asesor:
      return [inicio, seguimiento, clientes, cotizaciones];
    case Rol.cliente:
      return [inicio, { titulo: 'Mis equipos', icono: 'elevator-passenger-outline', href: '/seguimiento' }, cotizaciones];
    case Rol.programacion:
      return [inicio, porProgramar, calendario, seguimiento];
    case Rol.inspector:
      return [inicio, { titulo: 'Mi agenda', icono: 'clipboard-list-outline', href: '/agenda' },
        { titulo: 'Sincronización', icono: 'cloud-sync-outline', href: '/sincronizacion' }, seguimiento];
    case Rol.director:
      return [inicio, porRevisar, aprobados, seguimiento];
    case Rol.certificados:
      return [inicio, porElaborar, certificados, seguimiento];
    default: // ADMIN
      return [inicio, { titulo: 'Usuarios', icono: 'account-cog-outline', href: '/admin/usuarios' },
        { titulo: 'Normas y checklist', icono: 'book-open-variant', href: '/admin/normas' },
        { titulo: 'Parámetros', icono: 'tune', href: '/admin/parametros' },
        seguimiento, clientes, cotizaciones, porProgramar, calendario, porRevisar, porElaborar, certificados];
  }
}

const MenuContexto = createContext<{ abrir: () => void; ancho: boolean }>({ abrir: () => undefined, ancho: false });

function Menu({ alElegir }: { alElegir?: () => void }) {
  const { usuario, salir } = useSesion();
  const d = useDialogos();
  const ruta = usePathname();
  const lista = secciones(usuario?.rol ?? '');
  const ir = (href: Href) => {
    alElegir?.();
    router.replace(href);
  };
  return (
    <ScrollView style={{ flex: 1, backgroundColor: '#fff' }}>
      <View style={{ backgroundColor: Colores.navy, padding: 20, paddingTop: 28 }}>
        <Text style={{ color: '#fff', fontSize: 22, fontWeight: '800' }}>ServiLift</Text>
        <Text style={{ color: '#fff', marginTop: 6 }}>{usuario?.nombre_completo}</Text>
        <Text style={{ color: '#ffffffb0', fontSize: 12 }}>{usuario?.rol_nombre ?? usuario?.rol}</Text>
      </View>
      {lista.map((sec) => {
        const activo = ruta === sec.href;
        return (
          <TouchableRipple key={sec.titulo} onPress={() => ir(sec.href)}
            style={{ backgroundColor: activo ? aclarar(Colores.acento, 0.1) : undefined }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16, paddingHorizontal: 20, paddingVertical: 13 }}>
              <Icon nombre={sec.icono} color={activo ? Colores.acento : Colores.gris} />
              <Text style={{ color: activo ? Colores.acento : undefined, fontWeight: activo ? '700' : '400' }}>{sec.titulo}</Text>
            </View>
          </TouchableRipple>
        );
      })}
      <Divider style={{ marginVertical: 8 }} />
      <TouchableRipple onPress={async () => {
        alElegir?.();
        await d.formulario({
          titulo: 'Cambiar contraseña',
          campos: [
            { clave: 'actual', etiqueta: 'Contraseña actual', obligatorio: true, oculto: true },
            { clave: 'nueva', etiqueta: 'Nueva contraseña (mín. 6)', obligatorio: true, oculto: true },
          ],
          guardar: async (v) => {
            await Api.post('/auth/cambiar-contrasena', v);
            d.mensaje('Contraseña actualizada');
          },
        });
      }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16, paddingHorizontal: 20, paddingVertical: 13 }}>
          <Icon nombre="key-outline" /><Text>Cambiar contraseña</Text>
        </View>
      </TouchableRipple>
      <TouchableRipple onPress={async () => {
        alElegir?.();
        if (await d.confirmar('Cerrar sesión', 'Los cambios que aún no se hayan sincronizado quedan guardados en este teléfono y se enviarán cuando vuelva a ingresar.', 'Cerrar sesión')) {
          await salir();
        }
      }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16, paddingHorizontal: 20, paddingVertical: 13 }}>
          <Icon nombre="logout" /><Text>Cerrar sesión</Text>
        </View>
      </TouchableRipple>
    </ScrollView>
  );
}

/** Ícono de sincronización: todo guardado, pendientes, sin conexión o con errores. */
function EstadoSincronizacion() {
  const { enLinea, enviando, pendientes, conError } = useSincronizacion();
  let icono: Icono = 'cloud-check-outline';
  let color = '#8fe3b4';
  if (conError) [icono, color] = ['cloud-alert', '#ffb4a8'];
  else if (!enLinea) [icono, color] = ['cloud-off-outline', '#ffd59e'];
  else if (enviando || pendientes) [icono, color] = ['cloud-upload-outline', '#ffd59e'];
  return (
    <Pressable onPress={() => router.navigate('/sincronizacion')} style={{ padding: 8 }} accessibilityLabel="Sincronización">
      <Icon nombre={icono} color={color} tam={24} />
      {(pendientes > 0 || conError > 0) && (
        <Badge size={16} style={{ position: 'absolute', top: 2, right: 0, backgroundColor: conError ? Colores.error : Colores.alerta }}>
          {pendientes}
        </Badge>
      )}
    </Pressable>
  );
}

function Notificaciones() {
  const [noLeidas, setNoLeidas] = useState(0);
  const ruta = usePathname();
  const contar = useCallback(async () => {
    try {
      setNoLeidas(((await Api.get('/notificaciones', { solo_no_leidas: true })) as any[]).length);
    } catch {
      // sin señal: se mantiene el último conteo
    }
  }, []);
  useEffect(() => {
    void contar();
    const reloj = setInterval(contar, AVISOS_MS);
    return () => clearInterval(reloj);
  }, [contar, ruta]);
  // Sin esperar al intervalo: tras guardar algo y al volver a la app o a la ventana
  useEffect(() => alCambiarDatos(() => void contar()), [contar]);
  useEffect(() => alVolverALaApp(() => void contar()), [contar]);
  return (
    <Pressable onPress={() => router.navigate('/notificaciones')} style={{ padding: 8 }} accessibilityLabel="Notificaciones">
      <Icon nombre="bell-outline" color="#fff" tam={24} />
      {noLeidas > 0 && <Badge size={16} style={{ position: 'absolute', top: 2, right: 0 }}>{noLeidas}</Badge>}
    </Pressable>
  );
}

function Encabezado({ titulo, puedeVolver }: { titulo: string; puedeVolver: boolean }) {
  const { abrir, ancho } = useContext(MenuContexto);
  const ins = useSafeAreaInsets();
  return (
    <Appbar.Header style={{ backgroundColor: Colores.navy, height: 56 + ins.top, paddingTop: ins.top }} statusBarHeight={0}>
      {puedeVolver
        ? <Appbar.BackAction color="#fff" onPress={() => volver()} />
        : !ancho && <Appbar.Action icon="menu" color="#fff" onPress={abrir} />}
      <Appbar.Content title={titulo} titleStyle={{ color: '#fff', fontSize: 18, fontWeight: '600' }} />
      <EstadoSincronizacion />
      <Notificaciones />
    </Appbar.Header>
  );
}

export default function LayoutApp() {
  const { usuario } = useSesion();
  const { width } = useWindowDimensions();
  const [menuAbierto, setMenuAbierto] = useState(false);
  const ancho = width >= 900;
  if (!usuario) return <Redirect href="/login" />;
  return (
    <MenuContexto.Provider value={{ abrir: () => setMenuAbierto(true), ancho }}>
      <View style={{ flex: 1, flexDirection: 'row', backgroundColor: Colores.superficie }}>
        {ancho && (
          <View style={{ width: 260, borderRightWidth: 1, borderRightColor: Colores.borde }}>
            <Menu />
          </View>
        )}
        <View style={{ flex: 1 }}>
          <Stack
            screenOptions={{
              header: ({ options, back }) => <Encabezado titulo={options.title ?? ''} puedeVolver={!!back} />,
              contentStyle: { backgroundColor: Colores.superficie },
            }}
          />
        </View>
      </View>
      {!ancho && (
        <Modal visible={menuAbierto} transparent animationType="fade" onRequestClose={() => setMenuAbierto(false)}>
          <View style={{ flex: 1, flexDirection: 'row' }}>
            <View style={{ width: 290, maxWidth: '85%', backgroundColor: '#fff' }}>
              <Menu alElegir={() => setMenuAbierto(false)} />
            </View>
            <Pressable style={{ flex: 1, backgroundColor: '#0008' }} onPress={() => setMenuAbierto(false)} />
          </View>
        </Modal>
      )}
    </MenuContexto.Provider>
  );
}
