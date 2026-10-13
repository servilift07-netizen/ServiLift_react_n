-- =====================================================================
-- ServiLift v2 - Esquema de base de datos
-- Gestión de certificación de ascensores (NTC 5926)
-- Motor: MariaDB 10.4+ / MySQL 8+  (InnoDB, utf8mb4)
--
-- Flujo principal:
--   Asesor crea cliente -> edificios -> equipos
--   Asesor crea cotización (un edificio, equipos elegidos uno a uno, valor y norma por equipo)
--   Cliente aprueba -> Asesor acepta y envía a Programación
--   Programación asigna fecha, hora e inspector (notificación)
--   Inspector (móvil) selecciona variantes, llena checklist, fotos, firmas, finaliza
--   Director técnico revisa, atesta, firma y aprueba -> INFORME DE PRIMERA VISITA
--     · Conforme      -> Certificados emite el certificado
--     · No conforme   -> plazo de corrección -> SEGUNDA VISITA (cierre de hallazgos)
--                         -> INFORME DE SEGUNDA VISITA
--                            · todos corregidos  -> Certificados
--                            · alguno sin corregir -> CERRADO_NO_CONFORME: el equipo
--                              necesita una cotización nueva (otra primera visita)
--
-- Solo existen dos visitas por servicio. Cada equipo cotizado tiene su informe de
-- 1ª visita y, si aplica, su informe de 2ª visita (tabla informe, una fila por visita).
--
-- Normas: tabla `norma` (NTC 5926-1:2012 hoy; 5926-1 de otras ediciones y las partes
-- 2 y 3 se agregan como filas nuevas con su propio checklist).
--
-- Fechas: todas DATETIME en hora de Colombia (UTC-5, sin horario de verano).
-- El backend fija time_zone = '-05:00' en cada conexión.
--
-- La llave de seguimiento es cotizacion.numero_cotizacion (COT-AAAA-NNNN);
-- cada equipo cotizado tiene cotizacion_equipo.codigo_servicio (COT-AAAA-NNNN-NN).
-- =====================================================================

CREATE DATABASE IF NOT EXISTS servilift_db
  CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE servilift_db;
SET NAMES utf8mb4;
SET time_zone = '-05:00';

-- ---------------------------------------------------------------------
-- 1. Seguridad: roles y usuarios
-- ---------------------------------------------------------------------
CREATE TABLE rol (
  id_rol          INT AUTO_INCREMENT PRIMARY KEY,
  codigo          VARCHAR(30)  NOT NULL UNIQUE COMMENT 'ADMIN, ASESOR, CLIENTE, PROGRAMACION, INSPECTOR, DIRECTOR_TECNICO, CERTIFICADOS',
  nombre          VARCHAR(60)  NOT NULL,
  descripcion     VARCHAR(255) NULL,
  fecha_creacion  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- La llave hacia cliente se agrega al final (cliente depende de usuario por el asesor)
CREATE TABLE usuario (
  id_usuario        INT AUTO_INCREMENT PRIMARY KEY,
  id_rol            INT NOT NULL,
  id_cliente        INT NULL COMMENT 'Solo para usuarios con rol CLIENTE: empresa a la que pertenecen',
  nombre_completo   VARCHAR(150) NOT NULL,
  correo            VARCHAR(120) NOT NULL UNIQUE,
  contrasena_hash   VARCHAR(255) NOT NULL COMMENT 'bcrypt',
  tipo_documento    ENUM('CC','CE','NIT','PPT','PAS') NULL,
  documento         VARCHAR(30)  NULL,
  telefono          VARCHAR(30)  NULL,
  cargo             VARCHAR(100) NULL,
  matricula_profesional VARCHAR(60) NULL COMMENT 'Inspector / director técnico',
  ruta_firma        VARCHAR(500) NULL COMMENT 'Firma registrada (director técnico, inspector)',
  estado            ENUM('ACTIVO','INACTIVO','BLOQUEADO') NOT NULL DEFAULT 'ACTIVO',
  ultima_sesion     DATETIME NULL,
  fecha_registro    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  fecha_modificacion DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_usuario_rol FOREIGN KEY (id_rol) REFERENCES rol(id_rol),
  INDEX ix_usuario_rol (id_rol, estado),
  INDEX ix_usuario_cliente (id_cliente),
  INDEX ix_usuario_nombre (nombre_completo)
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------
-- 2. Clientes, edificios y equipos
-- ---------------------------------------------------------------------
CREATE TABLE cliente (
  id_cliente        INT AUTO_INCREMENT PRIMARY KEY,
  id_asesor         INT NOT NULL COMMENT 'Asesor que registró / atiende al cliente',
  tipo_documento    ENUM('NIT','CC','CE','PPT','PAS') NOT NULL DEFAULT 'NIT',
  numero_documento  VARCHAR(30)  NOT NULL,
  razon_social      VARCHAR(200) NOT NULL,
  tipo_cliente      ENUM('PROPIEDAD_HORIZONTAL','EMPRESA','PERSONA_NATURAL','ENTIDAD_PUBLICA') NOT NULL DEFAULT 'PROPIEDAD_HORIZONTAL',
  contacto_nombre   VARCHAR(150) NULL,
  contacto_cargo    VARCHAR(100) NULL,
  contacto_correo   VARCHAR(120) NULL,
  contacto_telefono VARCHAR(30)  NULL,
  direccion         VARCHAR(250) NULL,
  ciudad            VARCHAR(100) NULL,
  estado            ENUM('ACTIVO','INACTIVO') NOT NULL DEFAULT 'ACTIVO',
  fecha_registro    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  fecha_modificacion DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_cliente_documento (tipo_documento, numero_documento),
  CONSTRAINT fk_cliente_asesor FOREIGN KEY (id_asesor) REFERENCES usuario(id_usuario),
  INDEX ix_cliente_asesor (id_asesor),
  INDEX ix_cliente_razon_social (razon_social),
  INDEX ix_cliente_contacto (contacto_nombre)
) ENGINE=InnoDB;

ALTER TABLE usuario
  ADD CONSTRAINT fk_usuario_cliente FOREIGN KEY (id_cliente) REFERENCES cliente(id_cliente) ON DELETE SET NULL;

CREATE TABLE edificio (
  id_edificio            INT AUTO_INCREMENT PRIMARY KEY,
  id_cliente             INT NOT NULL,
  nombre                 VARCHAR(150) NOT NULL COMMENT 'Ej: Edificio Torres del Parque - Torre A',
  direccion              VARCHAR(250) NOT NULL,
  barrio                 VARCHAR(100) NULL,
  ciudad                 VARCHAR(100) NOT NULL,
  departamento           VARCHAR(100) NULL,
  numero_pisos           INT NULL,
  numero_equipos         INT NOT NULL DEFAULT 0 COMMENT 'Cantidad de ascensores declarada por el cliente',
  administrador_nombre   VARCHAR(150) NULL COMMENT 'Representante del edificio',
  administrador_telefono VARCHAR(30)  NULL,
  administrador_correo   VARCHAR(120) NULL,
  empresa_mantenimiento  VARCHAR(150) NULL,
  latitud                DECIMAL(10,8) NULL,
  longitud               DECIMAL(11,8) NULL,
  estado                 ENUM('ACTIVO','INACTIVO') NOT NULL DEFAULT 'ACTIVO',
  fecha_registro         DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  fecha_modificacion     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_edificio_cliente FOREIGN KEY (id_cliente) REFERENCES cliente(id_cliente),
  INDEX ix_edificio_cliente (id_cliente),
  INDEX ix_edificio_nombre (nombre),
  INDEX ix_edificio_ciudad (ciudad)
) ENGINE=InnoDB;

CREATE TABLE equipo (
  id_equipo          INT AUTO_INCREMENT PRIMARY KEY,
  id_edificio        INT NOT NULL,
  identificacion     VARCHAR(80)  NOT NULL COMMENT 'Como lo llama el edificio: Ascensor 1, Ascensor Torre B, Montacargas',
  tipo_equipo        ENUM('ASCENSOR_PASAJEROS','ASCENSOR_CARGA','MONTACARGAS','MONTACAMILLAS','ASCENSOR_VEHICULAR','OTRO') NOT NULL DEFAULT 'ASCENSOR_PASAJEROS',
  marca              VARCHAR(80)  NULL,
  modelo             VARCHAR(80)  NULL,
  numero_serie       VARCHAR(80)  NULL,
  anio_fabricacion   SMALLINT NULL,
  capacidad_kg       INT NULL,
  capacidad_personas INT NULL,
  numero_paradas     INT NULL,
  recorrido_m        DECIMAL(8,2) NULL,
  velocidad_ms       DECIMAL(5,2) NULL,
  profundidad_foso_mm INT NULL,
  fecha_puesta_marcha DATE NULL,
  estado             ENUM('ACTIVO','FUERA_SERVICIO','INACTIVO') NOT NULL DEFAULT 'ACTIVO',
  fecha_registro     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  fecha_modificacion DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_equipo_edificio (id_edificio, identificacion),
  CONSTRAINT fk_equipo_edificio FOREIGN KEY (id_edificio) REFERENCES edificio(id_edificio),
  INDEX ix_equipo_serie (numero_serie)
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------
-- 3. Normas técnicas (versionadas)
--    Una fila por parte y edición: NTC 5926-1:2012, NTC 5926-1:2021, NTC 5926-2:..., etc.
--    Cada norma tiene su propio checklist (categorías e ítems) y sus plazos de corrección.
--    Solo una edición por parte puede estar vigente (es la que se usa en las cotizaciones nuevas).
-- ---------------------------------------------------------------------
CREATE TABLE norma (
  id_norma             INT AUTO_INCREMENT PRIMARY KEY,
  codigo               VARCHAR(20)  NOT NULL COMMENT 'NTC 5926-1, NTC 5926-2, NTC 5926-3',
  parte                TINYINT      NOT NULL COMMENT '1 = ascensores, 2 y 3 = siguientes partes de la norma',
  version              SMALLINT     NOT NULL COMMENT 'Año de la edición: 2012, 2021...',
  nombre               VARCHAR(255) NOT NULL,
  titulo_informe       VARCHAR(255) NOT NULL COMMENT 'Título del PDF del informe',
  plazo_dias_leve      INT NOT NULL DEFAULT 180 COMMENT 'Días para corregir un defecto LEVE',
  plazo_dias_grave     INT NOT NULL DEFAULT 30  COMMENT 'Días para corregir un defecto GRAVE',
  plazo_dias_muy_grave INT NOT NULL DEFAULT 0   COMMENT 'Días para corregir un defecto MUY GRAVE (0 = inmediato)',
  vigente              TINYINT(1) NOT NULL DEFAULT 0 COMMENT 'Edición que se usa en las cotizaciones nuevas de esta parte',
  activo               TINYINT(1) NOT NULL DEFAULT 1,
  vigente_parte        TINYINT AS (IF(vigente = 1, parte, NULL)) STORED COMMENT 'Garantiza una sola edición vigente por parte',
  fecha_creacion       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_norma (codigo, version),
  UNIQUE KEY uq_norma_vigente (vigente_parte)
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------
-- 4. Variantes del equipo (tracción / hidráulico, enhebrado, máquina...)
--    Catálogo configurable por parte de la norma; el inspector las elige al abrir
--    el informe y filtran qué ítems del checklist aplican.
-- ---------------------------------------------------------------------
CREATE TABLE variante_tipo (
  id_variante_tipo INT AUTO_INCREMENT PRIMARY KEY,
  parte_norma      TINYINT NOT NULL DEFAULT 1 COMMENT 'Parte de la NTC 5926 a la que pertenece (1 = ascensores)',
  codigo           VARCHAR(40)  NOT NULL COMMENT 'ACCIONAMIENTO, SUSPENSION, MAQUINA, CUARTO_MAQUINAS...',
  nombre           VARCHAR(100) NOT NULL,
  obligatoria      TINYINT(1) NOT NULL DEFAULT 1,
  orden            INT NOT NULL DEFAULT 0,
  activo           TINYINT(1) NOT NULL DEFAULT 1,
  UNIQUE KEY uq_variante_tipo (parte_norma, codigo)
) ENGINE=InnoDB;

CREATE TABLE variante_opcion (
  id_variante_opcion INT AUTO_INCREMENT PRIMARY KEY,
  id_variante_tipo   INT NOT NULL,
  codigo             VARCHAR(40)  NOT NULL,
  nombre             VARCHAR(100) NOT NULL,
  orden              INT NOT NULL DEFAULT 0,
  activo             TINYINT(1) NOT NULL DEFAULT 1,
  UNIQUE KEY uq_opcion (id_variante_tipo, codigo),
  CONSTRAINT fk_opcion_tipo FOREIGN KEY (id_variante_tipo) REFERENCES variante_tipo(id_variante_tipo)
) ENGINE=InnoDB;

-- Últimas variantes conocidas del equipo (precargan la siguiente inspección)
CREATE TABLE equipo_variante (
  id_equipo          INT NOT NULL,
  id_variante_tipo   INT NOT NULL,
  id_variante_opcion INT NOT NULL,
  PRIMARY KEY (id_equipo, id_variante_tipo),
  CONSTRAINT fk_eqvar_equipo FOREIGN KEY (id_equipo) REFERENCES equipo(id_equipo) ON DELETE CASCADE,
  CONSTRAINT fk_eqvar_tipo   FOREIGN KEY (id_variante_tipo) REFERENCES variante_tipo(id_variante_tipo),
  CONSTRAINT fk_eqvar_opcion FOREIGN KEY (id_variante_opcion) REFERENCES variante_opcion(id_variante_opcion)
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------
-- 5. Numeración consecutiva (COT, INS, INF, CER)
-- ---------------------------------------------------------------------
CREATE TABLE consecutivo (
  prefijo       VARCHAR(10) NOT NULL,
  anio          SMALLINT    NOT NULL,
  ultimo_numero INT NOT NULL DEFAULT 0,
  PRIMARY KEY (prefijo, anio)
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------
-- 6. Cotizaciones
-- ---------------------------------------------------------------------
CREATE TABLE cotizacion (
  id_cotizacion            INT AUTO_INCREMENT PRIMARY KEY,
  numero_cotizacion        VARCHAR(20) NOT NULL UNIQUE COMMENT 'COT-2026-0001',
  id_cliente               INT NOT NULL COMMENT 'Copia de edificio.id_cliente para filtrar rápido por cliente',
  id_edificio              INT NOT NULL,
  id_asesor                INT NOT NULL,
  fecha_cotizacion         DATE NOT NULL,
  dias_validez             INT NOT NULL DEFAULT 30,
  subtotal                 DECIMAL(14,2) NOT NULL DEFAULT 0,
  iva_porcentaje           DECIMAL(5,2)  NOT NULL DEFAULT 19.00,
  iva_valor                DECIMAL(14,2) NOT NULL DEFAULT 0,
  total                    DECIMAL(14,2) NOT NULL DEFAULT 0,
  estado                   ENUM('BORRADOR','ENVIADA_CLIENTE','APROBADA_CLIENTE','RECHAZADA_CLIENTE','ENVIADA_PROGRAMACION','EN_EJECUCION','FINALIZADA','ANULADA') NOT NULL DEFAULT 'BORRADOR',
  condiciones              TEXT NULL,
  observaciones            TEXT NULL,
  fecha_envio_cliente      DATETIME NULL,
  fecha_respuesta_cliente  DATETIME NULL,
  id_usuario_respuesta     INT NULL COMMENT 'Usuario cliente que aprobó / rechazó',
  comentario_cliente       TEXT NULL,
  fecha_envio_programacion DATETIME NULL COMMENT 'Asesor acepta y envía a programación',
  ruta_pdf                 VARCHAR(500) NULL,
  fecha_creacion           DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  fecha_modificacion       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_cot_cliente   FOREIGN KEY (id_cliente)  REFERENCES cliente(id_cliente),
  CONSTRAINT fk_cot_edificio  FOREIGN KEY (id_edificio) REFERENCES edificio(id_edificio),
  CONSTRAINT fk_cot_asesor    FOREIGN KEY (id_asesor)   REFERENCES usuario(id_usuario),
  CONSTRAINT fk_cot_respuesta FOREIGN KEY (id_usuario_respuesta) REFERENCES usuario(id_usuario),
  INDEX ix_cot_cliente (id_cliente),
  INDEX ix_cot_edificio (id_edificio),
  INDEX ix_cot_asesor (id_asesor, estado),
  INDEX ix_cot_estado (estado),
  INDEX ix_cot_fecha (fecha_cotizacion)
) ENGINE=InnoDB;

-- Un renglón por equipo cotizado. Aquí vive el ESTADO POR EQUIPO que ve el cliente.
CREATE TABLE cotizacion_equipo (
  id_cotizacion_equipo INT AUTO_INCREMENT PRIMARY KEY,
  id_cotizacion        INT NOT NULL,
  id_equipo            INT NOT NULL,
  id_norma             INT NOT NULL COMMENT 'Norma (parte y edición) con la que se inspecciona',
  codigo_servicio      VARCHAR(25) NOT NULL UNIQUE COMMENT 'COT-2026-0001-01',
  tipo_servicio        ENUM('INSPECCION_INICIAL','INSPECCION_PERIODICA','REINSPECCION','EXTRAORDINARIA') NOT NULL DEFAULT 'INSPECCION_PERIODICA',
  descripcion          VARCHAR(255) NULL,
  valor                DECIMAL(14,2) NOT NULL,
  estado               ENUM(
                         'PENDIENTE_APROBACION',  -- cotización enviada al cliente
                         'APROBADO_CLIENTE',      -- cliente aprobó, falta que el asesor la pase
                         'POR_PROGRAMAR',         -- en bandeja de programación
                         'PROGRAMADO',            -- fecha, hora e inspector asignados (1ª o 2ª visita)
                         'EN_INSPECCION',         -- inspector abrió el informe
                         'EN_REVISION',           -- inspector finalizó, lo revisa el director técnico
                         'NO_CONFORME',           -- informe de 1ª visita no conforme: se solicita la 2ª visita
                         'SEGUNDA_VISITA_SOLICITADA', -- solicitada: en bandeja de programación
                         'INFORME_APROBADO',      -- informe conforme, visible al cliente; en certificados
                         'CERTIFICADO_LISTO',     -- certificado disponible para descarga
                         'CERRADO_NO_CONFORME',   -- 2ª visita con hallazgos sin corregir: requiere cotización nueva
                         'RECHAZADO',
                         'ANULADO'
                       ) NOT NULL DEFAULT 'PENDIENTE_APROBACION',
  fecha_estado         DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  plazo_dias           INT NULL COMMENT 'Días para corregir y hacer la 2ª visita (según hallazgos del informe de 1ª visita)',
  fecha_limite_correccion DATE NULL,
  fecha_solicitud_visita2 DATETIME NULL,
  id_usuario_solicitud_visita2 INT NULL,
  id_servicio_anterior INT NULL COMMENT 'Servicio que quedó CERRADO_NO_CONFORME y originó esta nueva cotización',
  UNIQUE KEY uq_cot_equipo (id_cotizacion, id_equipo),
  CONSTRAINT fk_coteq_cotizacion FOREIGN KEY (id_cotizacion) REFERENCES cotizacion(id_cotizacion) ON DELETE CASCADE,
  CONSTRAINT fk_coteq_equipo     FOREIGN KEY (id_equipo)     REFERENCES equipo(id_equipo),
  CONSTRAINT fk_coteq_norma      FOREIGN KEY (id_norma)      REFERENCES norma(id_norma),
  CONSTRAINT fk_coteq_solicita   FOREIGN KEY (id_usuario_solicitud_visita2) REFERENCES usuario(id_usuario),
  CONSTRAINT fk_coteq_anterior   FOREIGN KEY (id_servicio_anterior) REFERENCES cotizacion_equipo(id_cotizacion_equipo),
  INDEX ix_coteq_estado (estado),
  INDEX ix_coteq_equipo (id_equipo)
) ENGINE=InnoDB;

-- Línea de tiempo por equipo (trazabilidad completa)
CREATE TABLE historial_estado (
  id_historial         BIGINT AUTO_INCREMENT PRIMARY KEY,
  id_cotizacion_equipo INT NOT NULL,
  estado_anterior      VARCHAR(30) NULL,
  estado_nuevo         VARCHAR(30) NOT NULL,
  id_usuario           INT NULL,
  comentario           VARCHAR(500) NULL,
  fecha                DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_hist_coteq   FOREIGN KEY (id_cotizacion_equipo) REFERENCES cotizacion_equipo(id_cotizacion_equipo) ON DELETE CASCADE,
  CONSTRAINT fk_hist_usuario FOREIGN KEY (id_usuario) REFERENCES usuario(id_usuario) ON DELETE SET NULL,
  INDEX ix_hist_coteq (id_cotizacion_equipo, fecha)
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------
-- 7. Programación
-- ---------------------------------------------------------------------
CREATE TABLE programacion (
  id_programacion    INT AUTO_INCREMENT PRIMARY KEY,
  id_cotizacion      INT NOT NULL,
  id_inspector       INT NOT NULL,
  id_programador     INT NOT NULL,
  tipo_visita        ENUM('PRIMERA','SEGUNDA') NOT NULL DEFAULT 'PRIMERA' COMMENT 'SEGUNDA = cierre de hallazgos (no hay más visitas)',
  fecha_programada   DATE NOT NULL,
  hora_inicio        TIME NOT NULL,
  hora_fin_estimada  TIME NULL,
  estado             ENUM('PROGRAMADA','REPROGRAMADA','EN_CURSO','REALIZADA','CANCELADA') NOT NULL DEFAULT 'PROGRAMADA',
  observaciones      VARCHAR(500) NULL,
  motivo_cambio      VARCHAR(255) NULL,
  fecha_creacion     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  fecha_modificacion DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_prog_cotizacion FOREIGN KEY (id_cotizacion)  REFERENCES cotizacion(id_cotizacion),
  CONSTRAINT fk_prog_inspector  FOREIGN KEY (id_inspector)   REFERENCES usuario(id_usuario),
  CONSTRAINT fk_prog_programador FOREIGN KEY (id_programador) REFERENCES usuario(id_usuario),
  INDEX ix_prog_inspector_fecha (id_inspector, fecha_programada),
  INDEX ix_prog_fecha_estado (fecha_programada, estado),
  INDEX ix_prog_cotizacion (id_cotizacion)
) ENGINE=InnoDB;

-- Equipos que cubre una visita (una visita puede incluir varios equipos del edificio)
CREATE TABLE programacion_equipo (
  id_programacion      INT NOT NULL,
  id_cotizacion_equipo INT NOT NULL,
  PRIMARY KEY (id_programacion, id_cotizacion_equipo),
  CONSTRAINT fk_progeq_prog  FOREIGN KEY (id_programacion)      REFERENCES programacion(id_programacion) ON DELETE CASCADE,
  CONSTRAINT fk_progeq_coteq FOREIGN KEY (id_cotizacion_equipo) REFERENCES cotizacion_equipo(id_cotizacion_equipo),
  INDEX ix_progeq_coteq (id_cotizacion_equipo)
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------
-- 8. Checklist por norma (catálogo)
-- ---------------------------------------------------------------------
CREATE TABLE checklist_categoria (
  id_categoria   INT AUTO_INCREMENT PRIMARY KEY,
  id_norma       INT NOT NULL,
  codigo         VARCHAR(20)  NOT NULL,
  nombre         VARCHAR(150) NOT NULL COMMENT 'Cuarto de máquinas, Cabina, Foso, Hueco, Puertas...',
  descripcion    VARCHAR(500) NULL,
  numeral_norma  VARCHAR(40)  NULL,
  orden          INT NOT NULL DEFAULT 0,
  activo         TINYINT(1) NOT NULL DEFAULT 1,
  UNIQUE KEY uq_categoria (id_norma, codigo),
  CONSTRAINT fk_cat_norma FOREIGN KEY (id_norma) REFERENCES norma(id_norma)
) ENGINE=InnoDB;

CREATE TABLE checklist_item (
  id_item               INT AUTO_INCREMENT PRIMARY KEY,
  id_norma              INT NOT NULL COMMENT 'Igual a la norma de su categoría',
  id_categoria          INT NOT NULL,
  numero                INT NOT NULL COMMENT 'Número de ítem en el informe (1..169 en la 5926-1:2012)',
  codigo                VARCHAR(20) NOT NULL COMMENT 'Ej: IT-001',
  numeral_norma         VARCHAR(40) NULL,
  descripcion           TEXT NOT NULL COMMENT 'Redactado como defecto: se marca NO CUMPLE si se presenta',
  criterio_cumplimiento TEXT NULL,
  calificacion          ENUM('LEVE','GRAVE','MUY_GRAVE') NOT NULL COMMENT 'Calificación del defecto: L, G, MG',
  requiere_medicion     TINYINT(1) NOT NULL DEFAULT 0 COMMENT 'Obligación de medida, sin estimaciones',
  requiere_foto_medicion TINYINT(1) NOT NULL DEFAULT 0 COMMENT 'Va en la hoja de evidencia fotográfica de equipos de medición',
  plazo_dias            INT NULL COMMENT 'Plazo propio de corrección; si es NULL se usa el de su calificación en la norma',
  unidad_medida         VARCHAR(20) NULL COMMENT 'mm, lux, m/s, kg, V...',
  foso_minimo_mm        INT NULL COMMENT 'Solo aplica si la profundidad de foso registrada es >= este valor',
  obligatorio           TINYINT(1) NOT NULL DEFAULT 1,
  orden                 INT NOT NULL DEFAULT 0,
  activo                TINYINT(1) NOT NULL DEFAULT 1,
  UNIQUE KEY uq_item_numero (id_norma, numero),
  UNIQUE KEY uq_item_codigo (id_norma, codigo),
  CONSTRAINT fk_item_norma     FOREIGN KEY (id_norma)     REFERENCES norma(id_norma),
  CONSTRAINT fk_item_categoria FOREIGN KEY (id_categoria) REFERENCES checklist_categoria(id_categoria),
  INDEX ix_item_categoria (id_categoria, orden)
) ENGINE=InnoDB;

-- Reglas de "aplica" por variante. Sin filas = el ítem aplica a todos los equipos.
-- Con filas: para cada tipo de variante presente, la opción elegida en la
-- inspección debe estar entre las opciones listadas (O dentro del mismo tipo,
-- Y entre tipos distintos). Si no se cumple, el ítem se precarga como NO_APLICA;
-- el inspector siempre puede cambiarlo.
CREATE TABLE checklist_item_variante (
  id_item            INT NOT NULL,
  id_variante_opcion INT NOT NULL,
  PRIMARY KEY (id_item, id_variante_opcion),
  CONSTRAINT fk_itemvar_item   FOREIGN KEY (id_item) REFERENCES checklist_item(id_item) ON DELETE CASCADE,
  CONSTRAINT fk_itemvar_opcion FOREIGN KEY (id_variante_opcion) REFERENCES variante_opcion(id_variante_opcion)
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------
-- 9. Inspección (app móvil del inspector)
--    Una inspección por equipo cotizado. Guarda las dos únicas visitas posibles:
--    la primera (checklist completo) y la segunda (cierre de hallazgos).
-- ---------------------------------------------------------------------
CREATE TABLE inspeccion (
  id_inspeccion        INT AUTO_INCREMENT PRIMARY KEY,
  numero_inspeccion    VARCHAR(20) NOT NULL UNIQUE COMMENT 'INS-2026-0001',
  id_cotizacion_equipo INT NOT NULL,
  id_norma             INT NOT NULL COMMENT 'Copiada del servicio al abrir el informe',
  uuid_offline         CHAR(36) NULL UNIQUE COMMENT 'Generado en el celular para sincronizar sin duplicar',
  datos_equipo_json    LONGTEXT NULL COMMENT 'Copia de cliente/edificio/equipo al abrir el informe' CHECK (datos_equipo_json IS NULL OR JSON_VALID(datos_equipo_json)),
  -- Encabezado del informe
  conservacion_informacion ENUM('FISICO','DIGITAL') NOT NULL DEFAULT 'DIGITAL',
  tipo_acrilico        VARCHAR(80)  NULL COMMENT 'Tipo de acrílico de certificación',
  empresa_mantenimiento VARCHAR(150) NULL,
  tecnico_mantenimiento VARCHAR(150) NULL,
  fecha_ultimo_mantenimiento DATE NULL,
  fecha_puesta_marcha  DATE NULL COMMENT 'NI = no informa -> NULL',
  fecha_ultima_inspeccion DATE NULL,
  -- Características técnicas medidas / declaradas en la visita
  capacidad_kg         INT NULL,
  capacidad_personas   INT NULL,
  numero_paradas       INT NULL,
  profundidad_foso_mm  INT NULL,
  recorrido_m          DECIMAL(8,2) NULL,
  -- Primera visita
  id_programacion      INT NOT NULL,
  id_inspector         INT NOT NULL,
  fecha_inicio         DATETIME NOT NULL,
  fecha_fin            DATETIME NULL,
  -- Segunda visita (cierre de hallazgos). No existe una tercera.
  id_programacion_visita2 INT NULL,
  id_inspector_visita2 INT NULL,
  fecha_inicio_visita2 DATETIME NULL,
  fecha_fin_visita2    DATETIME NULL,
  estado               ENUM('EN_CURSO','FINALIZADA','DEVUELTA','APROBADA','EN_SEGUNDA_VISITA','CERRADA') NOT NULL DEFAULT 'EN_CURSO',
  observaciones_generales TEXT NULL,
  latitud              DECIMAL(10,8) NULL,
  longitud             DECIMAL(11,8) NULL,
  fecha_sincronizacion DATETIME NULL COMMENT 'Último guardado recibido desde el celular',
  fecha_creacion       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  fecha_modificacion   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_insp_coteq     FOREIGN KEY (id_cotizacion_equipo) REFERENCES cotizacion_equipo(id_cotizacion_equipo),
  CONSTRAINT fk_insp_norma     FOREIGN KEY (id_norma)             REFERENCES norma(id_norma),
  CONSTRAINT fk_insp_prog      FOREIGN KEY (id_programacion)      REFERENCES programacion(id_programacion),
  CONSTRAINT fk_insp_inspector FOREIGN KEY (id_inspector)         REFERENCES usuario(id_usuario),
  CONSTRAINT fk_insp_prog2     FOREIGN KEY (id_programacion_visita2) REFERENCES programacion(id_programacion),
  CONSTRAINT fk_insp_inspector2 FOREIGN KEY (id_inspector_visita2)  REFERENCES usuario(id_usuario),
  INDEX ix_insp_coteq (id_cotizacion_equipo),
  INDEX ix_insp_inspector (id_inspector, estado),
  INDEX ix_insp_inspector2 (id_inspector_visita2, estado)
) ENGINE=InnoDB;

-- Variantes elegidas por el inspector al abrir el informe
CREATE TABLE inspeccion_variante (
  id_inspeccion      INT NOT NULL,
  id_variante_tipo   INT NOT NULL,
  id_variante_opcion INT NOT NULL,
  PRIMARY KEY (id_inspeccion, id_variante_tipo),
  CONSTRAINT fk_inspvar_insp   FOREIGN KEY (id_inspeccion) REFERENCES inspeccion(id_inspeccion) ON DELETE CASCADE,
  CONSTRAINT fk_inspvar_tipo   FOREIGN KEY (id_variante_tipo) REFERENCES variante_tipo(id_variante_tipo),
  CONSTRAINT fk_inspvar_opcion FOREIGN KEY (id_variante_opcion) REFERENCES variante_opcion(id_variante_opcion)
) ENGINE=InnoDB;

-- Resultado de cada ítem del checklist
CREATE TABLE inspeccion_resultado (
  id_resultado        INT AUTO_INCREMENT PRIMARY KEY,
  id_inspeccion       INT NOT NULL,
  id_item             INT NOT NULL,
  resultado           ENUM('CUMPLE','NO_CUMPLE','NO_APLICA','NO_VERIFICADO') NOT NULL,
  calificacion_defecto ENUM('LEVE','GRAVE','MUY_GRAVE') NULL COMMENT 'Copia de checklist_item.calificacion cuando NO_CUMPLE',
  no_aplica_automatico TINYINT(1) NOT NULL DEFAULT 0 COMMENT 'Precargado por las variantes del equipo',
  valor_medido        VARCHAR(50) NULL,
  unidad_medida       VARCHAR(20) NULL,
  observacion         TEXT NULL,
  hallazgo_director   TINYINT(1) NOT NULL DEFAULT 0 COMMENT 'Hallazgo adicional identificado en la atestación',
  estado_segunda_visita ENUM('CORREGIDO','NO_CORREGIDO') NULL,
  observacion_segunda_visita TEXT NULL,
  modificado_en_cliente DATETIME(3) NULL COMMENT 'Hora del celular del último cambio: evita que un reenvío viejo pise uno nuevo',
  fecha_registro      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  fecha_modificacion  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_resultado (id_inspeccion, id_item),
  CONSTRAINT fk_res_insp FOREIGN KEY (id_inspeccion) REFERENCES inspeccion(id_inspeccion) ON DELETE CASCADE,
  CONSTRAINT fk_res_item FOREIGN KEY (id_item)       REFERENCES checklist_item(id_item),
  INDEX ix_res_item_resultado (id_item, resultado)
) ENGINE=InnoDB;

-- Álbum de fotos (~100 por equipo). Se guarda la ruta del archivo, no la imagen.
CREATE TABLE inspeccion_foto (
  id_foto         INT AUTO_INCREMENT PRIMARY KEY,
  id_inspeccion   INT NOT NULL,
  numero_visita   TINYINT NOT NULL DEFAULT 1 COMMENT '1 = primera visita, 2 = segunda visita (corrección)',
  id_resultado    INT NULL COMMENT 'Opcional: foto asociada a un hallazgo',
  uuid_offline    CHAR(36) NULL UNIQUE,
  nombre_archivo  VARCHAR(255) NOT NULL,
  ruta_archivo    VARCHAR(500) NOT NULL,
  ruta_miniatura  VARCHAR(500) NULL,
  tamano_kb       INT NULL,
  descripcion     VARCHAR(300) NULL,
  orden           INT NOT NULL DEFAULT 0,
  incluir_en_informe TINYINT(1) NOT NULL DEFAULT 1 COMMENT 'El director puede excluirla del PDF',
  revisada        TINYINT(1) NOT NULL DEFAULT 0 COMMENT 'Revisada por el director técnico',
  fecha_captura   DATETIME NULL,
  latitud         DECIMAL(10,8) NULL,
  longitud        DECIMAL(11,8) NULL,
  fecha_subida    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT ck_foto_visita CHECK (numero_visita IN (1, 2)),
  CONSTRAINT fk_foto_insp      FOREIGN KEY (id_inspeccion) REFERENCES inspeccion(id_inspeccion) ON DELETE CASCADE,
  CONSTRAINT fk_foto_resultado FOREIGN KEY (id_resultado)  REFERENCES inspeccion_resultado(id_resultado) ON DELETE SET NULL,
  INDEX ix_foto_insp (id_inspeccion, numero_visita, orden)
) ENGINE=InnoDB;

-- Firmas de cada visita: inspector, técnico de mantenimiento y representante del edificio
CREATE TABLE inspeccion_firma (
  id_firma       INT AUTO_INCREMENT PRIMARY KEY,
  id_inspeccion  INT NOT NULL,
  numero_visita  TINYINT NOT NULL DEFAULT 1 COMMENT '1 = primera visita, 2 = cierre de hallazgos',
  tipo_firmante  ENUM('INSPECTOR','TECNICO_MANTENIMIENTO','REPRESENTANTE_EDIFICIO') NOT NULL,
  id_usuario     INT NULL COMMENT 'Si el firmante es usuario del sistema (inspector)',
  uuid_offline   CHAR(36) NULL UNIQUE,
  nombre         VARCHAR(150) NOT NULL,
  documento      VARCHAR(30)  NULL,
  cargo          VARCHAR(100) NULL,
  empresa        VARCHAR(150) NULL COMMENT 'Empresa de mantenimiento del técnico',
  ruta_firma     VARCHAR(500) NOT NULL COMMENT 'PNG de la firma',
  fecha_firma    DATETIME NOT NULL,
  CONSTRAINT ck_firma_visita CHECK (numero_visita IN (1, 2)),
  UNIQUE KEY uq_firma (id_inspeccion, numero_visita, tipo_firmante),
  CONSTRAINT fk_firma_insp    FOREIGN KEY (id_inspeccion) REFERENCES inspeccion(id_inspeccion) ON DELETE CASCADE,
  CONSTRAINT fk_firma_usuario FOREIGN KEY (id_usuario)    REFERENCES usuario(id_usuario) ON DELETE SET NULL
) ENGINE=InnoDB;

-- Instrumentos de medición (luxómetro, tacómetro, flexómetro...) asignados a cada inspector
CREATE TABLE instrumento_medicion (
  id_instrumento    INT AUTO_INCREMENT PRIMARY KEY,
  codigo            VARCHAR(30) NOT NULL UNIQUE COMMENT 'Código interno, ej. LX07',
  tipo              ENUM('LUXOMETRO','TACOMETRO','FLEXOMETRO','ESCALA_PLANA','ESCALA_PUNTA','PIE_DE_REY','MEDIDOR_ANGULO','PINZA_AMPERIMETRICA','DINAMOMETRO','OTRO') NOT NULL,
  marca             VARCHAR(80) NULL,
  serial            VARCHAR(80) NULL,
  id_inspector      INT NULL COMMENT 'Inspector que lo tiene asignado',
  fecha_calibracion DATE NULL,
  vence_calibracion DATE NULL,
  estado            ENUM('ACTIVO','EN_CALIBRACION','INACTIVO') NOT NULL DEFAULT 'ACTIVO',
  CONSTRAINT fk_instr_inspector FOREIGN KEY (id_inspector) REFERENCES usuario(id_usuario) ON DELETE SET NULL,
  INDEX ix_instr_inspector (id_inspector)
) ENGINE=InnoDB;

-- Instrumentos usados en la inspección (se precargan con los del inspector)
CREATE TABLE inspeccion_instrumento (
  id_inspeccion  INT NOT NULL,
  id_instrumento INT NOT NULL,
  PRIMARY KEY (id_inspeccion, id_instrumento),
  CONSTRAINT fk_inspinst_insp  FOREIGN KEY (id_inspeccion)  REFERENCES inspeccion(id_inspeccion) ON DELETE CASCADE,
  CONSTRAINT fk_inspinst_instr FOREIGN KEY (id_instrumento) REFERENCES instrumento_medicion(id_instrumento)
) ENGINE=InnoDB;

-- Mediciones calculadas (ej. factor de deslizamiento con enhebrado y recorrido)
CREATE TABLE inspeccion_medicion (
  id_medicion    INT AUTO_INCREMENT PRIMARY KEY,
  id_inspeccion  INT NOT NULL,
  id_item        INT NULL,
  concepto       VARCHAR(80) NOT NULL COMMENT 'DESLIZAMIENTO, RECORRIDO, DIAMETRO_CABLE, DESGASTE_ZAPATA...',
  valor          DECIMAL(12,4) NULL,
  unidad         VARCHAR(20) NULL,
  resultado      ENUM('CUMPLE','NO_CUMPLE') NULL,
  detalle        VARCHAR(255) NULL,
  CONSTRAINT fk_med_insp FOREIGN KEY (id_inspeccion) REFERENCES inspeccion(id_inspeccion) ON DELETE CASCADE,
  CONSTRAINT fk_med_item FOREIGN KEY (id_item) REFERENCES checklist_item(id_item),
  INDEX ix_med_insp (id_inspeccion)
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------
-- 10. Informe: UNA FILA POR VISITA
--     numero_visita = 1 -> informe de primera visita (INF-AAAA-NNNN-1V)
--     numero_visita = 2 -> informe de segunda visita / cierre de hallazgos (INF-AAAA-NNNN-2V)
--     Cada informe tiene su propia revisión, atestación, firma del director, PDF y huella.
-- ---------------------------------------------------------------------
CREATE TABLE informe (
  id_informe            INT AUTO_INCREMENT PRIMARY KEY,
  numero_informe        VARCHAR(25) NOT NULL UNIQUE COMMENT 'INF-2026-0001-1V / INF-2026-0001-2V',
  id_inspeccion         INT NOT NULL,
  numero_visita         TINYINT NOT NULL COMMENT '1 = primera visita, 2 = segunda visita',
  id_director           INT NULL,
  estado                ENUM('PENDIENTE_REVISION','DEVUELTO','APROBADO','ANULADO') NOT NULL DEFAULT 'PENDIENTE_REVISION',
  concepto              ENUM('CONFORME','NO_CONFORME') NULL,
  atestacion            TEXT NULL COMMENT 'Texto de atestación del director técnico',
  observaciones_revision TEXT NULL COMMENT 'Motivo de devolución o comentarios',
  ruta_firma_director   VARCHAR(500) NULL,
  -- Resumen de hallazgos, congelado al aprobar
  total_leves           INT NOT NULL DEFAULT 0,
  total_graves          INT NOT NULL DEFAULT 0,
  total_muy_graves      INT NOT NULL DEFAULT 0,
  total_no_aplica       INT NOT NULL DEFAULT 0,
  total_corregidos      INT NOT NULL DEFAULT 0 COMMENT 'Solo segunda visita',
  total_no_corregidos   INT NOT NULL DEFAULT 0 COMMENT 'Solo segunda visita',
  fecha_revision        DATETIME NULL,
  fecha_aprobacion      DATETIME NULL,
  ruta_pdf              VARCHAR(500) NULL,
  hash_sha256           CHAR(64) NULL,
  fecha_envio_cliente   DATETIME NULL,
  fecha_envio_certificados DATETIME NULL,
  fecha_creacion        DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT ck_informe_visita CHECK (numero_visita IN (1, 2)),
  UNIQUE KEY uq_informe_visita (id_inspeccion, numero_visita),
  CONSTRAINT fk_inf_insp     FOREIGN KEY (id_inspeccion) REFERENCES inspeccion(id_inspeccion),
  CONSTRAINT fk_inf_director FOREIGN KEY (id_director)   REFERENCES usuario(id_usuario),
  INDEX ix_inf_estado (estado, numero_visita)
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------
-- 11. Certificado (se emite sobre el informe conforme: de 1ª o de 2ª visita)
-- ---------------------------------------------------------------------
CREATE TABLE certificado (
  id_certificado       INT AUTO_INCREMENT PRIMARY KEY,
  numero_certificado   VARCHAR(20) NOT NULL UNIQUE COMMENT 'CER-2026-0001',
  id_informe           INT NOT NULL UNIQUE,
  id_cotizacion_equipo INT NOT NULL COMMENT 'Copia para buscar rápido por servicio',
  id_emisor            INT NULL COMMENT 'Usuario rol CERTIFICADOS',
  estado               ENUM('EN_ELABORACION','EMITIDO','ENVIADO_CLIENTE','ANULADO') NOT NULL DEFAULT 'EN_ELABORACION',
  fecha_emision        DATE NULL,
  fecha_vencimiento    DATE NULL,
  codigo_verificacion  VARCHAR(40) NULL UNIQUE COMMENT 'Para el QR de verificación',
  ruta_pdf             VARCHAR(500) NULL,
  hash_sha256          CHAR(64) NULL,
  fecha_envio_cliente  DATETIME NULL,
  motivo_anulacion     VARCHAR(255) NULL,
  fecha_creacion       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_cert_informe FOREIGN KEY (id_informe)           REFERENCES informe(id_informe),
  CONSTRAINT fk_cert_coteq   FOREIGN KEY (id_cotizacion_equipo) REFERENCES cotizacion_equipo(id_cotizacion_equipo),
  CONSTRAINT fk_cert_emisor  FOREIGN KEY (id_emisor)            REFERENCES usuario(id_usuario),
  INDEX ix_cert_coteq (id_cotizacion_equipo),
  INDEX ix_cert_estado (estado),
  INDEX ix_cert_vencimiento (fecha_vencimiento)
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------
-- 12. Parámetros de la empresa (nombre, código de formato, texto de atestación...)
--     Los plazos de corrección y el título del informe están en `norma`.
-- ---------------------------------------------------------------------
CREATE TABLE parametro (
  clave        VARCHAR(60) PRIMARY KEY,
  valor        TEXT NOT NULL,
  descripcion  VARCHAR(255) NULL
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------
-- 13. Notificaciones
-- ---------------------------------------------------------------------
CREATE TABLE notificacion (
  id_notificacion   INT AUTO_INCREMENT PRIMARY KEY,
  id_usuario_destino INT NOT NULL,
  titulo            VARCHAR(120) NOT NULL,
  mensaje           VARCHAR(500) NOT NULL,
  tipo              VARCHAR(40)  NULL COMMENT 'COTIZACION, PROGRAMACION, INFORME, CERTIFICADO',
  id_referencia     INT NULL,
  enlace            VARCHAR(255) NULL COMMENT 'Ruta de la app',
  leida             TINYINT(1) NOT NULL DEFAULT 0,
  fecha_creacion    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_notif_usuario FOREIGN KEY (id_usuario_destino) REFERENCES usuario(id_usuario) ON DELETE CASCADE,
  INDEX ix_notif_usuario (id_usuario_destino, leida, fecha_creacion)
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------
-- 14. Vista de seguimiento: una fila por equipo cotizado.
--     Permite filtrar todo por número de cotización, cliente, edificio, asesor o estado.
-- ---------------------------------------------------------------------
CREATE OR REPLACE VIEW v_seguimiento_equipo AS
SELECT
  ce.id_cotizacion_equipo,
  c.id_cotizacion,
  c.numero_cotizacion,
  c.estado               AS estado_cotizacion,
  ce.codigo_servicio,
  ce.tipo_servicio,
  ce.estado              AS estado_equipo,
  ce.fecha_estado,
  ce.plazo_dias,
  ce.fecha_limite_correccion,
  n.id_norma,
  CONCAT(n.codigo, ':', n.version) AS norma,
  cl.id_cliente,
  cl.razon_social        AS cliente,
  ed.id_edificio,
  ed.nombre              AS edificio,
  ed.ciudad,
  eq.id_equipo,
  eq.identificacion      AS equipo,
  c.id_asesor,
  ase.nombre_completo    AS asesor,
  p.tipo_visita,
  p.fecha_programada,
  p.hora_inicio,
  ins.nombre_completo    AS inspector,
  i.id_inspeccion,
  i.numero_inspeccion,
  i.estado               AS estado_inspeccion,
  inf1.id_informe        AS id_informe_v1,
  inf1.numero_informe    AS numero_informe_v1,
  inf1.estado            AS estado_informe_v1,
  inf1.concepto          AS concepto_v1,
  inf2.id_informe        AS id_informe_v2,
  inf2.numero_informe    AS numero_informe_v2,
  inf2.estado            AS estado_informe_v2,
  inf2.concepto          AS concepto_v2,
  cer.id_certificado,
  cer.numero_certificado,
  cer.estado             AS estado_certificado,
  cer.fecha_vencimiento
FROM cotizacion_equipo ce
JOIN cotizacion c   ON c.id_cotizacion = ce.id_cotizacion
JOIN norma n        ON n.id_norma      = ce.id_norma
JOIN cliente cl     ON cl.id_cliente   = c.id_cliente
JOIN edificio ed    ON ed.id_edificio  = c.id_edificio
JOIN equipo eq      ON eq.id_equipo    = ce.id_equipo
JOIN usuario ase    ON ase.id_usuario  = c.id_asesor
LEFT JOIN inspeccion i ON i.id_inspeccion = (
       SELECT MAX(i2.id_inspeccion) FROM inspeccion i2
       WHERE i2.id_cotizacion_equipo = ce.id_cotizacion_equipo)
LEFT JOIN programacion p ON p.id_programacion = (
       SELECT MAX(pe.id_programacion) FROM programacion_equipo pe
       JOIN programacion p2 ON p2.id_programacion = pe.id_programacion AND p2.estado <> 'CANCELADA'
       WHERE pe.id_cotizacion_equipo = ce.id_cotizacion_equipo)
LEFT JOIN usuario ins     ON ins.id_usuario = p.id_inspector
LEFT JOIN informe inf1    ON inf1.id_inspeccion = i.id_inspeccion AND inf1.numero_visita = 1
LEFT JOIN informe inf2    ON inf2.id_inspeccion = i.id_inspeccion AND inf2.numero_visita = 2
LEFT JOIN certificado cer ON cer.id_certificado = (
       SELECT MAX(c2.id_certificado) FROM certificado c2
       WHERE c2.id_cotizacion_equipo = ce.id_cotizacion_equipo AND c2.estado <> 'ANULADO');

-- ---------------------------------------------------------------------
-- 15. Ítems que aplican a cada inspección según su norma y sus variantes
--     aplica = 0 -> se precarga como NO_APLICA (el inspector puede cambiarlo)
--     También no aplica un ítem con foso_minimo_mm si el foso registrado es menos profundo
-- ---------------------------------------------------------------------
CREATE OR REPLACE VIEW v_inspeccion_item_aplica AS
SELECT
  ins.id_inspeccion,
  i.id_item,
  i.numero,
  CASE WHEN EXISTS (
    SELECT 1
    FROM checklist_item_variante v
    JOIN variante_opcion o ON o.id_variante_opcion = v.id_variante_opcion
    WHERE v.id_item = i.id_item
      AND NOT EXISTS (
        SELECT 1
        FROM checklist_item_variante v2
        JOIN variante_opcion o2 ON o2.id_variante_opcion = v2.id_variante_opcion
        JOIN inspeccion_variante iv ON iv.id_variante_opcion = v2.id_variante_opcion
                                   AND iv.id_inspeccion = ins.id_inspeccion
        WHERE v2.id_item = i.id_item
          AND o2.id_variante_tipo = o.id_variante_tipo)
  ) OR (i.foso_minimo_mm IS NOT NULL AND ins.profundidad_foso_mm < i.foso_minimo_mm)
  THEN 0 ELSE 1 END AS aplica
FROM inspeccion ins
JOIN checklist_item i ON i.id_norma = ins.id_norma
WHERE i.activo = 1;

-- ---------------------------------------------------------------------
-- 16. Control de migraciones (Alembic). Esta base nace en la revisión 0001_v2.
--     Los cambios futuros se hacen con:  alembic revision -m "..."  /  alembic upgrade head
-- ---------------------------------------------------------------------
CREATE TABLE alembic_version (
  version_num VARCHAR(32) NOT NULL PRIMARY KEY
) ENGINE=InnoDB;
INSERT INTO alembic_version (version_num) VALUES ('0003_foso_minimo');
