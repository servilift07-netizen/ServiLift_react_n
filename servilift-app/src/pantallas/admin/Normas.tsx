// Normas técnicas: NTC 5926-1:2012 vigente. Las ediciones nuevas (2021, 2026...) y las partes 2 y 3
// se registran aquí; cada una lleva su checklist (cargado en la base) y sus plazos de corrección.
import { Stack } from 'expo-router';
import { RefreshControl, View } from 'react-native';
import { Button, Text } from 'react-native-paper';

import { Api } from '@/api/cliente';
import { Contenido, Dato, EstadoCarga, EstadoChip, Fila, Tarjeta } from '@/componentes/Comunes';
import { useDialogos } from '@/componentes/Dialogos';
import { useCarga } from '@/hooks/useCarga';
import { Colores } from '@/tema';

const CAMPOS_PLAZOS = [
  { clave: 'plazo_dias_leve', etiqueta: 'Plazo defecto LEVE (días)', numero: true, obligatorio: true },
  { clave: 'plazo_dias_grave', etiqueta: 'Plazo defecto GRAVE (días)', numero: true, obligatorio: true },
  { clave: 'plazo_dias_muy_grave', etiqueta: 'Plazo defecto MUY GRAVE (días, 0 = inmediato)', numero: true, obligatorio: true },
];

export default function Normas() {
  const d = useDialogos();
  const c = useCarga<any[]>(() => Api.get('/catalogos/normas', { solo_activas: false }), [], { intervalo: null });

  const nueva = async () => {
    if (await d.formulario({
      titulo: 'Registrar edición de la norma',
      campos: [
        { clave: 'parte', etiqueta: 'Parte', obligatorio: true, inicial: '1',
          opciones: [{ valor: '1', texto: 'Parte 1 (ascensores)' }, { valor: '2', texto: 'Parte 2' }, { valor: '3', texto: 'Parte 3' }] },
        { clave: 'version', etiqueta: 'Año de la edición (ej. 2021)', numero: true, obligatorio: true },
        { clave: 'nombre', etiqueta: 'Nombre', obligatorio: true },
        { clave: 'titulo_informe', etiqueta: 'Título del informe PDF', obligatorio: true },
        ...CAMPOS_PLAZOS,
      ],
      valores: { parte: '1', plazo_dias_leve: '180', plazo_dias_grave: '30', plazo_dias_muy_grave: '0' },
      guardar: (v) => Api.post('/catalogos/normas', { ...v, parte: Number(v.parte), codigo: `NTC 5926-${v.parte}`, vigente: false }),
    })) {
      d.mensaje('Norma registrada. Cargue su checklist en la base y luego márquela como vigente.');
      void c.recargar();
    }
  };

  return (
    <View style={{ flex: 1 }}>
      <Stack.Screen options={{ title: 'Normas y checklist' }} />
      {!c.datos ? <EstadoCarga error={c.error} onReintentar={c.recargar} /> : (
        <Contenido ancho={900} refreshControl={<RefreshControl refreshing={false} onRefresh={c.recargar} />}>
          <Text style={{ color: Colores.gris, padding: 8 }}>
            Cada parte de la NTC 5926 tiene una sola edición vigente: es la que se usa en las cotizaciones nuevas.
            Los servicios ya cotizados conservan la edición con la que se cotizaron.
          </Text>
          {c.datos.map((n) => (
            <Tarjeta key={n.id_norma}>
              <Fila>
                <Text style={{ flex: 1, fontSize: 16, fontWeight: '800', color: Colores.navy }}>{n.etiqueta}</Text>
                {n.vigente ? <EstadoChip estado="APROBADO" texto="Vigente" /> : <EstadoChip estado="BORRADOR" texto={n.activo ? 'No vigente' : 'Inactiva'} />}
              </Fila>
              <Dato etiqueta="Nombre" valor={n.nombre} />
              <Dato etiqueta="Título del informe" valor={n.titulo_informe} />
              <Dato etiqueta="Checklist" valor={`${n.total_items} ítems`} />
              <Dato etiqueta="Plazos (días)" valor={`Leve ${n.plazo_dias_leve} · Grave ${n.plazo_dias_grave} · Muy grave ${n.plazo_dias_muy_grave}`} />
              <Fila style={{ justifyContent: 'flex-end' }}>
                <Button icon="pencil" onPress={async () => {
                  if (await d.formulario({
                    titulo: `Editar ${n.etiqueta}`,
                    campos: [{ clave: 'nombre', etiqueta: 'Nombre', obligatorio: true },
                      { clave: 'titulo_informe', etiqueta: 'Título del informe PDF', obligatorio: true }, ...CAMPOS_PLAZOS],
                    valores: n,
                    guardar: (v) => Api.put(`/catalogos/normas/${n.id_norma}`, v),
                  })) void c.recargar();
                }}>Editar</Button>
                {!n.vigente && n.activo && (
                  <Button mode="contained" icon="check" onPress={async () => {
                    if (await d.confirmar('Marcar como vigente', `Las cotizaciones nuevas de la parte ${n.parte} usarán ${n.etiqueta}.`)
                      && await d.ejecutar(() => Api.put(`/catalogos/normas/${n.id_norma}`, { vigente: true }), { exito: 'Norma vigente actualizada' })) {
                      void c.recargar();
                    }
                  }}>Marcar vigente</Button>
                )}
              </Fila>
            </Tarjeta>
          ))}
          <Button mode="outlined" icon="plus" style={{ marginTop: 8, alignSelf: 'flex-start' }} onPress={nueva}>Registrar edición nueva</Button>
        </Contenido>
      )}
    </View>
  );
}
