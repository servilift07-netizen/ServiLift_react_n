// Firmas del inspector, del técnico de mantenimiento y del representante del edificio (por visita).
// La firma se guarda en el teléfono como trazos y se envía sola; el servidor genera la imagen.
import { Image, ScrollView, View } from 'react-native';
import { Button, Text } from 'react-native-paper';
import Svg, { Path } from 'react-native-svg';

import { url } from '@/api/cliente';
import { Icon, Icono, Tarjeta, Titulo } from '@/componentes/Comunes';
import { Campo, useDialogos } from '@/componentes/Dialogos';
import { Dibujo } from '@/componentes/LienzoFirma';
import { cola, uuid } from '@/offline/cola';
import { useSincronizacion } from '@/offline/SincronizacionContext';
import { useSesion } from '@/sesion/SesionContext';
import { Colores, fechaHora } from '@/tema';
import { firmasPendientes } from './pendientes';

// Cargo sugerido; quien firma puede ser otra persona (supervisor, guarda, auxiliar...) y se puede cambiar
const CARGO: Record<string, string> = { INSPECTOR: 'Inspector', TECNICO_MANTENIMIENTO: 'Técnico de mantenimiento' };

const TIPOS: [string, string, Icono][] = [
  ['INSPECTOR', 'Inspector', 'account-hard-hat'],
  ['TECNICO_MANTENIMIENTO', 'Técnico de mantenimiento', 'wrench-outline'],
  ['REPRESENTANTE_EDIFICIO', 'Representante del edificio', 'domain'],
];

export function VistaTrazos({ dibujo, alto = 44 }: { dibujo: Dibujo; alto?: number }) {
  const escala = alto / dibujo.alto;
  return (
    <Svg width={dibujo.ancho * escala} height={alto}>
      {dibujo.trazos.map((t, i) => (
        <Path key={i} d={t.map(([x, y], j) => `${j ? 'L' : 'M'}${(x * escala).toFixed(1)},${(y * escala).toFixed(1)}`).join(' ')}
          stroke="#000" strokeWidth={1.5} fill="none" />
      ))}
    </Svg>
  );
}

export default function FirmasTab({ insp, editable }: { insp: any; editable: boolean }) {
  const { usuario } = useSesion();
  const d = useDialogos();
  const sync = useSincronizacion();
  const visitaActual = insp.estado === 'EN_SEGUNDA_VISITA' ? 2 : insp.numero_visita ?? 1;
  const pendientes = firmasPendientes(sync.pendientesDe(insp.id_inspeccion));
  const visitas = [...new Set<number>([1, ...insp.firmas.map((f: any) => f.numero_visita), visitaActual])].sort();

  const firmar = async (tipo: string, titulo: string, visita: number) => {
    const ed = insp.datos_equipo?.edificio ?? {};
    // Inspector: el documento viene de su usuario y no se cambia. Técnico: sin documento.
    // Nombre y cargo siempre editables (a veces firma otra persona: supervisor, guarda, auxiliar...).
    const campos: Campo[] = tipo === 'INSPECTOR' ? [
      { clave: 'nombre', etiqueta: 'Nombre completo', obligatorio: true },
      { clave: 'documento', etiqueta: 'Documento', soloLectura: true },
      { clave: 'cargo', etiqueta: 'Cargo' },
    ] : tipo === 'TECNICO_MANTENIMIENTO' ? [
      { clave: 'nombre', etiqueta: 'Nombre completo', obligatorio: true },
      { clave: 'cargo', etiqueta: 'Cargo' },
      { clave: 'empresa', etiqueta: 'Empresa' },
    ] : [
      { clave: 'nombre', etiqueta: 'Nombre completo', obligatorio: true },
      { clave: 'documento', etiqueta: 'Documento' },
      { clave: 'cargo', etiqueta: 'Cargo' },
    ];
    const documento = [usuario?.tipo_documento, usuario?.documento].filter(Boolean).join(' ');
    const datos = await d.formulario({
      titulo: `Firma: ${titulo}`,
      textoGuardar: 'Continuar a la firma',
      campos,
      valores: tipo === 'INSPECTOR'
        ? { nombre: usuario?.nombre_completo ?? '', documento: usuario?.documento ? documento : 'Sin documento registrado', cargo: CARGO.INSPECTOR }
        : tipo === 'TECNICO_MANTENIMIENTO'
          ? { nombre: insp.tecnico_mantenimiento ?? '', cargo: CARGO.TECNICO_MANTENIMIENTO, empresa: insp.empresa_mantenimiento ?? '' }
          : { nombre: ed.administrador_nombre ?? '', cargo: 'Administrador(a)' },
      guardar: async (v) => v,
    });
    if (!datos) return;
    const dibujo = await d.firma(`${titulo}: ${datos.nombre}`);
    if (!dibujo) return;
    await cola.agregar({
      tipo: 'firma', idInspeccion: insp.id_inspeccion, uuid: uuid(), descripcion: `Firma: ${titulo}`,
      body: { tipo_firmante: tipo, nombre: datos.nombre,
        documento: tipo === 'REPRESENTANTE_EDIFICIO' ? datos.documento || null : null, cargo: datos.cargo || null,
        empresa: datos.empresa ?? null, dibujo, numero_visita: visita, fecha_firma: new Date().toISOString() },
    });
    d.mensaje('Firma guardada en el teléfono; se envía sola');
  };

  return (
    <ScrollView contentContainerStyle={{ padding: 12, paddingBottom: 40 }}>
      <View style={{ width: '100%', maxWidth: 800, alignSelf: 'center' }}>
        {visitas.map((v) => (
          <View key={v}>
            <Titulo texto={v === 1 ? 'Primera visita' : 'Segunda visita (cierre de hallazgos)'} />
            {TIPOS.map(([tipo, titulo, icono]) => {
              const enServidor = insp.firmas.find((f: any) => f.numero_visita === v && f.tipo_firmante === tipo);
              const local = [...pendientes].reverse().find((p) => p.body.numero_visita === v && p.body.tipo_firmante === tipo);
              const firmada = !!(enServidor || local);
              return (
                <Tarjeta key={tipo}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                    <Icon nombre={icono} color={firmada ? Colores.exito : Colores.gris} />
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontWeight: '600' }}>{titulo}</Text>
                      {local ? (
                        <>
                          <Text style={{ fontSize: 12 }}>{String(local.body.nombre)}</Text>
                          <Text style={{ fontSize: 11, color: Colores.alerta }}>Guardada en el teléfono, pendiente de enviar</Text>
                        </>
                      ) : enServidor ? (
                        <Text style={{ fontSize: 12, color: Colores.gris }}>
                          {enServidor.nombre}{enServidor.cargo ? ` · ${enServidor.cargo}` : ''}{'\n'}{fechaHora(enServidor.fecha_firma)}
                        </Text>
                      ) : <Text style={{ fontSize: 12, color: Colores.gris }}>Pendiente de firma</Text>}
                    </View>
                    {local ? <VistaTrazos dibujo={local.body.dibujo as Dibujo} />
                      : enServidor?.url ? <Image source={{ uri: url(enServidor.url) }} style={{ width: 90, height: 44 }} resizeMode="contain" /> : null}
                    {editable && v === visitaActual && (
                      <Button mode="contained-tonal" compact onPress={() => firmar(tipo, titulo, v)}>{firmada ? 'Repetir' : 'Firmar'}</Button>
                    )}
                  </View>
                </Tarjeta>
              );
            })}
          </View>
        ))}
      </View>
    </ScrollView>
  );
}
