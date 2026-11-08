---
type: Sprint
title: Sprint 2
description: Objetivo del Sprint 2, requisitos que pasan del Sprint 1 y plan de Hundir la Flota por hitos.
timestamp: 2026-11-06
---

# Sprint 2

- **Objetivo:** cerrar el Hito 4 (hecho) e implementar el juego Hundir la Flota sobre la aplicación del Sprint 1: primero contra la máquina y después entre dos jugadores en tiempo real.
- **Punto de partida:** etiqueta `base` (`5b0ac4c`), con el Sprint 1 completo ([D-21](decisiones.md#d-21-etiqueta-base-como-punto-de-partida)).
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

## Hundir la Flota

Tres hitos, un PBI de Donetonic por hito. Cada hito se reparte en varios pull requests, empezando por el motor del juego: primero las reglas en la capa lógica con sus pruebas, después el servicio, la API y la interfaz ([D-22](decisiones.md#d-22-motor-del-juego-en-la-capa-lógica)). Requisitos y reglas en [requisitos.md](requisitos.md#sprint-2--hundir-la-flota).

| Hito | PBI (Donetonic) | Requisitos | Estado |
|------|-----------------|------------|--------|
| 5 | Partida contra la máquina | RF-11 a RF-16, RNF-09, RNF-10, RNF-11 | pendiente |
| 6 | Persistencia, historial y estadísticas | RF-17 a RF-21 | pendiente |
| 7 | Partida entre jugadores en tiempo real | RF-22 a RF-26, RNF-12 | pendiente |

Cada hito se cierra como en el Sprint 1: CI en verde, aplicación desplegada funcionando, requisitos actualizados con su evidencia y etiqueta (`hito-5`, `hito-6`, `hito-7`).
