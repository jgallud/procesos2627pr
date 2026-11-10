---
type: Arquitectura
title: Arquitectura en capas
description: Capas del backend y del frontend, fronteras exactas entre ellas y endpoints de la API.
timestamp: 2026-11-10
---

# Arquitectura en capas

Estado actual de `main`. El diagrama general y el árbol de carpetas están en el [README](../README.md#arquitectura-en-capas).

## Cliente y servidor

El servidor Express sirve el frontend (`client/`) y la API (`/api`) en el mismo origen (`server/app.js`). El cliente no accede a la base de datos ni ejecuta reglas de negocio: solo llama a la API. Requisito [ARQ-01](requisitos.md).

## Backend

| Capa | Archivos | Responsabilidad |
|------|----------|-----------------|
| API | `server/app.js`, `server/api/usuariosRouter.js`, `server/api/sesion.js`, `server/api/oauth.js`, `server/api/errores.js` | Leer la petición, llamar al servicio, devolver JSON; cookie de sesión; redirecciones y `state` de OAuth |
| Lógica | `server/logic/usuarioService.js`, `server/logic/sesionService.js`, `server/logic/contrasenas.js`, `server/logic/errores.js` | Reglas de usuarios, roles, sesiones y contraseñas |
| Lógica · motor del juego | `server/logic/motor/` (`reglas.js`, `coordenadas.js`, `colocacion.js`, `partida.js`, `estado.js`, `index.js`) | Reglas de Hundir la Flota: colocación, disparos, turnos, fin, abandono y vista de cada jugador, como funciones puras ([D-22](decisiones.md#d-22-motor-del-juego-en-la-capa-lógica)) |
| Lógica · servicio de partidas | `server/logic/partidaService.js` | Carga la partida, comprueba que el solicitante juega en ella, aplica la jugada con el motor, hace jugar a la máquina y guarda. Devuelve siempre la vista del jugador |
| Lógica · jugador máquina | `server/logic/jugadorMaquina.js` | Colocación y disparos de la máquina a partir de su tablero de disparos, con azar inyectable ([D-28](decisiones.md#d-28-estrategia-del-jugador-máquina)) |
| Datos | `server/data/usuarioRepositorioMongo.js`, `server/data/sesionRepositorioMongo.js`, `server/data/conexionMongo.js`, y las versiones `*Memoria.js` | Guardar y buscar usuarios y sesiones |
| Datos · partidas | `server/data/partidaRepositorioMemoria.js` | Partidas en memoria durante el Hito 5 ([D-29](decisiones.md#d-29-partidas-en-memoria-durante-el-hito-5)), con el contrato de `test/contratos/repositorioPartidas.js` |
| Composición | `server/index.js` | Crear repositorios → servicios → app |

**Frontera API ↔ lógica.** Los routers solo llaman a `servicioUsuarios` y `servicioSesiones` (por ejemplo, `router.post('/')` en `usuariosRouter.js` llama a `servicioUsuarios.registrarUsuario`). La lógica no importa Express ni conoce HTTP: lanza `ErrorDominio` con un código, y `server/api/errores.js` lo traduce a estado HTTP con la tabla `ESTADO_HTTP`.

**Frontera lógica ↔ datos.** `crearServicioUsuarios({ repositorio, … })` recibe el repositorio inyectado y solo usa sus métodos (`buscarPorId`, `buscarPorEmail`, `crear`, `actualizar`, `listar`). No hay consultas a MongoDB en `server/logic/`. Las dos implementaciones de cada repositorio pasan la misma batería de `test/contratos/`.

**Composición.** `server/index.js` elige MongoDB si existe `MONGODB_URI` y memoria si no; en producción, sin `MONGODB_URI` el servidor no arranca. El paso a MongoDB en el Hito 3 no modificó `server/logic/` ni `server/api/`.

**Notificador.** La lógica recibe un `notificador` con `enviarConfirmacion({ email, nombre, token })`. Hay dos implementaciones en `server/notificacion/`: `notificadorBrevo.js` envía el correo con el API de Brevo y `notificadorLog.js` escribe el enlace en el log. `crearNotificador` en `server/index.js` elige la de Brevo si existe `BREVO_API_KEY` ([D-15](decisiones.md#d-15-correo-de-confirmación-con-brevo)). Añadir el correo no modificó `server/logic/` ni `server/api/`.

**Proveedor OAuth.** `server/oauth/proveedorGoogle.js` es el único módulo que habla con Google. `server/index.js` lo crea si existen `GOOGLE_CLIENT_ID` y `GOOGLE_CLIENT_SECRET`, y se lo pasa a la API. La API lo usa para redirigir y para obtener los datos del usuario; la lógica (`iniciarSesionOAuth`) solo recibe correo, nombre y si el correo está verificado ([D-19](decisiones.md#d-19-flujo-oauth-implementado-a-mano)).

**Motor del juego.** `server/logic/motor/` recibe el estado de una partida (un objeto plano con el estado, el turno, el ganador y, por jugador, su flota y los disparos recibidos) y devuelve uno nuevo, sin modificar el recibido. Solo importa sus propios módulos y `server/logic/errores.js` (`test/logic/motor/capas.test.js`): no conoce HTTP, WebSocket, MongoDB ni la interfaz. Lanza `ErrorDominio` con `DATOS_INVALIDOS` (colocación o casilla inválida, disparo repetido) o `ESTADO_INVALIDO` (fuera de turno, partida no empezada o terminada), que la API ya traduce a 400 y 409. `vistaPara(partida, jugador)` es lo único que debe llegar al cliente ([D-26](decisiones.md#d-26-estado-de-la-partida-como-objeto-plano-y-motor-inmutable)).

**Servicio de partidas.** `server/logic/partidaService.js` no contiene reglas: carga la partida del repositorio, comprueba con el servicio de usuarios que el solicitante tiene sesión y juega en ella (403 si no, 404 si no existe), aplica la jugada con el motor y guarda el nuevo estado. Tras un agua del jugador, hace jugar a la máquina en la misma petición. Todas sus respuestas son la vista de `motor.vistaPara`, así que la flota de la máquina no sale del servidor hasta que la partida termina. Las rutas de `server/api/partidasRouter.js` solo traducen HTTP y no importan el motor.

**Jugador máquina.** `server/logic/jugadorMaquina.js` usa el motor igual que un jugador humano: `jugarTurno(partida, jugador, azar)` pide `vistaPara` y decide con `rival.disparos`, sus propios disparos, así que no puede ver la flota del rival. Dispara con `disparar` hasta fallar o terminar la partida y devuelve los disparos hechos para que el servicio los guarde y el jugador los vea. La fuente de azar se inyecta: en producción será `Math.random`; en las pruebas, una fija.

## Frontend

| Capa | Archivo | Responsabilidad |
|------|---------|-----------------|
| Presentación | `client/js/interfaz.js` | DOM, formularios, vistas y mensajes |
| Comunicación | `client/js/api.js` | Único módulo que usa `fetch`; expone funciones y la clase `ErrorApi` |

**Frontera.** `interfaz.js` solo hace `import * as api from './api.js'` y no contiene ningún `fetch` ni URL de la API. Incluso la dirección del botón «Entrar con Google» la da `api.urlInicioOAuth('google')`.

## Endpoints

| Método | Ruta | Quién puede | Respuesta |
|--------|------|-------------|-----------|
| GET | `/api/salud` | cualquiera | 200 |
| POST | `/api/sesion` | cualquiera | 200 usuario + cookie |
| GET | `/api/sesion` | con sesión | 200 usuario |
| DELETE | `/api/sesion` | cualquiera | 204 |
| POST | `/api/usuarios` | cualquiera | 201 usuario pendiente |
| POST | `/api/usuarios/confirmacion` | cualquiera (con token) | 200 usuario activo |
| GET | `/api/usuarios` | administrador | 200 lista |
| GET | `/api/usuarios/:id/activo` | administrador | 200 `{id, activo}` |
| DELETE | `/api/usuarios/:id` | administrador o el propio usuario | 204 |
| GET | `/api/oauth/proveedores` | cualquiera | 200 `{proveedores}` |
| GET | `/api/oauth/google` | cualquiera | 302 a Google, con el `state` en una cookie |
| GET | `/api/oauth/google/retorno` | vuelta desde Google | 302 a `/` con sesión, o a `/?error_oauth=<código>` |
| POST | `/api/partidas` | con sesión | 201 partida nueva contra la máquina (200 si ya tenía una en curso) |
| GET | `/api/partidas/actual` | con sesión | 200 partida en curso, o `null` |
| GET | `/api/partidas/:id` | quien juega la partida | 200 vista de la partida |
| POST | `/api/partidas/:id/barcos` | quien juega la partida | 200 vista (`{barco, casilla, orientacion}`) |
| DELETE | `/api/partidas/:id/barcos/:barco` | quien juega la partida | 200 vista |
| POST | `/api/partidas/:id/flota-aleatoria` | quien juega la partida | 200 vista |
| POST | `/api/partidas/:id/disparos` | quien juega la partida | 200 `{disparo, disparosRival, partida}` (`{casilla}`) |
| POST | `/api/partidas/:id/abandono` | quien juega la partida | 200 vista |

Errores en JSON `{error, codigo}`: 400 datos o token inválidos, 401 sin sesión o credenciales incorrectas, 403 sin permiso o cuenta pendiente o eliminada, 404 no existe, 409 email duplicado o cuenta local al entrar con OAuth. El retorno de OAuth no responde JSON: redirige con el código en `error_oauth`. La comprobación de sesión y rol se hace en la lógica (`obtenerSolicitante` y `exigirAdministrador` en `usuarioService.js`), no en la interfaz.
