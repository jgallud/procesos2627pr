---
type: Proceso
title: Flujo de trabajo y pipeline de CI/CD
description: Cómo llega un cambio desde la rama hasta producción, qué hace el CI y cómo funciona el despliegue continuo.
timestamp: 2026-10-26
---

# Flujo de trabajo y pipeline de CI/CD

## Flujo de trabajo (GitHub Flow)

1. Una rama por cambio desde `main` actualizado: `feature/<descripcion>` (documentación: `docs/<descripcion>`).
2. Programar y ejecutar `npm test` en local.
3. Subir la rama y abrir un pull request contra `main`.
4. Integrar solo con el CI en verde, con *Create a merge commit*.
5. Al cerrar un hito, etiquetar el último commit de `main` (`hito-1`, `hito-2`…).

En el Sprint 1 este flujo no se cumplió siempre: ver [desviaciones del flujo](sprint-1.md#desviaciones-del-flujo). Requisito [PRO-01](requisitos.md).

**Documentación en el mismo PR.** Si un cambio afecta a lo que describe `docs/`, se actualiza en el mismo pull request: el estado en [requisitos.md](requisitos.md), una decisión nueva en [decisiones.md](decisiones.md) y una entrada en [log.md](log.md).

## Integración continua

Workflow `.github/workflows/ci.yml`, que se ejecuta en cada pull request y en cada push a `main`:

1. Levanta un contenedor `mongo:8` efímero, con comprobación de salud.
2. Descarga el código y prepara Node.js 22.
3. Instala dependencias con `npm ci`.
4. Ejecuta `npm test` con `LOG_LEVEL=silent` y `MONGODB_URI_TEST` apuntando al contenedor, de modo que también se ejecutan las pruebas de MongoDB y de persistencia.

No usa Atlas ni ningún secreto. Requisito [PRO-02](requisitos.md).

## Despliegue continuo

Un activador de Cloud Build vigila `main`. En cada cambio construye la imagen con el `Dockerfile`, la sube a Artifact Registry y despliega una revisión nueva en Cloud Run (`europe-west1`). No espera al resultado del CI: funcionan de forma independiente, como permite la especificación. La configuración se hace una vez en la consola de Google Cloud: ver [despliegue-cloud-run.md](despliegue-cloud-run.md). Requisito [PRO-03](requisitos.md) y decisión [D-08](decisiones.md#d-08-despliegue-continuo-con-cloud-build).

## Variables de entorno

Solo nombres; los valores están en `.env` (local, no versionado) o en Cloud Run y Secret Manager (producción): `PORT`, `NODE_ENV`, `MONGODB_URI` (secreto), `MONGODB_DB`, `LOG_LEVEL`, `ADMIN_EMAIL`, `ADMIN_PASSWORD` (secreto), `APP_URL`, `SESION_HORAS`, `BREVO_API_KEY` (secreto), `CORREO_REMITENTE`, `CORREO_REMITENTE_NOMBRE`. Para las pruebas: `MONGODB_URI_TEST`. Descripción de cada una en el [README](../README.md#variables-de-entorno).
