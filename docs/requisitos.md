---
type: Requisitos
title: Requisitos
description: Estado de cada requisito de las especificaciones del Sprint 1 y del Sprint 2 (Hundir la Flota), con la evidencia que lo respalda.
timestamp: 2026-11-08
---

# Requisitos

## Sprint 1

Estado comparado con lo que pide la especificación del Sprint 1. **hecho**: se cumple, con evidencia. **parcial**: se cumple una parte. **pendiente**: no se cumple (una solución provisional que sustituye al requisito cuenta como pendiente). Los parciales y pendientes pasan al [Sprint 2](sprint-2.md).

| ID | Requisito | Estado | Evidencia |
|----|-----------|--------|-----------|
| ARQ-01 | Separación cliente-servidor y mismo origen | hecho | `server/app.js`; `test/api/salud.test.js` («sirve el frontend desde el mismo origen») |
| ARQ-02 | Capas del backend: API, lógica y datos | hecho | `server/api/`, `server/logic/`, `server/data/`; ver [arquitectura](arquitectura.md#backend) |
| ARQ-03 | Capas del frontend: presentación y comunicación | hecho | `client/js/interfaz.js`, `client/js/api.js` |
| RF-01 | Registro de usuario local | hecho | `registrarUsuario` en `server/logic/usuarioService.js`; 7 casos en `test/logic/usuarioService.test.js`; `test/api/usuarios.test.js` |
| RF-02 | Confirmación de cuenta por correo | hecho | Correo con el API de Brevo (`server/notificacion/notificadorBrevo.js`), elegido en `server/index.js` si hay `BREVO_API_KEY`; 6 casos en `test/notificacion/notificadorBrevo.test.js`; confirmación por token con `confirmarCuenta` (3 casos). Decisión [D-15](decisiones.md#d-15-correo-de-confirmación-con-brevo). Envío comprobado en producción el 2026-10-26; el enlace usa `APP_URL`, obligatoria en producción ([D-16](decisiones.md#d-16-app_url-obligatoria-en-producción)) |
| RF-03 | Inicio de sesión local | hecho | `iniciarSesion` en `usuarioService.js` (mismo error para email inexistente y contraseña incorrecta); 7 casos en `test/logic/usuarioService.test.js` |
| RF-04 | Inicio de sesión con OAuth | hecho | Google, a mano: `server/oauth/proveedorGoogle.js`, `server/api/oauth.js` e `iniciarSesionOAuth` en `server/logic/usuarioService.js`; 8 casos en `test/logic/usuarioService.test.js`, 5 en `test/oauth/proveedorGoogle.test.js` y 9 en `test/api/oauth.test.js`. Decisiones [D-17](decisiones.md#d-17-inicio-de-sesión-externo-con-google) a [D-19](decisiones.md#d-19-flujo-oauth-implementado-a-mano). Inicio de sesión comprobado en producción el 2026-10-29 |
| RF-05 | Cierre de sesión | hecho | `DELETE /api/sesion` en `server/api/sesion.js`; `test/api/sesion.test.js` («la sesión deja de valer aunque se reutilice») |
| RF-06 | Mantenimiento de la sesión entre recargas | hecho | Cookie `sesion` con `Max-Age` y `GET /api/sesion`; `server/logic/sesionService.js`; `test/api/sesion.test.js` |
| RF-07 | Listar usuarios (administrador) | hecho | `listarUsuarios` + `exigirAdministrador`; 3 casos en `test/logic/usuarioService.test.js`; `test/api/usuarios.test.js` |
| RF-08 | Comprobar si un usuario está activo (administrador) | hecho | `estaActivo`; 5 casos en `test/logic/usuarioService.test.js` |
| RF-09 | Eliminar usuario | hecho | `eliminarUsuario` (eliminación lógica); 6 casos en `test/logic/usuarioService.test.js` |
| RF-10 | Creación del primer administrador | hecho | `asegurarAdministrador` con `ADMIN_EMAIL` y `ADMIN_PASSWORD` desde `server/index.js`; 3 casos; ver [D-07](decisiones.md#d-07-administrador-inicial-por-variables-de-entorno) |
| RNF-01 | Persistencia en una base de datos real | hecho | `server/data/*Mongo.js`; `test/api/persistencia.test.js` («sobreviven a un reinicio»); `test/data/repositoriosMongo.test.js` |
| RNF-02 | Secretos fuera del código y `.env.example` | hecho | `.env.example` sin valores (incluidas `BREVO_API_KEY` y `GOOGLE_CLIENT_SECRET`); `.env` en `.gitignore`; `server/config.js` lee el entorno; Secret Manager en [despliegue](despliegue-cloud-run.md) |
| RNF-03 | Hash seguro de contraseñas | hecho | scrypt en `server/logic/contrasenas.js`; 5 casos en `test/logic/contrasenas.test.js` |
| RNF-04 | Rutas protegidas por sesión y rol | hecho | `obtenerSolicitante` y `exigirAdministrador` en `usuarioService.js` (401/403 desde la lógica); `test/api/usuarios.test.js` |
| RNF-05 | Despliegue en cloud con URL pública | hecho | Cloud Run ([despliegue](despliegue-cloud-run.md)); URL pública en el [README](../README.md) |
| RNF-06 | Pruebas unitarias de la lógica (5 o más) | hecho | 48 casos en `test/logic/`, con casos de error (email duplicado, cuenta pendiente, usuario que elimina a otro) |
| RNF-07 | Manejo de errores con feedback al usuario | hecho | `ErrorDominio` con mensajes en la lógica; `server/api/errores.js`; `mostrarError` en `client/js/interfaz.js`. Revisado el 2026-10-29 en la URL pública: registro duplicado, contraseña corta o distinta, credenciales incorrectas (mismo mensaje con correo inexistente), cuenta pendiente, enlace ya usado, cancelación en Google, correo de cuenta local con Google y sesión caducada. Limitación conocida: si Brevo falla al registrarse, el mensaje es «Error interno del servidor» y no hay reenvío del enlace ([D-15](decisiones.md#d-15-correo-de-confirmación-con-brevo)) |
| RNF-08 | Registro de actividad (log) | hecho | `server/logger.js` (JSON a stdout); petición HTTP en `server/app.js`; eventos de usuario en `usuarioService.js` |
| PRO-01 | Flujo de trabajo GitHub Flow | **parcial** | Seis PR integrados (#2 a #7) con el CI en verde. Desviación: `c9afe0f` se editó directamente en `main` (ver [Sprint 1](sprint-1.md#desviaciones-del-flujo)) |
| PRO-02 | Integración continua | hecho | `.github/workflows/ci.yml` (en cada PR y en cada push a `main`, con MongoDB efímero). Última ejecución en `main` (`c4c2f3d`): verde |
| PRO-03 | Despliegue continuo | hecho | Activador de Cloud Build sobre `main` ([despliegue](despliegue-cloud-run.md)). Por verificar: el activador está en Google Cloud y no se puede consultar desde GitHub |

## Sprint 2 · Hundir la Flota

Fuente: especificación del Sprint 2 («Sprint 2 · Hundir la Flota: requisitos»). Mismos estados que en el Sprint 1. Plan por hitos en [sprint-2.md](sprint-2.md#hundir-la-flota).

### Reglas del juego

| Elemento | Regla |
|----------|-------|
| Tablero | 10 × 10 por jugador (propio y de disparos), coordenadas A1 a J10 |
| Flota | Portaaviones (5), acorazado (4), crucero (3), submarino (3) y destructor (2) |
| Colocación | En horizontal o vertical, dentro del tablero, sin solaparse y sin tocarse, tampoco en diagonal ([D-25](decisiones.md#d-25-reglas-del-juego-fijadas-por-la-especificación)) |
| Disparo | Agua, tocado o hundido (con el barco); no se repite casilla |
| Turnos | Quien acierta repite; tras un agua, turno del rival. Empieza quien crea la partida (contra la máquina, el jugador) |
| Victoria | Gana quien hunde primero toda la flota del rival |

### Requisitos

| ID | Requisito | Hito | Estado | Evidencia |
|----|-----------|------|--------|-----------|
| RF-11 | Crear partida contra la máquina | 5 | pendiente | — |
| RF-12 | Colocar la flota (manual o automática), validada en la lógica | 5 | **parcial** | Reglas en el motor: `colocarBarco`, `retirarBarco` y `colocarFlotaAleatoria` en `colocacion.js` (`server/logic/motor/`); 12 casos en `test/logic/motor/colocacion.test.js`. Falta: servicio, API e interfaz |
| RF-13 | Disparar: agua, tocado o hundido; rechazo de disparos inválidos sin consumir turno | 5 | **parcial** | `disparar` en `partida.js` (`server/logic/motor/`): agua, tocado, hundido con el barco; disparo repetido, fuera del tablero o fuera de turno rechazado sin consumir turno; 6 casos en `test/logic/motor/partida.test.js`. Falta: servicio, API e interfaz |
| RF-14 | Turno de la máquina | 5 | pendiente | — |
| RF-15 | Fin de partida y abandono | 5 | **parcial** | Fin por flota hundida y `abandonar` en `partida.js`; partida terminada sin más jugadas; 3 casos en `test/logic/motor/partida.test.js`. Falta: servicio, API e interfaz |
| RF-16 | Vista de la partida: tablero propio y de disparos, turno y estado | 5 | **parcial** | `vistaPara` en `partida.js`: tablero propio, disparos propios, turno, estado y barcos pendientes; 3 casos. Falta: interfaz |
| RF-17 | Reanudar una partida tras recargar o redesplegar | 6 | pendiente | — |
| RF-18 | Historial de partidas | 6 | pendiente | — |
| RF-19 | Estadísticas del jugador | 6 | pendiente | — |
| RF-20 | Clasificación | 6 | pendiente | — |
| RF-21 | Gestión de partidas (administrador) | 6 | pendiente | — |
| RF-22 | Crear partida entre jugadores y unirse | 7 | pendiente | — |
| RF-23 | Turnos entre jugadores | 7 | pendiente | — |
| RF-24 | Avisos en tiempo real por WebSocket | 7 | pendiente | — |
| RF-25 | Reconexión | 7 | pendiente | — |
| RF-26 | Abandono (y, opcional, tiempo máximo de turno) | 7 | pendiente | — |
| RNF-09 | Motor del juego en la capa lógica, sin dependencias de HTTP, WebSocket, base de datos ni interfaz | 5 | **parcial** | El motor (`server/logic/motor/`) solo importa sus propios módulos y `../errores`: `test/logic/motor/capas.test.js`. Falta comprobarlo en la API y el WebSocket cuando existan |
| RNF-10 | Servidor autoritativo: el cliente nunca recibe la flota del rival durante la partida | 5 | **parcial** | `vistaPara` solo incluye la flota rival con la partida terminada: 2 casos en `test/logic/motor/partida.test.js`. Falta que el servicio y la API solo devuelvan esa vista |
| RNF-11 | Al menos 10 pruebas unitarias del motor, con casos de error; jugador máquina con azar fijo | 5 | **parcial** | 26 casos del motor en `test/logic/motor/`, con errores de colocación, disparo repetido, fuera de turno y partida terminada; colocación aleatoria con azar fijo (`azarFijo` en `test/logic/motor/ayuda.js`). Falta: jugador máquina con azar fijo |
| RNF-12 | WebSocket en el despliegue: instancias justificadas y reconexión tras un despliegue | 7 | pendiente | — |
