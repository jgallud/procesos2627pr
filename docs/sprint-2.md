---
type: Sprint
title: Sprint 2
description: Objetivo del Sprint 2, requisitos que pasan del Sprint 1 y plan de Hundir la flota.
timestamp: 2026-11-01
---

# Sprint 2

- **Objetivo:** cerrar el Hito 4 e implementar el juego [Hundir la flota](requisitos-hundir-la-flota.md) para dos jugadores sobre la aplicación del Sprint 1.
- **Punto de partida:** etiqueta `base` (`5b0ac4c`), Sprint 1 completo con el Hito 4. Ver [D-20](decisiones.md#d-20-etiqueta-base-como-punto-de-partida).
- **Estado:** en curso.
- **Seguimiento:** TODO(alumno): enlace al tablero de Donetonic.

## Pasan del Sprint 1

Corresponden al Hito 4, que no se completó en el [Sprint 1](sprint-1.md#hito-4-servicios-externos-y-cierre).

| ID | Requisito | Estado | Punto de partida |
|----|-----------|--------|------------------|
| RF-02 | Confirmación de cuenta por correo | hecho (PR #10) | Notificador con Brevo ([D-15](decisiones.md#d-15-correo-de-confirmación-con-brevo)) en lugar del de log ([D-11](decisiones.md#d-11-notificador-de-confirmación-desacoplado)) |
| RF-04 | Inicio de sesión con OAuth | hecho (PR #12) | Google, implementado a mano ([D-17](decisiones.md#d-17-inicio-de-sesión-externo-con-google) a [D-19](decisiones.md#d-19-flujo-oauth-implementado-a-mano)) |

Tareas de cierre del Hito 4 que no son requisitos nuevos:

- Revisar [RNF-07](requisitos.md) (errores con feedback claro) en los flujos de OAuth y de correo.
- ~~Poner la URL pública en el README ([RNF-05](requisitos.md)).~~ Hecho en el PR #11.
- ~~Etiquetar `hito-4` con el CI en verde y la aplicación desplegada funcionando.~~ Hecho (`5b0ac4c`).

## Hundir la flota

Un PBI de Donetonic por incremento, escrito como historia de usuario; una tarea por requisito HF dentro de cada PBI; una rama y un pull request por PBI; un commit por requisito, con el identificador al principio del mensaje («HF-08: …»). Ver [D-21](decisiones.md#d-21-un-pbi-por-incremento-y-una-tarea-por-requisito).

Cada incremento sigue el mismo orden: prueba de la lógica, lógica, API, interfaz y, en el mismo PR, el requisito pasa a *hecho* en [requisitos-hundir-la-flota.md](requisitos-hundir-la-flota.md) con su evidencia.

| Inc. | PBI (Donetonic) | Historia de usuario | Requisitos | Rama | Estado |
|------|-----------------|---------------------|------------|------|--------|
| 1 | TODO(alumno) | Como jugador quiero crear una partida y ver las disponibles para encontrar rival | HF-01 a HF-07 | `feature/HF-01-crear-listar` | pendiente |
| 2 | TODO(alumno) | Como jugador quiero unirme a una partida en espera para jugar contra otro usuario | HF-08 a HF-10 | `feature/HF-08-unirse` | pendiente |
| 3 | TODO(alumno) | Como jugador quiero cancelar o abandonar una partida para no quedarme bloqueado en ella | HF-11 a HF-13 | `feature/HF-11-cancelar` | pendiente |
| 4 | TODO(alumno) | Como jugador quiero colocar mi flota para preparar la partida | HF-14 a HF-19 | `feature/HF-14-flota` | pendiente |
| 5 | TODO(alumno) | Como jugador quiero disparar por turnos para intentar hundir la flota rival | HF-20 a HF-26 | `feature/HF-20-disparos` | pendiente |
| 6 | TODO(alumno) | Como jugador quiero saber quién ha ganado y consultar mis partidas anteriores | HF-28 a HF-32 | `feature/HF-28-fin` | pendiente |
| 7 | TODO(alumno) | Como jugador quiero ver las jugadas del rival sin recargar la página | HF-33 a HF-36 | `feature/HF-33-tiempo-real` | pendiente |
| 8 | TODO(alumno) | Como administrador quiero ver y cancelar partidas para mantener el servicio | HF-37 a HF-39 | `feature/HF-37-admin` | pendiente |

HF-27 (tiempo límite de turno) es opcional y no tiene incremento asignado.
