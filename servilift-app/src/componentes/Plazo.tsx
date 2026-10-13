// Plazo para corregir los hallazgos y solicitar la segunda visita (solo existen dos visitas por servicio).
import { View } from 'react-native';
import { Button, Text } from 'react-native-paper';

import { Api } from '@/api/cliente';
import { Rol, useSesion } from '@/sesion/SesionContext';
import { DatosPlazo, nivelPlazo, textoPlazo } from '@/logica/plazo';
import { aclarar, Colores } from '@/tema';
import { Icon } from './Comunes';
import { useDialogos } from './Dialogos';

export function PlazoCorreccion({ datos }: { datos: DatosPlazo }) {
  const texto = textoPlazo(datos);
  if (texto === null) return null;
  const nivel = nivelPlazo(datos.dias_restantes as number);
  const color = nivel === 'vencido' || nivel === 'urgente' ? Colores.error : nivel === 'proximo' ? Colores.alerta : Colores.info;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: aclarar(color, 0.1), borderRadius: 8,
      paddingHorizontal: 8, paddingVertical: 4, alignSelf: 'flex-start' }}>
      <Icon nombre="timer-outline" tam={16} color={color} />
      <Text style={{ color, fontSize: 12, fontWeight: '600', flexShrink: 1 }}>{texto}</Text>
    </View>
  );
}

/** "Solicitar segunda visita" (cliente o asesor) cuando el informe de 1ª visita quedó no conforme. */
export function BotonSolicitarSegundaVisita({ idCotizacionEquipo, estado, alSolicitar }: {
  idCotizacionEquipo: number;
  estado: string;
  alSolicitar?: () => void;
}) {
  const { rol } = useSesion();
  const d = useDialogos();
  if (estado !== 'NO_CONFORME' || ![Rol.cliente, Rol.asesor, Rol.admin].includes(rol as any)) return null;
  return (
    <Button
      mode="contained"
      icon="calendar-refresh"
      buttonColor={Colores.alerta}
      onPress={async () => {
        const comentario = await d.pedirTexto('Solicitar segunda visita',
          { etiqueta: 'Comentario (ej. hallazgos corregidos el 10/10)', obligatorio: false });
        if (comentario === null) return;
        if (await d.ejecutar(() => Api.post(`/seguimiento/equipo/${idCotizacionEquipo}/solicitar-segunda-visita`,
          { comentario: comentario || null }), { exito: 'Segunda visita solicitada. Programación fue notificada.' })) {
          alSolicitar?.();
        }
      }}
    >
      Solicitar segunda visita
    </Button>
  );
}

/** Aviso del equipo que falló la segunda visita: necesita una cotización nueva (otra primera visita). */
export function AvisoCotizacionNueva({ estado }: { estado: string }) {
  if (estado !== 'CERRADO_NO_CONFORME') return null;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: aclarar(Colores.error, 0.1),
      borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4, alignSelf: 'flex-start' }}>
      <Icon nombre="file-replace-outline" tam={16} color={Colores.error} />
      <Text style={{ color: Colores.error, fontSize: 12, fontWeight: '600', flexShrink: 1 }}>
        Hallazgos sin corregir en la 2ª visita: requiere cotización nueva
      </Text>
    </View>
  );
}
