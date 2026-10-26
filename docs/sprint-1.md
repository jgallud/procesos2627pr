---
type: Sprint
title: Sprint 1
description: Resumen de cierre de los hitos 1 a 4 del Sprint 1, desviaciones del flujo y retrospectiva.
timestamp: 2026-10-25
---

# Sprint 1

- **Objetivo:** estructura base de una aplicación SaaS en capas con gestión de usuarios (especificación del Sprint 1).
- **Periodo:** desde el 2026-10-06 (primer commit). Por verificar: fecha de cierre del sprint.
- **Seguimiento:** PBI 24 a 29 y 32 en Donetonic. TODO(alumno): enlace al tablero (uno que exija iniciar sesión).
- **Resultado:** hitos 1 a 3 completados; el Hito 4 pasa al [Sprint 2](sprint-2.md). Estado de cada requisito en [requisitos.md](requisitos.md).

## Hito 1: esqueleto y backend

- **Objetivo:** repositorio con ramas y PR, CI y despliegue continuo desde el primer día, lógica de usuarios en memoria con pruebas y API que la expone.
- **Hecho (2026-10-06):** servidor Express que sirve el frontend y `/api/salud`, CI con `node:test`, despliegue en Cloud Run, repositorio de usuarios en memoria, servicio de usuarios (alta, listado, activo, eliminar, con control de rol), API REST y administrador inicial.
- **PR:** #3 (`feature/api-usuarios`, `4940e9b`…`73dd9bc`), que incluye las ramas encadenadas de los PR #1 (cerrado sin integrar) y #2 (integrado a la vez que el #3); #4 (`package-lock.json` y retirada de `.github/workflows/deploy.yml`); #5 (despliegue con Cloud Build, `c114569`). Todos con el CI en verde.
- **Etiqueta:** no existe `hito-1`.
- **Incidencia:** el primer despliegue desde GitHub Actions falló en `main` (`b204f78`) en el paso de autenticación en Google Cloud. El workflow se retiró y el despliegue pasó a Cloud Build ([D-04](decisiones.md#d-04-despliegue-continuo-desde-github-actions) → [D-08](decisiones.md#d-08-despliegue-continuo-con-cloud-build)). Por verificar: la causa exacta del fallo de autenticación.
- **Desviaciones:** no se etiquetó el hito.

## Hito 2: frontend y sesión

- **Objetivo:** interfaz y capa de comunicación separadas; registro e inicio de sesión locales con hash; cierre de sesión, sesión entre recargas y rutas protegidas.
- **Hecho (2026-10-08):** scrypt (`50c903a`), registro con confirmación por token e inicio de sesión (`caeab10`), sesiones en servidor con cookie (`5eb46c5`), frontend separado en `interfaz.js` y `api.js` (`bed6929`), README (`2edec13`).
- **PR:** #6 (`feature/hito2-frontend-sesion`), con el CI en verde. Se integró sin commit de merge, en vez de con *Create a merge commit* como indica el README.
- **Etiqueta:** `hito-2` (`2edec13`).
- **Desviaciones:** `c9afe0f` («Update README.md») se editó directamente en `main` desde GitHub, sin PR, después de integrar el PR #6.

## Hito 3: persistencia y roles

- **Objetivo:** base de datos real sin cambiar la lógica, secretos fuera del código, roles aplicados en el servidor y registro de actividad.
- **Hecho (2026-10-09 a 2026-10-11):** repositorios de MongoDB (`c35aab8`), composición con MongoDB obligatoria en producción y parada ordenada (`d34f179`), pruebas de contrato comunes y MongoDB en el CI (`028e4e1`), documentación de Atlas y Secret Manager (`2554b81`). Los roles y el log ya existían desde el Hito 1.
- **PR:** #7 (`feature/hito3-persistencia`), con el CI en verde.
- **Etiqueta:** `hito-3` (`c4c2f3d`).
- **Desviaciones:** ninguna.

## Hito 4: servicios externos y cierre

- **Objetivo:** inicio de sesión con OAuth, confirmación de cuenta por correo, errores con feedback claro, README completo y revisión final.
- **Estado:** no completado. Pasan al [Sprint 2](sprint-2.md): [RF-02](requisitos.md) y [RF-04](requisitos.md), la revisión de [RNF-07](requisitos.md) con los nuevos flujos y la URL pública en el README.

## Desviaciones del flujo

Los siete pull requests y sus ejecuciones del CI están en GitHub; todas las ejecuciones del CI terminaron en verde. Desviaciones:

| Commit | Qué pasó |
|--------|----------|
| `c9afe0f` | Edición directa del README en `main` desde GitHub, sin PR y con un mensaje poco descriptivo |
| `2edec13` | El PR #6 se integró sin commit de merge, distinto del método que indica el README |
| — | El Hito 1 no tiene etiqueta |
| — | `main` no tiene protección de rama: el repositorio es privado y la protección no está disponible en el plan gratuito |

## Retrospectiva

### Hechos
- Tres de los cuatro hitos se cerraron entre el 2026-10-06 y el 2026-10-11; el Hito 4 no se empezó.
- El paso de memoria a MongoDB no modificó `server/logic/` ni `server/api/`, gracias a los contratos de repositorio ([D-05](decisiones.md#d-05-contratos-de-repositorio-con-dos-implementaciones)).
- El despliegue continuo cambió de GitHub Actions a Cloud Build durante el Hito 1 ([D-04](decisiones.md#d-04-despliegue-continuo-desde-github-actions) → [D-08](decisiones.md#d-08-despliegue-continuo-con-cloud-build)).
- Todo el trabajo entró por pull request salvo una edición directa del README (tabla anterior).
- Las 14 ejecuciones del CI terminaron en verde. La única ejecución fallida fue la del workflow de despliegue en GitHub Actions, que se retiró.

### Qué funcionó
TODO(alumno): ¿qué prácticas o decisiones te ahorraron trabajo?

### Qué cambiaría
TODO(alumno): ¿qué harás distinto para no editar `main` directamente y para etiquetar todos los hitos?
