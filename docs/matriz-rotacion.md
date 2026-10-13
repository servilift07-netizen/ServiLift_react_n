# Matriz de rotación de capas

**Grupo**: ServiLift · **Ficha**: _número_ · **Stack**: React Native (Expo, app web y celular) + FastAPI + MariaDB/MySQL

Capas: **Front** (app Expo) · **API** (FastAPI) · **BD** (integración) · **E2E** (Playwright)

Reglas:

- Cada semana cambias de capa. No repites capa hasta haber pasado por las cuatro.
- En la columna escribe la capa y, al cerrar la semana, el enlace a tu PR de tests.
- Quien revisa tu PR debe haber trabajado en otra capa esa semana.

> Completen la columna de integrantes con su usuario de GitHub. En S1 todo el grupo trabaja en E2E.

| Integrante (usuario GitHub) | S1 | S2 | S3 | S4 | S5 | S6 | S7 | S8 | S9 |
|---|---|---|---|---|---|---|---|---|---|
| @esteban64-64 | E2E | E2E (CI) + API | | | | | | | |
| @integrante-2 | E2E | Front | | | | | | | |
| @integrante-3 | E2E | API | | | | | | | |
| @integrante-4 | E2E | BD | | | | | | | |

Flujos E2E de la semana 1 (un flujo distinto por integrante; repártanlos):

| Flujo | Archivo |
|---|---|
| Ingreso con credenciales válidas | `e2e/tests/login-exitoso.spec.js` |
| Ingreso con contraseña incorrecta | `e2e/tests/login-incorrecto.spec.js` |
| Validación del formulario vacío | `e2e/tests/login-campos-vacios.spec.js` |
| Búsqueda de clientes del asesor | `e2e/tests/buscar-cliente.spec.js` |
| Cerrar sesión | `e2e/tests/cerrar-sesion.spec.js` |

## Cobertura semanal

Anota la cobertura real al cerrar cada semana. El umbral de la semana siguiente es el mayor entre el piso del plan y este valor, redondeado hacia abajo.

| Semana | Frontend (%) | Backend (%) | Umbral configurado para la semana siguiente |
|---|---|---|---|
| S1 (línea base) | 0 | 41 (*) | Front 0 · Back 41 |

(*) El 41% del backend sale **sin ningún test unitario**: pytest importa la app (al cargar la prueba de
integración `tests/test_flujo.py`) y Python ejecuta las líneas de definición (`def`, `class`, decoradores).
Es el ejemplo perfecto de que la cobertura dice qué se **ejecutó**, no qué se **verificó**.

## Regla de rama

El repositorio es público: `main` se protege con un ruleset (*Require a pull request* + *Require status checks*
con los jobs `frontend` y `backend`). Mientras se activa, la regla del grupo es: **nadie fusiona un PR en rojo**.

## Registro de vocero aleatorio

El vocero escribe su respuesta **antes** de que el instructor llegue a la mesa; el instructor la verifica con una pregunta corta y anota el resultado.

| Semana | Vocero | Capa preguntada | Respuesta escrita | Resultado (Alto / Medio / Bajo) |
|---|---|---|---|---|
| S1 | | | | |
| S2 | | | | |
