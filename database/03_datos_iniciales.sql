-- =====================================================================
-- ServiLift - Datos iniciales de trabajo (usuarios, cliente, edificios, ascensores)
-- Ejecutar después de 01_schema.sql y 02_seed.sql.
-- USUARIOS DE PRUEBA: todos con contraseña 123456 (proyecto de demostración).
-- Nombre, NIT y dirección del cliente y de los edificios se completan desde la app.
-- =====================================================================
USE servilift_db;
SET NAMES utf8mb4;
START TRANSACTION;

INSERT INTO usuario (id_rol, nombre_completo, correo, contrasena_encriptada) SELECT id_rol, 'Administrador', 'admin@gmail.com', X'3B31501EA2DD33E362B5770DBB61EA430462AF6A0EC0723F96F9877B59DE397E223D4F30414873E51696D34999AA378A' FROM rol WHERE codigo = 'ADMIN';
INSERT INTO usuario (id_rol, nombre_completo, correo, contrasena_encriptada) SELECT id_rol, 'Asesor', 'asesor@gmail.com', X'D93219D13EB96F809FA8F27C8B31AEE6923557C4476F3D46FA3FE59450F5EE9AC3FE7137AC82452F6335D694BC178FC9' FROM rol WHERE codigo = 'ASESOR';
INSERT INTO usuario (id_rol, nombre_completo, correo, contrasena_encriptada) SELECT id_rol, 'Programación', 'programacion@gmail.com', X'2EAB0F23D24BD0A58FFB41BFDC2EF3AB28BCD1C9C46D0BBCB22D45781CD47E0185DC8517509D91D51BBAC174FFF6BF59' FROM rol WHERE codigo = 'PROGRAMACION';
INSERT INTO usuario (id_rol, nombre_completo, correo, contrasena_encriptada) SELECT id_rol, 'Inspector', 'inspector@gmail.com', X'0EC0A2A8E859CC9BA7F3EDAB7138165B2CCC0EFD3544B5236C0069BC54E7AFC99F822736C8963F92476712282E03167E' FROM rol WHERE codigo = 'INSPECTOR';
INSERT INTO usuario (id_rol, nombre_completo, correo, contrasena_encriptada) SELECT id_rol, 'Director Técnico', 'director@gmail.com', X'829FE75F43DBE8FDE62C62860B24AB58EB3C0E8B4A12CE717AF5B1F0934100E93B4FF3B2CFC35A00EB3EDC45D8E7A257' FROM rol WHERE codigo = 'DIRECTOR_TECNICO';
INSERT INTO usuario (id_rol, nombre_completo, correo, contrasena_encriptada) SELECT id_rol, 'Certificados', 'certificados@gmail.com', X'8FCDE660624E2B44A82464E9631FCB55A81D0A4939AF355ACF78CC131FCB1F8D4C66216854C4201E3A29C1C457E383B6' FROM rol WHERE codigo = 'CERTIFICADOS';

-- Cliente (atendido por el asesor)
INSERT INTO cliente (id_asesor, tipo_documento, numero_documento, razon_social, contacto_correo)
SELECT id_usuario, 'NIT', 'POR-DEFINIR', 'Cliente', 'cliente@gmail.com' FROM usuario WHERE correo = 'asesor@gmail.com';
SET @cliente = LAST_INSERT_ID();

INSERT INTO usuario (id_rol, id_cliente, nombre_completo, correo, contrasena_encriptada) SELECT id_rol, @cliente, 'Cliente', 'cliente@gmail.com', X'FBDD3356A84C3114DDC3B8D7B30685A42A0F19DDB2D65069BB73D85A1BF72FC712EE5D18D955DA608D3C78327688E8BB' FROM rol WHERE codigo = 'CLIENTE';

-- Edificio 1: 4 ascensores
INSERT INTO edificio (id_cliente, nombre, direccion, ciudad, numero_equipos) VALUES (@cliente, 'Edificio 1', 'Por definir', 'Por definir', 4);
SET @edificio = LAST_INSERT_ID();
INSERT INTO equipo (id_edificio, identificacion) VALUES (@edificio, 'Ascensor 1'), (@edificio, 'Ascensor 2'), (@edificio, 'Ascensor 3'), (@edificio, 'Ascensor 4');

-- Edificio 2: 2 ascensores
INSERT INTO edificio (id_cliente, nombre, direccion, ciudad, numero_equipos) VALUES (@cliente, 'Edificio 2', 'Por definir', 'Por definir', 2);
SET @edificio = LAST_INSERT_ID();
INSERT INTO equipo (id_edificio, identificacion) VALUES (@edificio, 'Ascensor 1'), (@edificio, 'Ascensor 2');

COMMIT;
