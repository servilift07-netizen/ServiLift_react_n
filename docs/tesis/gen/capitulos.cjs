// Contenido del documento: cada capítulo devuelve una lista de párrafos y tablas.
const fs = require('fs');
const M = require('./documento.cjs');
const { P, Pc, H1, H1n, H2, H3, vineta, listaNum, salto, figura, notaP, tablaAPA, tablaRejilla, tablaRequisito, tablaCU, D, SPEC, ANCHO } = M;
const { Document, Packer, Paragraph, TextRun, ImageRun, AlignmentType, HeadingLevel, Header, Footer, PageNumber, TableOfContents, LevelFormat } = M;

const NOMBRE_ROL = { ADMIN: 'Administrador', ASESOR: 'Asesor', CLIENTE: 'Cliente', PROGRAMACION: 'Programación', INSPECTOR: 'Inspector', DIRECTOR_TECNICO: 'Director técnico', CERTIFICADOS: 'Certificados' };
const ROLES_SESION = ['Administrador', 'Asesor', 'Cliente', 'Programación', 'Inspector', 'Director técnico', 'Certificados'];
const COMUNES = ['CU-01', 'CU-26', 'CU-27'];

// ---------------------------------------------------------------- portada
function portada() {
  const c = (t, o = {}) => new Paragraph({ alignment: AlignmentType.CENTER, spacing: { line: 360 }, children: [new TextRun({ text: t, ...o })] });
  const v = (n = 1) => Array.from({ length: n }, () => new Paragraph({ children: [] }));
  return [
    new Paragraph({ alignment: AlignmentType.CENTER, children: [new ImageRun({ type: 'png', data: fs.readFileSync(M.LOGO), transformation: { width: 110, height: 122 }, altText: { title: 'SENA', description: 'Logo del SENA', name: 'sena' } })] }),
    ...v(3),
    c('Proyecto Formativo: ServiLift', { bold: true }),
    c('Sistema de gestión de inspecciones de ascensores'),
    c('Documentación técnica'),
    ...v(3),
    c('Instructor:'), c('______________________________'),
    ...v(2),
    c('Aprendiz:'), c('Nelson Esteban Mejía Gómez'),
    ...v(3),
    c('Servicio Nacional de Aprendizaje - SENA'),
    ...v(1),
    c('Bogotá, Colombia'),
    ...v(1),
    c('14 de octubre de 2026'),
  ];
}

// Índice estático: los números de página salen de una primera conversión a PDF (ver indice.py).
function indice(lista, paginas) {
  return [
    new Paragraph({ alignment: AlignmentType.CENTER, pageBreakBefore: true, children: [new TextRun({ text: 'Tabla de contenido', bold: true })], spacing: { after: 240 } }),
    ...lista.map(([nivel, t], i) => new Paragraph({
      tabStops: [{ type: M.TabStopType.RIGHT, position: ANCHO, leader: 'dot' }],
      indent: { left: nivel === 1 ? 0 : 480 }, spacing: { line: 300, after: nivel === 1 ? 60 : 20, before: nivel === 1 ? 80 : 0 },
      children: [new TextRun({ text: t, bold: nivel === 1, size: nivel === 1 ? 23 : 22 }), new TextRun({ text: `\t${paginas ? (paginas[i] || '') : '00'}`, size: 22 })],
    })),
  ];
}

// ---------------------------------------------------------------- 0. resumen e introducción
function resumen() {
  return [
    H1('Resumen'),
    P('El presente documento describe ServiLift, un sistema de información para gestionar de principio a fin el servicio de inspección técnica de ascensores en organismos de certificación de transporte vertical que trabajan con la NTC 5926-1:2012, desde la cotización hasta la entrega del certificado con código QR, conforme a la NTC 5926-1:2012.'),
    P('La solución está formada por una aplicación multiplataforma en React Native con Expo, que corre en el celular del inspector y en el navegador del personal de oficina y del cliente; una API REST en FastAPI (Python 3.13) que concentra las reglas del negocio y los permisos de siete roles; y una base de datos MariaDB de 31 tablas y 2 vistas. El inspector trabaja sin señal: cada cambio se guarda primero en el teléfono y se sincroniza solo cuando vuelve la conexión, sin duplicar fotos ni firmas.'),
    P('El documento recoge el análisis del negocio, el levantamiento de requisitos a partir del análisis del proceso y la norma, los 27 casos de uso organizados por rol con su especificación, la arquitectura, el modelo de datos con su diccionario completo generado desde el esquema real, la API, la instalación con Docker y uv, y la estrategia de pruebas automatizadas (Vitest, pytest, Playwright, mutación manual e integración continua en GitHub Actions).'),
    new Paragraph({ spacing: { line: 480 }, indent: { firstLine: 720 }, children: [new TextRun({ text: 'Palabras clave: ', italics: true }), new TextRun('inspección de ascensores, NTC 5926-1, trabajo sin conexión, React Native, FastAPI, MariaDB, casos de uso.')] }),
    H1('Introducción'),
    P('La inspección técnica de ascensores y equipos de transporte vertical es un proceso regulado que exige rigurosidad, trazabilidad y cumplimiento normativo para garantizar la seguridad de los usuarios. En los organismos de inspección este proceso se suele llevar con planillas impresas, archivos de Excel independientes y fotografías sueltas tomadas con el celular, lo que dificulta el control de la información, alarga la entrega del informe y limita la calidad y la estandarización del resultado.'),
    P('ServiLift es un proyecto propio e independiente, dirigido a cualquier organismo de certificación de transporte vertical que aplique la NTC 5926-1. Este documento presenta el sistema ya implementado y probado, que cubre la cotización, la programación de visitas, la inspección en campo con o sin señal, la revisión y firma del director técnico, la segunda visita de cierre de hallazgos, la emisión del certificado y su verificación pública por QR.'),
    P('Primero se describe la línea de negocio, el problema y los objetivos; luego los requisitos y los casos de uso, que ahora se presentan **por rol** con diagramas propios; después la arquitectura y el modelo de datos, también desglosado **por área y por rol**; y al final la instalación, las pruebas y las conclusiones.'),
  ];
}

// ---------------------------------------------------------------- 2. negocio
function negocio() {
  return [
    H1('1. Línea de negocio y marco normativo'),
    H2('1.1. Línea de negocio'),
    P('ServiLift se ubica en el sector de inspección técnica, certificación y control de seguridad de sistemas de transporte vertical: ascensores, montacargas, plataformas elevadoras y escaleras eléctricas. Es un servicio obligatorio y regulado en Colombia, porque estos equipos requieren evaluaciones periódicas que garanticen la seguridad de los usuarios y el cumplimiento de estándares técnicos.'),
    P('Muchas empresas del sector inspeccionan todavía de forma manual o semidigital, con formularios impresos, fotos en dispositivos personales y transcripción posterior en oficina. ServiLift reemplaza ese procedimiento con un flujo digital centralizado, con permisos por rol y con funcionamiento sin conexión para el trabajo en campo.'),
    H2('1.2. Actores del modelo de negocio'),
    ...tablaAPA('Actores del modelo de negocio y su rol en ServiLift', ['Actor', 'Participación en el proceso', 'Rol en ServiLift'], [
      ['Área comercial', 'Registra clientes, cotiza y entrega a programación lo aprobado', 'ASESOR'],
      ['Cliente (propietario, administración o entidad)', 'Aprueba la cotización, pide la segunda visita y descarga informes y certificados', 'CLIENTE'],
      ['Área de programación', 'Asigna inspector, fecha y hora a cada visita', 'PROGRAMACION'],
      ['Inspector certificado', 'Ejecuta la inspección con el checklist de la norma, toma evidencias y firmas', 'INSPECTOR'],
      ['Empresa de mantenimiento', 'Acompaña al inspector y firma la visita en el celular', 'Firmante (sin usuario)'],
      ['Director técnico', 'Revisa, atesta, firma y aprueba o devuelve el informe', 'DIRECTOR_TECNICO'],
      ['Área de certificados', 'Elabora, envía o anula el certificado con QR', 'CERTIFICADOS'],
      ['Administración del sistema', 'Gestiona usuarios, normas, parámetros e instrumentos', 'ADMIN'],
      ['Público', 'Verifica la autenticidad del certificado escaneando el QR', 'Sin sesión'],
    ], [2400, 4560, 2400], 'Cada actor del negocio corresponde a un rol implementado en ServiLift.'),
    H2('1.3. Marco normativo legal y técnico'),
    ...tablaAPA('Marco normativo relacionado con el proyecto', ['Norma o documento', 'Enfoque', 'Relación con ServiLift'], [
      ['NTC 5926-1:2012', 'Inspección técnica de ascensores en Colombia', 'Su lista de chequeo (169 ítems) es el checklist que califica el inspector; la tabla norma admite nuevas ediciones y las partes 2 y 3'],
      ['ISO/IEC 17020:2012', 'Requisitos para organismos de inspección', 'Trazabilidad: historial de estados, firmas, huella SHA-256 del PDF y consecutivos únicos'],
      ['Resolución 0675 de 2013', 'Inspección obligatoria de ascensores', 'Motiva el ciclo de inspección periódica y el certificado con vencimiento'],
      ['Ley 1480 de 2011', 'Protección del consumidor', 'El certificado se verifica públicamente por QR (vigente, vencido o anulado)'],
      ['Ley 1581 de 2012', 'Protección de datos personales', 'Contraseñas cifradas, permisos por rol, el cliente solo ve su información y los archivos se sirven con enlace firmado'],
    ], [2200, 2800, 4360], 'Se listan las normas legales y técnicas que aplican al proceso de inspección y a la documentación digital.'),
    H2('1.4. Necesidad real del mercado'),
    P('La transformación digital del sector mejora la productividad y además:'),
    vineta('Permite trazabilidad completa y verificable de cada servicio.'),
    vineta('Reduce el tiempo de entrega del informe y del certificado.'),
    vineta('Soporta el trabajo en campo sin conexión.'),
    vineta('Fortalece la seguridad de la información y facilita las auditorías.'),

    H1('2. Descripción del caso y problema actual'),
    H2('2.1. Usuarios objetivo'),
    P('ServiLift está dirigido a los organismos de certificación de transporte vertical en Colombia que evalúan el cumplimiento de la NTC 5926-1:2012, normalmente acreditados bajo la ISO/IEC 17020:2012, y que trabajan con un equipo de asesores comerciales, programadores de agenda, inspectores, directores técnicos y personal de certificados. No está atado a una empresa en particular: la norma, sus ítems y los datos de la empresa que aparecen en los informes se configuran como datos.'),
    H2('2.2. Proceso operativo habitual sin un sistema'),
    P('En un organismo de certificación el servicio suele pasar por cuatro áreas. El **área comercial** recibe la solicitud, cotiza y envía la propuesta por correo. **Programación** acuerda la fecha con el cliente y la empresa de mantenimiento y envía el itinerario al inspector. El **inspector** ejecuta la inspección con la lista de chequeo de la NTC 5926-1, el registro de visita y el informe en hojas de Excel, con fotos sueltas del celular. La **dirección técnica** revisa el informe, autoriza el certificado y lo publica para el cliente.'),
    H2('2.3. Problemas identificados'),
    ...tablaAPA('Impacto operativo del proceso manual', ['Tipo de impacto', 'Consecuencia', 'Cómo lo atiende ServiLift'], [
      ['Operativo', 'Más tiempo de ejecución y transcripción', 'El informe se arma solo con lo que registra el inspector en el celular'],
      ['Técnico', 'Errores de registro y fotos sin asociar', 'Checklist por norma, ítems que no aplican precargados y fotos ligadas al hallazgo'],
      ['Administrativo', 'Información duplicada y dispersa', 'Una sola base de datos y un estado por equipo visible para todos los roles'],
      ['Económico', 'Reprocesos', 'Validación de pendientes antes de finalizar y devolución con observaciones'],
      ['Normativo', 'Riesgo frente a la NTC 5926-1 y la ISO 17020', 'Historial de estados, firmas, huella del PDF y certificado verificable'],
    ], [1800, 3200, 4360], 'Elaboración propia.'),
    H2('2.4. Oportunidad de mejora'),
    P('La situación descrita justificó una plataforma centralizada con soporte sin conexión, sincronización automática, almacenamiento unificado de evidencias y automatización del flujo documental. ServiLift es esa plataforma, implementada y probada en esta versión.'),

    H1('3. Objetivos del proyecto'),
    H2('3.1. Objetivo general'),
    P('Desarrollar un sistema de información web y móvil, con funcionamiento sin conexión, que digitalice el servicio de inspección técnica de ascensores desde la cotización hasta el certificado, con trazabilidad completa y cumplimiento de la NTC 5926-1:2012.'),
    H2('3.2. Objetivos específicos'),
    ...listaNum([
      'Analizar el proceso actual de inspección y levantar sus requisitos a partir del proceso y de la NTC 5926-1.',
      'Especificar los requisitos funcionales y no funcionales y trazarlos a la implementación.',
      'Modelar los casos de uso por rol, el flujo del negocio y la máquina de estados del servicio.',
      'Diseñar e implementar la arquitectura cliente-servidor y el modelo de datos relacional.',
      'Implementar el trabajo sin conexión del inspector sin pérdida ni duplicación de información.',
      'Verificar el sistema con pruebas unitarias, de integración y de extremo a extremo automatizadas en integración continua.',
    ]),

    H1('4. Alcance del proyecto'),
    H2('4.1. Alcance del proyecto académico'),
    P('El proyecto comprende el análisis, el diseño, la implementación, las pruebas y la documentación del sistema dentro del proceso formativo del SENA. La puesta en producción en la infraestructura de un organismo de certificación queda fuera del alcance académico; el sistema se entrega listo para desplegarse con Docker.'),
    H2('4.2. Alcance funcional implementado'),
    ...listaNum([
      'Inicio de sesión con token y cambio de contraseña; siete roles con permisos por endpoint.',
      'Gestión de usuarios y del acceso al portal de cada cliente.',
      'Configuración de normas, parámetros e instrumentos de medición.',
      'Registro de clientes, edificios y equipos.',
      'Cotización, aprobación del cliente en el portal y envío a programación.',
      'Programación, reprogramación y cancelación de visitas.',
      'Inspección en el celular: datos del equipo, variantes, checklist de la norma, mediciones, fotos y firmas, con o sin señal.',
      'Revisión, firma y aprobación del informe por el director técnico, con PDF y huella SHA-256.',
      'Segunda visita de cierre de hallazgos dentro del plazo de corrección.',
      'Certificado con código QR, envío al cliente, anulación y verificación pública.',
      'Seguimiento por equipo con historial, tablero por rol y notificaciones.',
    ]),
    H2('4.3. Fuera del alcance'),
    vineta('Recuperación de contraseña por correo (el administrador la restablece).'),
    vineta('Facturación e integración con sistemas contables o CRM (la API REST documentada lo permite a futuro).'),
    vineta('Respaldo automático programado de la base de datos (se documenta como recomendación de despliegue).'),
  ];
}

// ---------------------------------------------------------------- 5. requisitos
const ESTADO = { I: 'Implementado', P: 'Parcial', N: 'No implementado' };
const TRAZA_F = [
  ['F-001', 'Registro y consulta offline', 'I', 'CU-12, CU-16', 'Cola persistente en el teléfono y sincronización automática.'],
  ['F-002', 'Plantillas digitales adaptativas', 'I', 'CU-13', 'El checklist se filtra por norma y por las variantes del equipo (vista v_inspeccion_item_aplica).'],
  ['F-003', 'Vinculación automática de evidencias', 'I', 'CU-14', 'Cada foto puede asociarse al resultado del ítem (inspeccion_foto.id_resultado).'],
  ['F-004', 'Borradores en campo', 'P', 'CU-17, CU-18', 'El inspector valida pendientes al finalizar; la vista previa del PDF la usa el director técnico.'],
  ['F-005', 'Firma digital en sitio', 'I', 'CU-15', 'Firmas del inspector, del técnico y del representante en el celular.'],
  ['F-006', 'Dashboard de inspecciones', 'I', 'CU-23, CU-26', 'Tablero por rol y seguimiento por equipo con historial.'],
  ['F-007', 'Flujos de trabajo digitales', 'I', 'CU-07 a CU-22', 'Máquina de estados por equipo y aprobación con firma del director.'],
  ['F-008', 'Análisis y reporting', 'P', 'CU-26', 'Indicadores y gráficas por estado; no hay reportes mensuales exportables.'],
  ['F-009', 'Integración con sistemas corporativos', 'P', '—', 'API REST con OpenAPI (Swagger); no hay conector contable ni CRM.'],
  ['F-010', 'Gestión de roles y accesos', 'I', 'CU-02', 'Siete roles; cada endpoint declara los roles permitidos.'],
  ['F-011', 'Respaldo automático de información', 'P', 'CU-16', 'La información queda en el servidor al sincronizar; falta un respaldo programado.'],
];
const TRAZA_NF = [
  ['NF-001', 'Offline-online sin duplicados', 'I', 'uuid_offline en inspecciones, fotos y firmas; el cambio más reciente gana.'],
  ['NF-002', 'Tiempo de respuesta ≤ 3 s', 'P', 'Guardar en el teléfono es inmediato; no se hizo prueba de carga formal.'],
  ['NF-003', 'Usabilidad alta', 'I', 'Interfaz por rol, mensajes claros y pendientes enlazados a la pantalla que los atiende.'],
  ['NF-004', 'Disponibilidad 24/7 (99,9 %)', 'P', 'Depende del despliegue; el inspector sigue trabajando aunque el servidor no responda.'],
  ['NF-005', 'Escalabilidad', 'P', 'API sin estado con JWT, escalable horizontalmente; no probada con cientos de usuarios.'],
  ['NF-006', 'Seguridad de datos', 'P', 'PBKDF2-SHA256, JWT, permisos por rol y enlaces firmados; no hay cifrado AES-256 en reposo.'],
  ['NF-007', 'Recuperación ≤ 24 h', 'P', 'La base se reconstruye con scripts y migraciones; falta el respaldo programado.'],
  ['NF-008', 'Compatibilidad Android e iOS', 'I', 'Una sola app Expo para Android, iOS y web.'],
  ['NF-009', 'Cumplimiento normativo', 'I', 'Checklist NTC 5926-1, trazabilidad ISO 17020 y protección de datos (Ley 1581).'],
  ['NF-010', 'Arquitectura modular y mantenible', 'I', 'Capas en el backend, rutas por módulo, normas en datos y migraciones Alembic.'],
];

function requisitos() {
  const out = [
    H1('5. Levantamiento de requisitos'),
    H2('5.1. Metodología'),
    P('Los requisitos se obtuvieron del análisis del proceso de inspección descrito en el capítulo 2, de la lista de chequeo y las exigencias de la NTC 5926-1:2012, de los requisitos de trazabilidad de la ISO/IEC 17020:2012 y de las condiciones reales del trabajo en campo, como los cuartos de máquinas y fosos sin señal. Cada necesidad se escribió como un requisito funcional, no funcional o una restricción, y se trazó al caso de uso que la atiende.'),
    H2('5.2. Trazabilidad de los requisitos consolidados'),
    P('Las tablas siguientes muestran cada requisito consolidado, el caso de uso que lo atiende y su estado en la versión implementada. Los requisitos parciales se explican para que el lector sepa exactamente qué falta.'),
    ...tablaAPA('Requisitos funcionales y su implementación', ['Código', 'Requisito', 'Estado', 'Casos de uso', 'Cómo se atiende'],
      TRAZA_F.map(([c, n, e, cu, d]) => [c, n, ESTADO[e], cu, d]), [900, 1900, 1500, 1200, 3860]),
    ...tablaAPA('Requisitos no funcionales y su implementación', ['Código', 'Requisito', 'Estado', 'Cómo se atiende'],
      TRAZA_NF.map(([c, n, e, d]) => [c, n, ESTADO[e], d]), [900, 2200, 1500, 4760]),
    ...tablaAPA('Restricciones', ['Código', 'Restricción', 'Estado', 'Observación'], [
      ['R-001', 'Funcionamiento en zonas sin conectividad', 'Implementado', 'Ver CU-16 y la sección 9.6.'],
      ['R-002', 'Cumplimiento de la normativa técnica y de datos', 'Implementado', 'NTC 5926-1, ISO 17020 y Ley 1581.'],
      ['R-003', 'Respaldo diario en la nube', 'No implementado', 'Recomendación de despliegue: copia programada del volumen de MariaDB y de storage/.'],
      ['R-004', 'Disponibilidad mínima de 99,9 %', 'Parcial', 'Depende de la infraestructura donde se despliegue.'],
    ], [900, 2900, 1700, 3860]),
    H1('6. Requisitos del sistema'),
    P('Cada requisito funcional corresponde a un caso de uso con el mismo número (RF-001 ↔ CU-01). Se redactaron en lenguaje claro y verificable; los casos de uso de la sección 8 detallan sus flujos.'),
    H2('6.1. Requisitos funcionales (RF)'),
  ];
  Object.entries(D.cu).forEach(([id, cu]) => {
    const roles = rolesDeCU(id);
    out.push(...tablaRequisito(`RF-${id.slice(3).padStart(3, '0')}`, cu.nombre, SPEC[id].desc, roles));
  });
  out.push(H2('6.2. Requisitos no funcionales (RNF)'));
  const rnf = [
    ['RNF-001', 'Trabajo sin conexión', 'El inspector debe poder calificar, fotografiar y firmar sin señal; cada cambio se guarda en el teléfono y se envía solo, en orden, sin duplicar ni perder información.', 'Inspector'],
    ['RNF-002', 'Seguridad', 'Contraseñas con PBKDF2-SHA256 (600.000 iteraciones, sal de 16 bytes), sesión con JWT de 12 horas, permisos por rol en cada endpoint y archivos solo con enlace firmado que vence.', 'Todos'],
    ['RNF-003', 'Trazabilidad', 'Todo cambio de estado de un servicio queda en historial_estado con usuario, fecha y comentario; el PDF aprobado guarda su huella SHA-256.', 'Todos'],
    ['RNF-004', 'Compatibilidad', 'Una sola base de código para Android, iOS y navegador (Expo SDK 57).', 'Todos'],
    ['RNF-005', 'Usabilidad', 'Cada rol ve solo su menú y su tablero; los errores se explican en lenguaje claro y los pendientes llevan a la pantalla que los resuelve.', 'Todos'],
    ['RNF-006', 'Mantenibilidad', 'Backend por capas, reglas puras probadas sin base de datos, normas y reglas de «no aplica» en datos, y migraciones Alembic.', 'Equipo de desarrollo'],
    ['RNF-007', 'Calidad verificable', 'Pruebas unitarias con umbral de cobertura en cada pull request (GitHub Actions), pruebas de integración y E2E con Playwright.', 'Equipo de desarrollo'],
    ['RNF-008', 'Instalación repetible', 'Base de datos en Docker (MariaDB 10.11) y dependencias de Python fijadas con uv.lock.', 'Equipo de desarrollo'],
    ['RNF-009', 'Zona horaria', 'Todas las fechas se guardan y muestran en hora de Colombia (UTC−5).', 'Todos'],
    ['RNF-010', 'Integridad de datos', 'Llaves foráneas, valores únicos, consecutivos bloqueados con SELECT … FOR UPDATE y transiciones de estado validadas (409 si no se permiten).', 'Todos'],
  ];
  rnf.forEach(([c, n, d, r]) => out.push(...tablaRequisito(c, n, d, r, 'REQUISITOS NO FUNCIONALES')));
  out.push(H1('7. Historias de usuario'));
  out.push(P('Cada caso de uso nace de una historia de usuario. La tabla siguiente las resume con el formato «Como… quiero… para…» y el caso de uso que las implementa.'));
  out.push(...tablaAPA('Historias de usuario y su caso de uso', ['HU', 'Historia de usuario', 'CU'],
    Object.keys(D.cu).map((id) => [`HU-${id.slice(3)}`, SPEC[id].hu, id]), [900, 7360, 1100], 'Los criterios de aceptación de cada historia son el flujo normal, los alternos y los excepcionales de su caso de uso.'));
  return out;
}

function rolesDeCU(id) {
  if (COMUNES.includes(id)) return 'Todos los roles con sesión';
  const r = Object.entries(D.roles).filter(([, v]) => v.cus.includes(id)).map(([n]) => n);
  return r.join(', ');
}

// ---------------------------------------------------------------- 8. UML y casos de uso por rol
function casosDeUso() {
  const out = [
    H1('8. Diseño y modelo UML'),
    H2('8.1. Actores y roles'),
    P('ServiLift tiene siete roles con sesión y un actor público. El administrador, además de sus funciones, puede ejecutar cualquier acción de otro rol porque la verificación de permisos (`require_roles`) siempre lo deja pasar.'),
    ...tablaAPA('Roles del sistema', ['Rol', 'Código', 'Dónde trabaja', 'Responsabilidad'],
      Object.entries(D.roles).map(([n, r]) => [n, r.codigo, n === 'Inspector' ? 'Celular, con o sin señal' : n === 'Público' ? 'Cualquier dispositivo' : 'Navegador', r.descripcion]), [1700, 2100, 1700, 3860]),
    H2('8.2. Módulos y casos de uso (visión general)'),
    P('Los 27 casos de uso se agrupan en siete módulos. La Figura 1 muestra cada módulo con sus casos de uso y los roles que los ejecutan; CU-01, CU-26 y CU-27 los usan todos los roles con sesión.'),
    ...figura('cu-general', 'Casos de uso del sistema agrupados por módulo y rol', 'Cada casilla de color identifica el rol que ejecuta el caso de uso.'),
    H2('8.3. Matriz actor – caso de uso'),
  ];
  const cols = ['Administrador', 'Asesor', 'Cliente', 'Programación', 'Inspector', 'Director técnico', 'Certificados', 'Público'];
  const corto = ['Adm', 'Ase', 'Cli', 'Pro', 'Ins', 'Dir', 'Cer', 'Púb'];
  const filas = Object.entries(D.cu).map(([id, cu]) => [`${id} ${cu.nombre}`, ...cols.map((c) => {
    const usa = (COMUNES.includes(id) && c !== 'Público') || D.roles[c].cus.includes(id);
    return usa ? { t: '●', fondo: 'D9F2DC' } : '';
  })]);
  out.push(...M.tituloTabla('Matriz de actores y casos de uso'));
  out.push(tablaRejilla(['Caso de uso', ...corto], filas, [4000, 670, 670, 670, 670, 670, 670, 670, 670], { centro: [1, 2, 3, 4, 5, 6, 7, 8], tam: 17 }));
  out.push(notaP('Adm: administrador, Ase: asesor, Cli: cliente, Pro: programación, Ins: inspector, Dir: director técnico, Cer: certificados, Púb: público. El administrador puede además ejecutar cualquier caso de uso de otro rol.'));
  out.push(H2('8.4. Casos de uso por rol'));
  out.push(P('Cada rol tiene su propio diagrama de casos de uso. El caso de uso principal aparece en azul y sus acciones en ámbar: la flecha verde «include» marca una acción obligatoria y la naranja «extend» una opcional. Después de cada diagrama va la especificación de los casos de uso propios del rol; los comunes se especifican en la sección 8.5.'));
  let k = 1;
  Object.entries(D.roles).forEach(([nombre, rol]) => {
    out.push(H3(`8.4.${k++}. Actor: ${nombre}`));
    out.push(P(rol.descripcion));
    out.push(...figura(rol.archivo, `Diagrama de casos de uso del rol ${nombre}`, null, 7.6));
    rol.cus.filter((c) => !COMUNES.includes(c) && primerRol(c) === nombre).forEach((c) => out.push(...tablaCU(c, rol.codigo)));
    const otros = rol.cus.filter((c) => !COMUNES.includes(c) && primerRol(c) !== nombre);
    if (otros.length) out.push(P(`Los casos ${otros.join(', ')} se especifican en el rol ${primerRol(otros[0])}, con el que los comparte.`));
  });
  out.push(H2('8.5. Casos de uso comunes a todos los roles'));
  COMUNES.forEach((c) => out.push(...tablaCU(c, 'Todos con sesión')));
  return out;
}
function primerRol(cu) { return Object.entries(D.roles).find(([, v]) => v.cus.includes(cu))[0]; }

// ---------------------------------------------------------------- 9. flujo y arquitectura
function flujo() {
  return [
    H1('9. Flujo del negocio y estados'),
    H2('9.1. Flujo del servicio'),
    P('La figura siguiente muestra el recorrido de un servicio por los roles. Solo existen dos visitas por servicio: si la primera es no conforme, el cliente corrige dentro del plazo y pide la segunda; si en la segunda queda algo sin corregir, el servicio se cierra no conforme y necesita una cotización nueva.'),
    ...figura('flujo-negocio', 'Diagrama de actividades del servicio de inspección por rol', null, 8.3),
    H2('9.2. Máquina de estados del equipo cotizado'),
    P('El estado vive en cada equipo cotizado (`cotizacion_equipo.estado`) y no en la cotización, porque una cotización puede cubrir varios ascensores que avanzan a ritmos distintos. Las transiciones están en `app/services/flujo.py` (`TRANSICIONES`); cualquier otra responde 409 y cada cambio queda en `historial_estado`.'),
    ...figura('estados', 'Estados de un equipo cotizado y sus transiciones', 'El plazo de corrección tras una primera visita no conforme es el menor entre los hallazgos: leve 180 días, grave 30 días, muy grave inmediato.'),
    ...tablaAPA('Estados de las demás entidades', ['Entidad', 'Estados'], [
      ['cotizacion', 'BORRADOR, ENVIADA_CLIENTE, APROBADA_CLIENTE, RECHAZADA_CLIENTE, ENVIADA_PROGRAMACION, EN_EJECUCION, FINALIZADA, ANULADA'],
      ['programacion', 'PROGRAMADA, REPROGRAMADA, EN_CURSO, REALIZADA, CANCELADA'],
      ['inspeccion', 'EN_CURSO, FINALIZADA, DEVUELTA, APROBADA, EN_SEGUNDA_VISITA, CERRADA'],
      ['informe', 'PENDIENTE_REVISION, DEVUELTO, APROBADO, ANULADO (concepto CONFORME o NO_CONFORME)'],
      ['certificado', 'EN_ELABORACION, EMITIDO, ENVIADO_CLIENTE, ANULADO'],
    ], [2000, 7360]),
  ];
}

function arquitectura() {
  return [
    H1('10. Arquitectura y tecnología'),
    H2('10.1. Patrón arquitectónico'),
    P('ServiLift es un sistema **cliente-servidor de tres capas**: la app (presentación), la API REST (lógica de negocio) y la base de datos (persistencia). Dentro del backend se aplica una **arquitectura en capas**: rutas, seguridad, servicios de negocio y modelos ORM. La app sigue un enfoque **offline-first** para el inspector: la fuente inmediata de verdad es el teléfono y el servidor se actualiza cuando hay señal.'),
    ...figura('componentes', 'Arquitectura de componentes', null),
    H2('10.2. Tecnologías escogidas'),
    ...tablaAPA('Tecnologías del sistema', ['Capa', 'Tecnología', 'Uso'], [
      ['App', 'React Native 0.86, Expo SDK 57, TypeScript, Expo Router, React Native Paper', 'Una sola app para Android, iOS y navegador'],
      ['Almacenamiento local', 'AsyncStorage, SecureStore, sessionStorage', 'Cola sin conexión, fotos pendientes y sesión'],
      ['API', 'Python 3.13, FastAPI, Pydantic 2', 'Endpoints REST, validación y documentación OpenAPI'],
      ['Persistencia', 'SQLAlchemy 2, PyMySQL, Alembic', 'Modelos ORM y migraciones 0001 a 0005'],
      ['Seguridad', 'python-jose (JWT HS256), PBKDF2-SHA256', 'Sesión y contraseñas'],
      ['Documentos', 'ReportLab, qrcode, Pillow', 'PDF del informe y del certificado con QR; fotos reducidas'],
      ['Base de datos', 'MariaDB 10.11 en Docker (o MySQL 8)', '31 tablas y 2 vistas, utf8mb4'],
      ['Herramientas', 'uv, Docker Compose, EAS Build', 'Dependencias exactas, base repetible e instalador Android'],
      ['Pruebas', 'Vitest, pytest, pytest-cov, Playwright, GitHub Actions', 'Unitarias, integración, E2E e integración continua'],
    ], [1800, 3900, 3660]),
    H2('10.3. Arquitectura en capas del backend'),
    P('Cada endpoint declara los roles permitidos y recibe la sesión de base de datos por inyección de dependencias. Las reglas que no dependen de la base ni de HTTP viven en `reglas.py` y se prueban de forma aislada.'),
    ...figura('capas', 'Capas del backend', null),
    H2('10.4. Despliegue'),
    P('La base corre en Docker con `docker compose up -d` y crea la base principal y la de pruebas. El backend se ejecuta con `uv run uvicorn` sobre 0.0.0.0 para que el celular lo alcance en la red local, y el instalador Android se genera con EAS Build.'),
    ...figura('despliegue', 'Diagrama de despliegue', null),
    H2('10.5. Trabajo sin señal'),
    P('El inspector trabaja en sótanos y cuartos de máquinas sin cobertura. La app guarda cada cambio primero en una cola persistente del teléfono y un motor de sincronización la envía en orden cuando hay señal. Los resultados viajan con su hora y el servidor conserva el más reciente; fotos y firmas llevan `uuid_offline` y no se duplican si llegan dos veces. Finalizar exige que la cola de esa inspección esté vacía.'),
    ...figura('sincronizacion', 'Secuencia de la cola de cambios sin señal', null),
    H2('10.6. Seguridad'),
    ...tablaAPA('Controles de seguridad', ['Aspecto', 'Implementación'], [
      ['Contraseñas', 'PBKDF2-SHA256 con 600.000 iteraciones y sal aleatoria de 16 bytes, guardadas como BLOB (migración 0005).'],
      ['Sesión', 'JWT HS256 de 12 horas; en el celular el token va en SecureStore y en la web en sessionStorage.'],
      ['Autorización', 'Cada endpoint exige roles; el cliente solo ve sus cotizaciones, informes aprobados y certificados enviados.'],
      ['Archivos', 'Fotos y firmas solo con enlace firmado que vence; no hay carpeta pública y se impide salir de STORAGE_DIR.'],
      ['PDF', 'Descarga con token temporal de 10 minutos (/descargas/{token}) y huella SHA-256 del documento aprobado.'],
      ['Certificado', 'Código QR hacia /verificar/{codigo} para comprobar su autenticidad.'],
      ['CORS', 'En desarrollo solo localhost; en producción los orígenes de CORS_ORIGINS.'],
    ], [2000, 7360], 'El repositorio trae una SECRET_KEY y usuarios de demostración; en un despliegue real se definen en el archivo .env.'),
    H2('10.7. Decisiones de diseño'),
    ...tablaAPA('Decisiones de diseño', ['Decisión', 'Motivo'], [
      ['Una sola app para celular y navegador (Expo)', 'Un solo código TypeScript para todos los roles.'],
      ['Estado por equipo y no por cotización', 'Una cotización puede cubrir varios ascensores que avanzan a ritmos distintos.'],
      ['Solo dos visitas por servicio', 'Así lo define el procedimiento de certificación.'],
      ['La norma como tabla', 'Permite nuevas ediciones de la NTC 5926 y sus partes sin cambiar código.'],
      ['Aplicabilidad de ítems en una vista SQL', 'Las reglas de «no aplica» quedan en datos y migraciones.'],
      ['Cola local donde gana el cambio más reciente', 'Evita perder o duplicar trabajo de campo con señal intermitente.'],
      ['Docker para la base y uv para Python', 'Instalación repetible con las mismas versiones.'],
    ], [3600, 5760]),
  ];
}

// ---------------------------------------------------------------- 11. modelo de datos
function datos() {
  const out = [
    H1('11. Diseño del modelo de datos'),
    H2('11.1. Base de datos escogida'),
    P('Se usa MariaDB 10.11 (compatible con MySQL 8) con motor InnoDB, juego de caracteres utf8mb4 y la zona horaria de Colombia en cada conexión. El esquema completo está en `database/01_schema.sql` y los cambios posteriores se aplican con las migraciones Alembic `0001` a `0005`. Son 31 tablas (30 del negocio más `alembic_version`) y 2 vistas.'),
    H2('11.2. Modelo entidad-relación general'),
    P('Las tablas se agrupan en seis áreas. La figura siguiente muestra cada área con sus tablas y relaciones internas, y entre áreas una flecha por grupo de llaves foráneas.'),
    ...figura('er-general', 'Modelo entidad-relación general por áreas', null),
    H2('11.3. Modelo de datos por área'),
    P('Para cada área se presenta el diagrama con todas las columnas, sus tipos y sus llaves (PK y FK); las tablas de otras áreas aparecen en gris punteado como referencia.'),
  ];
  const archivos = { 'Seguridad y sistema': 'er-seguridad', 'Clientes y equipos': 'er-clientes', 'Normas y checklist': 'er-normas', 'Comercial y programación': 'er-comercial', 'Inspección en campo': 'er-inspeccion', 'Informes y certificados': 'er-informes' };
  let k = 1;
  Object.entries(D.areas).forEach(([area, tablas]) => {
    out.push(H3(`11.3.${k++}. ${area}`));
    out.push(...tablaAPA(`Tablas del área ${area}`, ['Tabla', 'Descripción'], tablas.map((t) => [t, D.diccionario.find((x) => x.tabla === t).descripcion]), [2600, 6760]));
    out.push(...figura(archivos[area], `Modelo de datos del área ${area}`, null, 7.8));
  });
  out.push(H2('11.4. Identificación de entidades y relaciones'));
  const rel = [];
  D.diccionario.forEach((t) => t.fks.forEach((f) => rel.push([t.tabla, f.columna, f.tabla, 'N : 1'])));
  out.push(...tablaAPA('Relaciones entre tablas (llaves foráneas)', ['Tabla hija', 'Columna', 'Tabla padre', 'Cardinalidad'], rel, [2700, 2900, 2400, 1360], `Son ${rel.length} llaves foráneas declaradas en el esquema.`, 18));
  out.push(H2('11.5. Diccionario de datos'));
  out.push(P('El diccionario se generó leyendo `database/01_schema.sql`, así que coincide con la base real. Para cada tabla se indica el campo, el tipo, el tamaño, las restricciones y la descripción.'));
  D.diccionario.forEach((t) => {
    out.push(new Paragraph({ keepNext: true, spacing: { before: 240, after: 40 }, children: [new TextRun({ text: 'Nombre tabla: ', bold: true }), new TextRun({ text: t.tabla, bold: true, italics: true }), new TextRun({ text: `   ·   Área: ${t.area}` })] }));
    out.push(new Paragraph({ keepNext: true, spacing: { after: 80 }, children: [new TextRun({ text: 'Descripción: ', bold: true }), new TextRun(t.descripcion)] }));
    out.push(tablaRejilla(['Campo', 'Tipo de dato', 'Tamaño', 'Restricción', 'Descripción'],
      t.columnas.map((c) => [c.campo, c.tipo, c.tam, c.restriccion, c.descripcion]), [1950, 1200, 950, 2300, 2960], { centro: [1, 2], fondoEnc: 'D9E2F3' }));
  });
  out.push(H2('11.6. Vistas'));
  out.push(...tablaAPA('Vistas de la base de datos', ['Vista', 'Uso'], [
    ['v_seguimiento_equipo', 'Una fila por servicio con cliente, edificio, asesor y estado; alimenta la pantalla de Seguimiento y sus filtros.'],
    ['v_inspeccion_item_aplica', 'Para cada inspección e ítem calcula si aplica según las variantes elegidas y la profundidad del foso.'],
  ], [3000, 6360]));
  out.push(H2('11.7. Migraciones'));
  out.push(...tablaAPA('Migraciones Alembic', ['Revisión', 'Cambio'], [
    ['0001_v2_esquema_base', 'Esquema base completo.'],
    ['0002_reglas_no_aplica', 'Reglas de «no aplica» por variante según la plantilla del informe 2012.'],
    ['0003_foso_minimo', 'El ítem 12 no aplica con foso menor a 1.500 mm.'],
    ['0004_parametros_recorrido', 'Metros por parada y sobre recorrido editables.'],
    ['0005_contrasena_blob', 'Contraseñas en BLOB con PBKDF2-SHA256.'],
  ], [3200, 6160], 'Una base creada antes se pone al día con `uv run alembic upgrade head`.'));
  out.push(H2('11.8. Datos por rol'));
  out.push(P('Así como los casos de uso, el acceso a los datos se presenta por rol. Cada figura agrupa por área las tablas que usa el rol: en verde las que crea o modifica y en azul las que solo consulta, con las letras C (crear), R (consultar), U (actualizar) y D (eliminar). La matriz CRUD al final de la sección resume todos los roles.'));
  const archRol = { Administrador: 'datos-administrador', Asesor: 'datos-asesor', Cliente: 'datos-cliente', 'Programación': 'datos-programacion', Inspector: 'datos-inspector', 'Director técnico': 'datos-director', Certificados: 'datos-certificados' };
  k = 1;
  ROLES_SESION.forEach((r) => {
    out.push(H3(`11.8.${k++}. ${r}`));
    const a = D.acceso[r];
    const esc = Object.values(a).filter((p) => /[CUD]/.test(p)).length;
    out.push(P(r === 'Administrador'
      ? 'El administrador puede crear, consultar y modificar cualquier tabla, porque el control de permisos siempre lo deja pasar; en la práctica configura usuarios, normas, parámetros e instrumentos.'
      : `El rol ${r} usa ${Object.keys(a).length} tablas: escribe en ${esc} y solo consulta ${Object.keys(a).length - esc}.`));
    out.push(...figura(archRol[r], `Tablas que usa el rol ${r}`, null, 7.8));
  });
  const tablas = D.diccionario.map((t) => t.tabla).filter((t) => t !== 'alembic_version');
  const corto = ['Adm', 'Ase', 'Cli', 'Pro', 'Ins', 'Dir', 'Cer'];
  const filas = tablas.map((t) => [t, ...ROLES_SESION.map((r) => {
    const p = D.acceso[r][t] || '';
    return p ? { t: p, fondo: /[CUD]/.test(p) ? 'D9F2DC' : 'DCEBF7' } : '';
  })]);
  out.push(...M.tituloTabla('Matriz CRUD de roles y tablas'));
  out.push(tablaRejilla(['Tabla', ...corto], filas, [2780, 940, 940, 940, 940, 940, 940, 940], { centro: [1, 2, 3, 4, 5, 6, 7], tam: 17 }));
  out.push(notaP('C crear, R consultar, U actualizar, D eliminar. Verde: el rol escribe; azul: solo consulta. Los permisos se derivan de los endpoints que cada rol puede usar.'));
  return out;
}

// ---------------------------------------------------------------- 12. API
function api() {
  const nombres = { auth: 'Autenticación', usuarios: 'Usuarios', clientes: 'Clientes, edificios y equipos', cotizaciones: 'Cotizaciones', programacion: 'Programación', inspecciones: 'Inspecciones', informes: 'Informes', certificados: 'Certificados y verificación', seguimiento: 'Seguimiento', dashboard: 'Tablero', catalogos: 'Catálogos, instrumentos y notificaciones' };
  const orden = ['auth', 'usuarios', 'catalogos', 'clientes', 'cotizaciones', 'programacion', 'inspecciones', 'informes', 'certificados', 'seguimiento', 'dashboard'];
  const out = [
    H1('12. API REST'),
    P(`La API expone ${D.endpoints.length} endpoints agrupados por módulo. La documentación interactiva (Swagger) queda en http://localhost:8000/docs al encender el backend. La columna Roles indica quién puede llamar cada endpoint; «Con sesión» significa que basta con iniciar sesión y que el endpoint filtra la información según el rol. El administrador puede llamar todos.`),
  ];
  orden.forEach((m) => {
    const eps = D.endpoints.filter((e) => e.modulo === m);
    if (!eps.length) return;
    out.push(H2(`12.${orden.indexOf(m) + 1}. ${nombres[m]}`));
    out.push(M.tablaRejilla(['Método', 'Ruta', 'Roles'], eps.map((e) => [e.metodo, e.ruta, e.roles.length ? e.roles.map((r) => NOMBRE_ROL[r] || r).join(', ') : (e.sesion ? 'Con sesión' : 'Público')]), [1000, 5200, 3160], { centro: [0], tam: 17 }));
    out.push(new Paragraph({ children: [] }));
  });
  return out;
}

// ---------------------------------------------------------------- 13. instalación y 14. pruebas
function instalacion() {
  const cmd = (t) => new Paragraph({ children: [new TextRun({ text: t, font: 'Consolas', size: 19 })], shading: { fill: 'F2F2F2', type: M.ShadingType.CLEAR, color: 'auto' }, spacing: { line: 260 }, indent: { left: 360 } });
  return [
    H1('13. Instalación y ejecución'),
    P('Requisitos: Git, Docker Desktop (o MySQL de XAMPP), uv para Python 3.13 y Node.js 22. Los pasos completos están en `docs/instalacion.md` y en `GUIA_EJECUCION.md` del repositorio.'),
    H2('13.1. Base de datos con Docker'),
    cmd('docker compose up -d'),
    P('Crea `servilift_db` en el puerto 3307 y la base de pruebas `servilift_v2_prueba` con los scripts de `database/`.'),
    H2('13.2. Backend con uv'),
    cmd('cd servilift-backend'), cmd('uv sync'), cmd('uv run alembic upgrade head'), cmd('uv run uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload'),
    H2('13.3. App'),
    cmd('cd servilift-app'), cmd('npm install'), cmd('npx expo start'),
    P('En el navegador se abre con la tecla w; en el celular con Expo Go en la misma red Wi-Fi, o con el instalador generado por `npx eas build -p android --profile preview`.'),
    H1('14. Pruebas'),
    H2('14.1. Niveles de prueba'),
    ...figura('piramide', 'Pirámide de pruebas de ServiLift', null),
    ...tablaAPA('Niveles de prueba', ['Nivel', 'Herramienta', 'Ubicación', 'Comando'], [
      ['Unitarias de la app', 'Vitest', 'servilift-app/tests (8 archivos, 110 pruebas)', 'npm test'],
      ['Unitarias del backend', 'pytest', 'servilift-backend/tests/unit (6 archivos, 103 pruebas)', 'uv run pytest'],
      ['Integración', 'pytest -m integracion', 'servilift-backend/tests/integration', 'uv run pytest -m integracion'],
      ['Extremo a extremo', 'Playwright (Chromium)', 'e2e/tests (5 flujos)', 'pnpm test'],
    ], [2000, 2000, 3460, 1900]),
    H2('14.2. Cobertura'),
    ...tablaAPA('Umbral y cobertura medida', ['Proyecto', 'Umbral exigido', 'Cobertura medida'], [
      ['App', 'Líneas 41 %, ramas 61 %, funciones 32 %, sentencias 43 %', 'Líneas 42,4 %, ramas 61,3 %, funciones 34,6 %, sentencias 43,9 %'],
      ['Backend', '44 % (fail_under)', '44,7 %'],
    ], [1600, 3880, 3880], 'Si la cobertura baja del umbral, la prueba falla en la integración continua.'),
    H2('14.3. Mutación manual'),
    P('Para comprobar que las pruebas detectan defectos reales se aplicó mutación manual: se introduce a propósito un cambio pequeño en el código (por ejemplo, cambiar > por >= o invertir una condición), se corre toda la suite y se observa si algún test falla. Si ninguno falla, el mutante sobrevive y falta un caso de prueba; si alguno falla, las pruebas protegen esa regla y se deshace la mutación.'),
    ...figura('mutacion', 'Ciclo de la mutación manual', null),
    H2('14.4. Integración continua'),
    P('Cada pull request hacia main o version-2.1 ejecuta en GitHub Actions las pruebas de la app y del backend con su umbral de cobertura, y un tercer trabajo que reporta los commits de pruebas por autor en la semana.'),
    ...figura('ci', 'Integración continua en GitHub Actions', null),
  ];
}

function cierre() {
  return [
    H1('15. Conclusiones'),
    P('ServiLift cumple el objetivo general: el servicio de inspección de ascensores ya es un flujo digital de punta a punta, con trazabilidad en cada cambio de estado y con funcionamiento sin conexión para el inspector, que era la necesidad principal del trabajo en campo.'),
    P('El paso del diseño inicial a la implementación dejó un modelo de datos más completo (31 tablas frente a las 12 entidades del primer modelo), porque el trabajo real exigió separar el servicio por equipo, guardar la norma como dato, registrar el historial de estados y manejar dos visitas por servicio. Presentar los casos de uso y los datos por rol ayuda a validar con cada área que el sistema hace lo que esa área necesita y nada más.'),
    P('Quedan como trabajo futuro la recuperación de contraseña por correo, el respaldo automático programado, los reportes exportables y la integración con sistemas contables, señalados en la trazabilidad de requisitos como parciales o pendientes.'),
    H1('Referencias'),
    ...[
      'American Psychological Association. (2020). Publication manual of the American Psychological Association (7.ª ed.).',
      'Expo. (2026). Expo documentation. https://docs.expo.dev',
      'FastAPI. (2026). FastAPI documentation. https://fastapi.tiangolo.com',
      'Instituto Colombiano de Normas Técnicas y Certificación. (2012). NTC 5926-1: Revisión técnico-mecánica de sistemas de transporte vertical y puertas eléctricas. Parte 1: Ascensores electromecánicos e hidráulicos. ICONTEC.',
      'International Organization for Standardization. (2012). ISO/IEC 17020:2012 Evaluación de la conformidad. Requisitos para el funcionamiento de diferentes tipos de organismos que realizan la inspección. ISO.',
      'Congreso de la República de Colombia. (2012). Ley 1581 de 2012, por la cual se dictan disposiciones generales para la protección de datos personales.',
      'Congreso de la República de Colombia. (2011). Ley 1480 de 2011, Estatuto del Consumidor.',
      'MariaDB Foundation. (2026). MariaDB Server documentation. https://mariadb.com/kb',
      'SQLAlchemy. (2026). SQLAlchemy 2.0 documentation. https://docs.sqlalchemy.org',
    ].map((t) => new Paragraph({ children: [new TextRun(t)], spacing: { line: 480 }, indent: { left: 720, hanging: 720 } })),
  ];
}

// ---------------------------------------------------------------- documento
const RUTA_PAG = require('path').join(__dirname, 'paginas.json');
const PAGINAS = process.env.SIN_PAGINAS ? null : (fs.existsSync(RUTA_PAG) ? JSON.parse(fs.readFileSync(RUTA_PAG, 'utf8')) : null);
const cuerpo = [...resumen(), ...negocio(), ...requisitos(), ...casosDeUso(), ...flujo(), ...arquitectura(), ...datos(), ...api(), ...instalacion(), ...cierre()];

const doc = new Document({
  creator: 'Equipo ServiLift', title: 'ServiLift: documentación técnica', description: 'Proyecto formativo ServiLift',
  styles: {
    default: { document: { run: { font: M.FUENTE, size: 24 } } },
    paragraphStyles: [
      { id: 'Heading1', name: 'Heading 1', basedOn: 'Normal', next: 'Normal', quickFormat: true, run: { size: 24, bold: true, font: M.FUENTE, color: '000000' }, paragraph: { alignment: AlignmentType.CENTER, spacing: { before: 240, after: 240 }, outlineLevel: 0 } },
      { id: 'Heading2', name: 'Heading 2', basedOn: 'Normal', next: 'Normal', quickFormat: true, run: { size: 24, bold: true, font: M.FUENTE, color: '000000' }, paragraph: { spacing: { before: 240, after: 120 }, outlineLevel: 1, keepNext: true } },
      { id: 'Heading3', name: 'Heading 3', basedOn: 'Normal', next: 'Normal', quickFormat: true, run: { size: 24, bold: true, italics: true, font: M.FUENTE, color: '000000' }, paragraph: { spacing: { before: 200, after: 120 }, outlineLevel: 2, keepNext: true } },
    ],
  },
  numbering: {
    config: [
      { reference: 'vinetas', levels: [{ level: 0, format: LevelFormat.BULLET, text: '●', alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 1080, hanging: 360 } } } }] },
      ...M.numeraciones.map((ref) => ({ reference: ref, levels: [{ level: 0, format: LevelFormat.DECIMAL, text: '%1.', alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 1080, hanging: 360 } } } }] })),
    ],
  },
  sections: [
    { properties: { page: { size: { width: 12240, height: 15840 }, margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 } } }, children: portada() },
    {
      properties: { page: { size: { width: 12240, height: 15840 }, margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 }, pageNumbers: { start: 2 } } },
      headers: { default: new Header({ children: [new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ children: [PageNumber.CURRENT] })] })] }) },
      children: [...indice(M.encabezados, PAGINAS), ...cuerpo],
    },
  ],
});

fs.writeFileSync(require('path').join(__dirname, 'encabezados.json'), JSON.stringify(M.encabezados));
Packer.toBuffer(doc).then((b) => { fs.writeFileSync(M.SALIDA, b); console.log('Escrito', M.SALIDA, (b.length / 1e6).toFixed(1), 'MB'); });
