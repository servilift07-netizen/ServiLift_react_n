// Parámetros generales (solo administrador): datos de la empresa, textos del informe y vigencia del certificado.
// Los plazos de corrección se configuran por norma (Normas y checklist).
import { Stack } from 'expo-router';
import { List } from 'react-native-paper';

import { Api } from '@/api/cliente';
import { Contenido, EstadoCarga, Icon, Tarjeta } from '@/componentes/Comunes';
import { useDialogos } from '@/componentes/Dialogos';
import { useCarga } from '@/hooks/useCarga';

const ETIQUETAS: Record<string, string> = {
  EMPRESA_NOMBRE: 'Nombre de la empresa (informes y certificados)',
  EMPRESA_NIT: 'NIT de la empresa',
  CERTIFICADO_VIGENCIA_MESES: 'Vigencia del certificado (meses)',
  INFORME_CODIGO_FORMATO: 'Código del formato',
  INFORME_VERSION_FORMATO: 'Versión del formato',
  TEXTO_ATESTACION: 'Texto de atestación',
  CONVENCION_RESULTADOS: 'Convención de resultados',
  FOTOS_MAX_POR_EQUIPO: 'Máximo de fotos por equipo',
};

export default function Parametros() {
  const d = useDialogos();
  const c = useCarga<Record<string, string>>(() => Api.get('/catalogos/parametros'), [], { intervalo: null });
  const claves = c.datos ? [...Object.keys(ETIQUETAS).filter((k) => k in c.datos!), ...Object.keys(c.datos).filter((k) => !(k in ETIQUETAS))] : [];
  return (
    <>
      <Stack.Screen options={{ title: 'Parámetros' }} />
      {!c.datos ? <EstadoCarga error={c.error} onReintentar={c.recargar} /> : (
        <Contenido ancho={900}>
          {claves.map((k) => (
            <Tarjeta key={k} onPress={async () => {
              if (await d.formulario({
                titulo: ETIQUETAS[k] ?? k,
                campos: [{ clave: 'valor', etiqueta: 'Valor', obligatorio: true, multilinea: k === 'TEXTO_ATESTACION',
                  numero: k.endsWith('MESES') || k.startsWith('FOTOS') }],
                valores: { valor: c.datos![k] },
                guardar: (v) => Api.put(`/catalogos/parametros/${k}`, { valor: String(v.valor) }),
              })) void c.recargar();
            }}>
              <List.Item style={{ paddingHorizontal: 0 }} title={ETIQUETAS[k] ?? k} description={c.datos![k] || '(vacío)'}
                descriptionNumberOfLines={3} right={() => <Icon nombre="pencil" />} />
            </Tarjeta>
          ))}
        </Contenido>
      )}
    </>
  );
}
