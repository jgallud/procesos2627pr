# Cronología

Del más reciente al más antiguo. Fuentes: historial de git, pull requests y ejecuciones de GitHub Actions (consultados el 2026-10-25).

| Fecha | Evento | Referencia |
|-------|--------|------------|
| 2026-10-26 | PR #12: inicio de sesión con Google (RF-04) | [D-17](decisiones.md#d-17-inicio-de-sesión-externo-con-google), [RF-04](requisitos.md) |
| 2026-10-26 | PR #11 integrado: `APP_URL` obligatoria en producción y URL pública en el README | [D-16](decisiones.md#d-16-app_url-obligatoria-en-producción) |
| 2026-10-26 | Incidencia: los correos de confirmación llevan un enlace a `localhost` porque `APP_URL` no está definida en Cloud Run. Solución: definirla en el servicio | [D-16](decisiones.md#d-16-app_url-obligatoria-en-producción) |
| 2026-10-26 | PR #10 integrado: confirmación de cuenta por correo con Brevo (RF-02) | [D-15](decisiones.md#d-15-correo-de-confirmación-con-brevo), [RF-02](requisitos.md) |
| 2026-10-26 | PR #9 integrado: fecha de cierre del Sprint 1 | `c4b88bd` |
| 2026-10-26 | PR #8 integrado: bundle OKF del Sprint 1 en `docs/` | `736f104` |
| 2026-10-25 | Se crea este bundle de documentación | rama `docs/okf-sprint1` |
| 2026-10-14 | Cierre del Sprint 1, con el Hito 4 sin completar | [Sprint 1](sprint-1.md), [Sprint 2](sprint-2.md) |
| 2026-10-11 | Etiqueta `hito-3` | `c4c2f3d` |
| 2026-10-11 | PR #7 integrado: persistencia en MongoDB, pruebas de contrato y MongoDB en el CI | `c4c2f3d`, [Hito 3](sprint-1.md#hito-3-persistencia-y-roles) |
| 2026-10-09 | Capa de datos con MongoDB sin cambios en la lógica ni en la API | `c35aab8`, [D-05](decisiones.md#d-05-contratos-de-repositorio-con-dos-implementaciones) |
| 2026-10-08 | Edición directa del README en `main` desde GitHub, sin PR (desviación del flujo) | `c9afe0f` |
| 2026-10-08 | Etiqueta `hito-2` | `2edec13` |
| 2026-10-08 | PR #6 integrado sin commit de merge: frontend y sesión | `50c903a`…`2edec13`, [Hito 2](sprint-1.md#hito-2-frontend-y-sesión) |
| 2026-10-08 | Sesión en servidor con cookie; sustituye a la cabecera provisional `X-Usuario-Id` | `5eb46c5`, [D-10](decisiones.md#d-10-sesiones-en-servidor-con-cookie-httponly) |
| 2026-10-06 | PR #5 integrado: despliegue continuo con la integración de Cloud Run y Cloud Build | `c114569`, `2983f7d`, [D-08](decisiones.md#d-08-despliegue-continuo-con-cloud-build) |
| 2026-10-06 | PR #4 integrado: `package-lock.json` y retirada del workflow de despliegue | `3f4b30e` |
| 2026-10-06 | Falla el workflow «Despliegue» en `main`, en el paso de autenticación en Google Cloud | `b204f78`, [D-04](decisiones.md#d-04-despliegue-continuo-desde-github-actions) |
| 2026-10-06 | PR #3 integrado: esqueleto, CI, lógica y API de usuarios. El PR #2 queda integrado a la vez, porque sus commits ya estaban incluidos | `b204f78`, [Hito 1](sprint-1.md#hito-1-esqueleto-y-backend) |
| 2026-10-06 | PR #1 (lógica de usuarios) cerrado sin integrar; sus commits entran con el PR #3 | — |
| 2026-10-06 | Commit inicial | `fbd5cbc` |
