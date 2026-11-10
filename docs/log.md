# Cronología

Del más reciente al más antiguo. Fuentes: historial de git, pull requests y ejecuciones de GitHub Actions (consultados el 2026-10-25).

| Fecha | Evento | Referencia |
|-------|--------|------------|
| 2026-11-10 | PR #20: servicio de partidas contra la máquina, repositorio en memoria y rutas `/api/partidas` | [D-29](decisiones.md#d-29-partidas-en-memoria-durante-el-hito-5) |
| 2026-11-10 | El bloqueo de Actions continúa con el repositorio público; se escribe al soporte de GitHub y se ejecutan las pruebas en local antes de integrar | [D-27](decisiones.md#d-27-repositorio-público) |
| 2026-11-08 | Desviación: los PR #17, #18 y #19 se integran sin que llegue a ejecutarse el CI (cuenta bloqueada). Las pruebas del motor y del jugador máquina pasan en local (37 casos) | [D-27](decisiones.md#d-27-repositorio-público) |
| 2026-11-08 | Jugador máquina en la capa lógica, con 11 pruebas con azar fijo | rama `feature/hito5-jugador-maquina`, [D-28](decisiones.md#d-28-estrategia-del-jugador-máquina) |
| 2026-11-08 | El repositorio pasa a ser público para que el CI vuelva a ejecutarse | [D-27](decisiones.md#d-27-repositorio-público) |
| 2026-11-08 | Incidencia: el CI del PR de `feature/hito5-motor-juego` no llega a arrancar porque GitHub bloquea Actions en la cuenta por un problema de facturación | [D-27](decisiones.md#d-27-repositorio-público) |
| 2026-11-08 | Motor del juego en la capa lógica, con 26 pruebas unitarias | rama `feature/hito5-motor-juego`, [D-22](decisiones.md#d-22-motor-del-juego-en-la-capa-lógica), [D-26](decisiones.md#d-26-estado-de-la-partida-como-objeto-plano-y-motor-inmutable) |
| 2026-11-06 | PR #16: plan de Hundir la Flota en el bundle (requisitos RF-11 a RF-26 y RNF-09 a RNF-12, decisiones D-21 a D-25) | [Sprint 2](sprint-2.md#hundir-la-flota) |
| 2026-11-04 | PR #15 integrado: el contenedor de MongoDB del CI arranca con el kernel 7.0 | [D-20](decisiones.md#d-20-mongodb-8-en-el-ci-con-el-kernel-70-de-github) |
| 2026-11-01 | Etiqueta `base`: punto de partida para futuras aplicaciones | `5b0ac4c`, [D-21](decisiones.md#d-21-etiqueta-base-como-punto-de-partida) |
| 2026-10-29 | PR #14: cierre del Hito 4 en la documentación | [Sprint 2](sprint-2.md) |
| 2026-10-29 | Incidencia: el CI falla al iniciar el contenedor `mongo:8` (kernel 7.0 en los runners de GitHub); las pruebas no llegan a ejecutarse | [D-20](decisiones.md#d-20-mongodb-8-en-el-ci-con-el-kernel-70-de-github) |
| 2026-10-29 | Etiqueta `hito-4`: Hito 4 cerrado (RF-02, RF-04 y RNF-07 comprobados en producción) | `5b0ac4c` |
| 2026-10-26 | PR #13 integrado: botón «Iniciar sesión con Google» según la guía de marca de Google | [D-17](decisiones.md#d-17-inicio-de-sesión-externo-con-google) |
| 2026-10-26 | PR #12 integrado: inicio de sesión con Google (RF-04) | [D-17](decisiones.md#d-17-inicio-de-sesión-externo-con-google), [RF-04](requisitos.md) |
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
