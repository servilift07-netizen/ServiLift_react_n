# Matriz de rotación de capas

**Grupo**: ServiLift · **Ficha**: _número_ · **Stack**: React Native (Expo, app web y celular) + FastAPI + MariaDB/MySQL

Capas: **Front** (app Expo) · **API** (FastAPI) · **BD** (integración) · **E2E** (Playwright)

**Equipo de una persona**: @esteban64-64 hace las pruebas de todas las capas. Por eso las reglas pensadas para
un grupo se adaptan así:

- Cada semana se marca la **capa principal** (la que más avanza), pero se mantienen en verde las cuatro.
- No hay otro integrante que revise: el PR se **autorrevisa** con el checklist de la plantilla y **solo se
  fusiona con el CI en verde** (jobs `frontend` y `backend`) y con la integración y las E2E corridas en local.
- En la columna se anota la capa y, al cerrar la semana, el enlace al PR.

| Integrante (usuario GitHub) | S1 | S2 | S3 | S4 | S5 | S6 | S7 | S8 | S9 |
|---|---|---|---|---|---|---|---|---|---|
| @esteban64-64 | E2E | E2E (CI) + API + Front | | | | | | | |

Flujos E2E de la semana 1 (todos a cargo de @esteban64-64):

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
| S2 | 41,94 (líneas) | 44,49 | Front: líneas 41 · ramas 61 · funciones 32 · sentencias 43 — Back: 44 |

(*) El 41% del backend sale **sin ningún test unitario**: pytest importa la app (al cargar la prueba de
integración `tests/test_flujo.py`) y Python ejecuta las líneas de definición (`def`, `class`, decoradores).
Es el ejemplo perfecto de que la cobertura dice qué se **ejecutó**, no qué se **verificó**.

Mutantes documentados en la semana 2 (cada uno lo detecta al menos un test):

| Mutante | Test que lo detecta |
|---|---|
| `dias <= 3` → `dias < 3` en `nivelPlazo` (app) | `should classify 3 remaining days as urgente` |
| `n <= 0` → `n < 0` en `recorridoEstimado` (app) | `should return "0" -> "" at the boundary of a positive number of stops` |
| `fecha_programada < hoy` → `<=` en `validar_horario` (backend) | `test_validar_horario_accepts_today_and_future_days[fecha0]` |
| `min(plazos)` → `max(plazos)` en `calcular_plazo` (backend) | `test_calcular_plazo_uses_the_strictest_deadline_among_the_findings` |

## Regla de rama

El repositorio es público: `main` se protege con un ruleset (*Require a pull request* + *Require status checks*
con los jobs `frontend` y `backend`). Como el equipo es de una persona, no se exige aprobación de otro revisor:
la regla es **no fusionar un PR en rojo** y autorrevisarlo con el checklist antes de fusionar.

## Registro de vocero aleatorio

El vocero escribe su respuesta **antes** de que el instructor llegue a la mesa; el instructor la verifica con una pregunta corta y anota el resultado.

| Semana | Vocero | Capa preguntada | Respuesta escrita | Resultado (Alto / Medio / Bajo) |
|---|---|---|---|---|
| S1 | | | | |
| S2 | | | | |
