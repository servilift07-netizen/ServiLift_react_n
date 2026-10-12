// Listas fijas y formularios compartidos entre pantallas.
import type { Campo } from '@/componentes/Dialogos';

export const TIPOS_EQUIPO = [
  { valor: 'ASCENSOR_PASAJEROS', texto: 'Ascensor de pasajeros' },
  { valor: 'ASCENSOR_CARGA', texto: 'Ascensor de carga' },
  { valor: 'MONTACARGAS', texto: 'Montacargas' },
  { valor: 'MONTACAMILLAS', texto: 'Montacamillas' },
  { valor: 'ASCENSOR_VEHICULAR', texto: 'Ascensor vehicular' },
  { valor: 'OTRO', texto: 'Otro' },
];

export const TIPOS_SERVICIO = [
  { valor: 'INSPECCION_PERIODICA', texto: 'Inspección periódica' },
  { valor: 'INSPECCION_INICIAL', texto: 'Inspección inicial' },
  { valor: 'REINSPECCION', texto: 'Reinspección' },
  { valor: 'EXTRAORDINARIA', texto: 'Extraordinaria' },
];

export const ROLES = [
  { valor: 'ADMIN', texto: 'Administrador' },
  { valor: 'ASESOR', texto: 'Asesor' },
  { valor: 'PROGRAMACION', texto: 'Programación' },
  { valor: 'INSPECTOR', texto: 'Inspector' },
  { valor: 'DIRECTOR_TECNICO', texto: 'Director técnico' },
  { valor: 'CERTIFICADOS', texto: 'Certificados' },
  { valor: 'CLIENTE', texto: 'Cliente' },
];

export const CAMPOS_CLIENTE: Campo[] = [
  { clave: 'tipo_documento', etiqueta: 'Tipo de documento', obligatorio: true, inicial: 'NIT',
    opciones: [{ valor: 'NIT', texto: 'NIT' }, { valor: 'CC', texto: 'Cédula' }, { valor: 'CE', texto: 'Cédula de extranjería' }] },
  { clave: 'numero_documento', etiqueta: 'Número de documento', obligatorio: true },
  { clave: 'razon_social', etiqueta: 'Nombre o razón social', obligatorio: true },
  { clave: 'tipo_cliente', etiqueta: 'Tipo de cliente', obligatorio: true, inicial: 'PROPIEDAD_HORIZONTAL',
    opciones: [{ valor: 'PROPIEDAD_HORIZONTAL', texto: 'Propiedad horizontal' }, { valor: 'EMPRESA', texto: 'Empresa' },
      { valor: 'PERSONA_NATURAL', texto: 'Persona natural' }, { valor: 'ENTIDAD_PUBLICA', texto: 'Entidad pública' }] },
  { clave: 'contacto_nombre', etiqueta: 'Nombre del contacto' },
  { clave: 'contacto_cargo', etiqueta: 'Cargo del contacto' },
  { clave: 'contacto_correo', etiqueta: 'Correo del contacto' },
  { clave: 'contacto_telefono', etiqueta: 'Teléfono del contacto' },
  { clave: 'direccion', etiqueta: 'Dirección' },
  { clave: 'ciudad', etiqueta: 'Ciudad' },
];

export const CAMPOS_EDIFICIO: Campo[] = [
  { clave: 'nombre', etiqueta: 'Nombre del edificio / torre', obligatorio: true },
  { clave: 'direccion', etiqueta: 'Dirección', obligatorio: true },
  { clave: 'ciudad', etiqueta: 'Ciudad', obligatorio: true },
  { clave: 'barrio', etiqueta: 'Barrio' },
  { clave: 'numero_pisos', etiqueta: 'Número de pisos', numero: true },
  { clave: 'numero_equipos', etiqueta: 'Número de ascensores', numero: true, obligatorio: true },
  { clave: 'administrador_nombre', etiqueta: 'Representante / administrador' },
  { clave: 'administrador_telefono', etiqueta: 'Teléfono del representante' },
  { clave: 'administrador_correo', etiqueta: 'Correo del representante' },
  { clave: 'empresa_mantenimiento', etiqueta: 'Empresa de mantenimiento' },
];

// El asesor solo registra el ascensor; los datos técnicos los completa el inspector en la visita.
export const CAMPOS_EQUIPO: Campo[] = [
  { clave: 'identificacion', etiqueta: 'Identificación (ej. Ascensor 1, Torre B)', obligatorio: true },
  { clave: 'tipo_equipo', etiqueta: 'Tipo de equipo', obligatorio: true, inicial: 'ASCENSOR_PASAJEROS', opciones: TIPOS_EQUIPO },
];
