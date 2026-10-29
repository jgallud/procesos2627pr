---
type: Sprint
title: Sprint 2
description: Objetivo del Sprint 2 y requisitos que pasan del Sprint 1.
timestamp: 2026-10-29
---

# Sprint 2

- **Objetivo:** Por definir (pendiente de la especificación del Sprint 2).
- **Estado:** en curso.
- **Seguimiento:** TODO(alumno): enlace al tablero de Donetonic.

## Pasan del Sprint 1

Corresponden al Hito 4, que no se completó en el [Sprint 1](sprint-1.md#hito-4-servicios-externos-y-cierre).

| ID | Requisito | Estado | Punto de partida |
|----|-----------|--------|------------------|
| RF-02 | Confirmación de cuenta por correo | hecho (PR #10) | Notificador con Brevo ([D-15](decisiones.md#d-15-correo-de-confirmación-con-brevo)) en lugar del de log ([D-11](decisiones.md#d-11-notificador-de-confirmación-desacoplado)) |
| RF-04 | Inicio de sesión con OAuth | hecho (PR #12) | Google, implementado a mano ([D-17](decisiones.md#d-17-inicio-de-sesión-externo-con-google) a [D-19](decisiones.md#d-19-flujo-oauth-implementado-a-mano)) |

Tareas de cierre del Hito 4 que no son requisitos nuevos:

- ~~Revisar [RNF-07](requisitos.md) (errores con feedback claro) en los flujos de OAuth y de correo.~~ Revisado el 2026-10-29.
- ~~Poner la URL pública en el README ([RNF-05](requisitos.md)).~~ Hecho en el PR #11.
- ~~Etiquetar `hito-4` con el CI en verde y la aplicación desplegada funcionando.~~ Etiqueta `hito-4` sobre `5b0ac4c`.

Con esto el Hito 4 queda cerrado. Queda pendiente decidir si se añade el reenvío del enlace de confirmación (limitación de [D-15](decisiones.md#d-15-correo-de-confirmación-con-brevo)).
