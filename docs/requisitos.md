---
type: Requisitos
title: Requisitos del Sprint 1
description: Estado de cada requisito de la especificación del Sprint 1, con la evidencia que lo respalda.
timestamp: 2026-10-26
---

# Requisitos

Estado comparado con lo que pide la especificación del Sprint 1. **hecho**: se cumple, con evidencia. **parcial**: se cumple una parte. **pendiente**: no se cumple (una solución provisional que sustituye al requisito cuenta como pendiente). Los parciales y pendientes pasan al [Sprint 2](sprint-2.md).

| ID | Requisito | Estado | Evidencia |
|----|-----------|--------|-----------|
| ARQ-01 | Separación cliente-servidor y mismo origen | hecho | `server/app.js`; `test/api/salud.test.js` («sirve el frontend desde el mismo origen») |
| ARQ-02 | Capas del backend: API, lógica y datos | hecho | `server/api/`, `server/logic/`, `server/data/`; ver [arquitectura](arquitectura.md#backend) |
| ARQ-03 | Capas del frontend: presentación y comunicación | hecho | `client/js/interfaz.js`, `client/js/api.js` |
| RF-01 | Registro de usuario local | hecho | `registrarUsuario` en `server/logic/usuarioService.js`; 7 casos en `test/logic/usuarioService.test.js`; `test/api/usuarios.test.js` |
| RF-02 | Confirmación de cuenta por correo | hecho | Correo con el API de Brevo (`server/notificacion/notificadorBrevo.js`), elegido en `server/index.js` si hay `BREVO_API_KEY`; 6 casos en `test/notificacion/notificadorBrevo.test.js`; confirmación por token con `confirmarCuenta` (3 casos). Decisión [D-15](decisiones.md#d-15-correo-de-confirmación-con-brevo). Envío comprobado en producción el 2026-10-26; el enlace usa `APP_URL`, obligatoria en producción ([D-16](decisiones.md#d-16-app_url-obligatoria-en-producción)) |
| RF-03 | Inicio de sesión local | hecho | `iniciarSesion` en `usuarioService.js` (mismo error para email inexistente y contraseña incorrecta); 7 casos en `test/logic/usuarioService.test.js` |
| RF-04 | Inicio de sesión con OAuth | **pendiente** | No implementado. Preparado: el modelo de usuario tiene el campo `origen` (`local` u `oauth`) |
| RF-05 | Cierre de sesión | hecho | `DELETE /api/sesion` en `server/api/sesion.js`; `test/api/sesion.test.js` («la sesión deja de valer aunque se reutilice») |
| RF-06 | Mantenimiento de la sesión entre recargas | hecho | Cookie `sesion` con `Max-Age` y `GET /api/sesion`; `server/logic/sesionService.js`; `test/api/sesion.test.js` |
| RF-07 | Listar usuarios (administrador) | hecho | `listarUsuarios` + `exigirAdministrador`; 3 casos en `test/logic/usuarioService.test.js`; `test/api/usuarios.test.js` |
| RF-08 | Comprobar si un usuario está activo (administrador) | hecho | `estaActivo`; 5 casos en `test/logic/usuarioService.test.js` |
| RF-09 | Eliminar usuario | hecho | `eliminarUsuario` (eliminación lógica); 6 casos en `test/logic/usuarioService.test.js` |
| RF-10 | Creación del primer administrador | hecho | `asegurarAdministrador` con `ADMIN_EMAIL` y `ADMIN_PASSWORD` desde `server/index.js`; 3 casos; ver [D-07](decisiones.md#d-07-administrador-inicial-por-variables-de-entorno) |
| RNF-01 | Persistencia en una base de datos real | hecho | `server/data/*Mongo.js`; `test/api/persistencia.test.js` («sobreviven a un reinicio»); `test/data/repositoriosMongo.test.js` |
| RNF-02 | Secretos fuera del código y `.env.example` | hecho | `.env.example` sin valores (incluida `BREVO_API_KEY`); `.env` en `.gitignore`; `server/config.js` lee el entorno; Secret Manager en [despliegue](despliegue-cloud-run.md) |
| RNF-03 | Hash seguro de contraseñas | hecho | scrypt en `server/logic/contrasenas.js`; 5 casos en `test/logic/contrasenas.test.js` |
| RNF-04 | Rutas protegidas por sesión y rol | hecho | `obtenerSolicitante` y `exigirAdministrador` en `usuarioService.js` (401/403 desde la lógica); `test/api/usuarios.test.js` |
| RNF-05 | Despliegue en cloud con URL pública | hecho | Cloud Run ([despliegue](despliegue-cloud-run.md)); URL pública en el [README](../README.md) |
| RNF-06 | Pruebas unitarias de la lógica (5 o más) | hecho | 48 casos en `test/logic/`, con casos de error (email duplicado, cuenta pendiente, usuario que elimina a otro) |
| RNF-07 | Manejo de errores con feedback al usuario | hecho | `ErrorDominio` con mensajes en la lógica; `server/api/errores.js`; `mostrarError` en `client/js/interfaz.js`. Revisar de nuevo con OAuth y correo |
| RNF-08 | Registro de actividad (log) | hecho | `server/logger.js` (JSON a stdout); petición HTTP en `server/app.js`; eventos de usuario en `usuarioService.js` |
| PRO-01 | Flujo de trabajo GitHub Flow | **parcial** | Seis PR integrados (#2 a #7) con el CI en verde. Desviación: `c9afe0f` se editó directamente en `main` (ver [Sprint 1](sprint-1.md#desviaciones-del-flujo)) |
| PRO-02 | Integración continua | hecho | `.github/workflows/ci.yml` (en cada PR y en cada push a `main`, con MongoDB efímero). Última ejecución en `main` (`c4c2f3d`): verde |
| PRO-03 | Despliegue continuo | hecho | Activador de Cloud Build sobre `main` ([despliegue](despliegue-cloud-run.md)). Por verificar: el activador está en Google Cloud y no se puede consultar desde GitHub |
