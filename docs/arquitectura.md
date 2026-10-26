---
type: Arquitectura
title: Arquitectura en capas
description: Capas del backend y del frontend, fronteras exactas entre ellas y endpoints de la API.
timestamp: 2026-10-25
---

# Arquitectura en capas

Estado actual de `main`. El diagrama general y el árbol de carpetas están en el [README](../README.md#arquitectura-en-capas).

## Cliente y servidor

El servidor Express sirve el frontend (`client/`) y la API (`/api`) en el mismo origen (`server/app.js`). El cliente no accede a la base de datos ni ejecuta reglas de negocio: solo llama a la API. Requisito [ARQ-01](requisitos.md).

## Backend

| Capa | Archivos | Responsabilidad |
|------|----------|-----------------|
| API | `server/app.js`, `server/api/usuariosRouter.js`, `server/api/sesion.js`, `server/api/errores.js` | Leer la petición, llamar al servicio, devolver JSON; cookie de sesión |
| Lógica | `server/logic/usuarioService.js`, `server/logic/sesionService.js`, `server/logic/contrasenas.js`, `server/logic/errores.js` | Reglas de usuarios, roles, sesiones y contraseñas |
| Datos | `server/data/usuarioRepositorioMongo.js`, `server/data/sesionRepositorioMongo.js`, `server/data/conexionMongo.js`, y las versiones `*Memoria.js` | Guardar y buscar usuarios y sesiones |
| Composición | `server/index.js` | Crear repositorios → servicios → app |

**Frontera API ↔ lógica.** Los routers solo llaman a `servicioUsuarios` y `servicioSesiones` (por ejemplo, `router.post('/')` en `usuariosRouter.js` llama a `servicioUsuarios.registrarUsuario`). La lógica no importa Express ni conoce HTTP: lanza `ErrorDominio` con un código, y `server/api/errores.js` lo traduce a estado HTTP con la tabla `ESTADO_HTTP`.

**Frontera lógica ↔ datos.** `crearServicioUsuarios({ repositorio, … })` recibe el repositorio inyectado y solo usa sus métodos (`buscarPorId`, `buscarPorEmail`, `crear`, `actualizar`, `listar`). No hay consultas a MongoDB en `server/logic/`. Las dos implementaciones de cada repositorio pasan la misma batería de `test/contratos/`.

**Composición.** `server/index.js` elige MongoDB si existe `MONGODB_URI` y memoria si no; en producción, sin `MONGODB_URI` el servidor no arranca. El paso a MongoDB en el Hito 3 no modificó `server/logic/` ni `server/api/`.

**Notificador.** La lógica recibe un `notificador` con `enviarConfirmacion({ email, nombre, token })`. La implementación actual, `server/notificacion/notificadorLog.js`, escribe el enlace en el log; el envío por correo se hará sustituyéndola en `server/index.js` ([RF-02](requisitos.md)).

## Frontend

| Capa | Archivo | Responsabilidad |
|------|---------|-----------------|
| Presentación | `client/js/interfaz.js` | DOM, formularios, vistas y mensajes |
| Comunicación | `client/js/api.js` | Único módulo que usa `fetch`; expone funciones y la clase `ErrorApi` |

**Frontera.** `interfaz.js` solo hace `import * as api from './api.js'` y no contiene ningún `fetch` ni URL de la API.

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

Errores en JSON `{error, codigo}`: 400 datos o token inválidos, 401 sin sesión o credenciales incorrectas, 403 sin permiso o cuenta pendiente o eliminada, 404 no existe, 409 email duplicado. La comprobación de sesión y rol se hace en la lógica (`obtenerSolicitante` y `exigirAdministrador` en `usuarioService.js`), no en la interfaz.
