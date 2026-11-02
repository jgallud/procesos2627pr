---
type: Requisitos
title: Requisitos de Hundir la flota
description: Requisitos funcionales del juego Hundir la flota para dos jugadores, integrado en la arquitectura del Sprint 1, con su estado y evidencia.
timestamp: 2026-11-01
---

# Requisitos de Hundir la flota

Aplicación del [Sprint 2](sprint-2.md): el juego Hundir la flota para dos jugadores, construido sobre la aplicación del Sprint 1 (etiqueta `base`). Reutiliza la gestión de usuarios, la sesión, los roles, MongoDB, el registro de actividad y el pipeline de CI/CD sin modificarlos.

Mismos estados que en [requisitos.md](requisitos.md): **hecho** (se cumple, con evidencia), **parcial** o **pendiente**. Los identificadores llevan el prefijo **HF-** para no confundirse con los RF del Sprint 1. La columna *Inc.* indica el incremento (PBI y rama) en que se implementa cada requisito, según [sprint-2.md](sprint-2.md#hundir-la-flota).

## Alcance

- Solo juegan usuarios autenticados y activos (confirmados o registrados con Google, no eliminados): se usa `usuarioDeSesion` del servicio de usuarios.
- Cada partida enfrenta a exactamente dos jugadores humanos.
- Todas las reglas (validar barcos, turnos, resultado de un disparo, victoria) se aplican en el servidor; el cliente solo pinta el estado que recibe y envía intenciones.
- Fuera de alcance: partidas contra la máquina, más de dos jugadores, chat, clasificación global y espectadores.

## Reglas del juego

| Elemento | Valor |
|----------|-------|
| Tablero | 10 × 10 casillas por jugador (columnas A–J, filas 1–10) |
| Flota | 1 portaaviones (5), 1 acorazado (4), 2 cruceros (3), 1 destructor (2) |
| Orientación | Horizontal o vertical, nunca en diagonal |
| Colocación | Sin solaparse y dentro del tablero |
| Turnos | Alternos, un disparo por turno |
| Victoria | Gana quien hunde primero toda la flota rival |

Estados de una partida: **esperando rival → colocando barcos → en juego → finalizada**, o **cancelada** desde *esperando rival*. Un abandono en *colocando barcos* o *en juego* lleva a *finalizada* con victoria del rival.

## Gestión de partidas

| ID | Requisito | Inc. | Estado | Evidencia |
|----|-----------|------|--------|-----------|
| HF-01 | Un usuario autenticado crea una partida: identificador único, creador como jugador 1, fecha de creación y estado *esperando rival* | 1 | pendiente | — |
| HF-02 | Un usuario solo puede tener una partida abierta (no finalizada ni cancelada); crear otra se rechaza con un mensaje claro (409) | 1 | pendiente | — |
| HF-03 | El creador puede dar nombre a la partida (máximo 40 caracteres, validado en el servidor); si no, «Partida de» seguido del email del creador | 1 | pendiente | — |
| HF-04 | Un usuario autenticado ve las partidas disponibles: en *esperando rival* y no creadas por él | 1 | pendiente | — |
| HF-05 | Cada partida de la lista muestra nombre, creador, fecha de creación y estado | 1 | pendiente | — |
| HF-06 | La lista se ordena de más reciente a más antigua y se actualiza sin recargar la página | 1 | pendiente | — |
| HF-07 | El usuario ve aparte sus partidas abiertas, para retomarlas | 1 | pendiente | — |
| HF-08 | Un usuario se une a una partida en *esperando rival*: queda como jugador 2 y la partida pasa a *colocando barcos* | 2 | pendiente | — |
| HF-09 | Unirse se rechaza si la partida no existe (404), está llena o no espera rival (409) o es propia (400); si dos usuarios se unen a la vez, solo uno lo consigue | 2 | pendiente | — |
| HF-10 | Cuando se une el segundo jugador, el creador se entera y ambos pasan a la colocación | 2 | pendiente | — |
| HF-11 | El creador puede cancelar su partida en *esperando rival*; deja de aparecer en la lista | 3 | pendiente | — |
| HF-12 | Un jugador puede abandonar en *colocando barcos* o *en juego*; la partida finaliza con victoria del rival por abandono | 3 | pendiente | — |
| HF-13 | Una partida en *esperando rival* sin rival tras un tiempo configurable (30 minutos por defecto) se cancela sola | 3 | pendiente | — |

## Colocación de la flota

| ID | Requisito | Inc. | Estado | Evidencia |
|----|-----------|------|--------|-----------|
| HF-14 | En *colocando barcos*, cada jugador coloca su flota indicando por barco casilla de inicio y orientación | 4 | pendiente | — |
| HF-15 | El servidor valida la flota completa (barcos exactos, dentro del tablero, sin solapes) y, si no es válida, indica el motivo | 4 | pendiente | — |
| HF-16 | Colocación aleatoria generada y validada por el servidor | 4 | pendiente | — |
| HF-17 | El jugador confirma su flota («Listo») y ya no puede cambiarla; ve si su rival está listo | 4 | pendiente | — |
| HF-18 | Con los dos jugadores listos, la partida pasa a *en juego* y el servidor asigna el primer turno | 4 | pendiente | — |
| HF-19 | La posición de los barcos de un jugador nunca se envía al cliente del rival | 4 | pendiente | — |

## Desarrollo de la partida

| ID | Requisito | Inc. | Estado | Evidencia |
|----|-----------|------|--------|-----------|
| HF-20 | La pantalla de juego muestra el tablero propio (barcos e impactos recibidos) y el del rival (solo los disparos propios) | 5 | pendiente | — |
| HF-21 | En su turno, el jugador dispara a una casilla rival y recibe el resultado: agua, tocado o hundido (con el barco) | 5 | pendiente | — |
| HF-22 | Se rechaza el disparo fuera de turno, fuera del tablero, a una casilla repetida o con la partida no *en juego*; el turno no cambia | 5 | pendiente | — |
| HF-23 | Tras un disparo válido, el turno pasa al rival | 5 | pendiente | — |
| HF-24 | Ambos jugadores ven de quién es el turno y los últimos disparos | 5 | pendiente | — |
| HF-25 | Solo los dos jugadores pueden consultar o actuar en una partida; cualquier otro usuario recibe 403 | 5 | pendiente | — |
| HF-26 | Tras recargar o volver más tarde, el jugador recupera la partida donde estaba | 5 | pendiente | — |
| HF-27 | (Opcional) Quien no dispara en su turno durante un tiempo configurable pierde por abandono | — | pendiente | — |

## Fin de partida e historial

| ID | Requisito | Inc. | Estado | Evidencia |
|----|-----------|------|--------|-----------|
| HF-28 | Al hundirse el último barco de un jugador, la partida finaliza con ganador, perdedor, motivo y fecha, y no admite más disparos | 6 | pendiente | — |
| HF-29 | Al terminar, ambos jugadores ven el resultado y el tablero completo del rival | 6 | pendiente | — |
| HF-30 | El usuario consulta su historial de partidas finalizadas: rival, resultado y fecha | 6 | pendiente | — |
| HF-31 | El usuario ve sus estadísticas: partidas jugadas, ganadas y perdidas | 6 | pendiente | — |
| HF-32 | Si se elimina una cuenta, sus partidas abiertas se cancelan o se pierden por abandono; las finalizadas se conservan en el historial del rival | 6 | pendiente | — |

## Comunicación en tiempo real

| ID | Requisito | Inc. | Estado | Evidencia |
|----|-----------|------|--------|-----------|
| HF-33 | Los cambios (rival unido, rival listo, disparo recibido, turno, fin, abandono) llegan al otro jugador sin recargar | 7 | pendiente | — |
| HF-34 | El mecanismo se sirve desde el mismo backend y origen y exige sesión válida | 7 | pendiente | — |
| HF-35 | Las acciones del jugador pasan siempre por la API y la lógica del servidor, única fuente de verdad | 7 | pendiente | — |
| HF-36 | Si se pierde la conexión, el cliente avisa, reintenta y al volver pide el estado completo | 7 | pendiente | — |

## Administración

| ID | Requisito | Inc. | Estado | Evidencia |
|----|-----------|------|--------|-----------|
| HF-37 | El administrador lista todas las partidas, con filtro por estado, sin ver los barcos de las partidas en curso | 8 | pendiente | — |
| HF-38 | El administrador puede cancelar cualquier partida abierta; los jugadores se enteran | 8 | pendiente | — |
| HF-39 | Las rutas de administración de partidas comprueban el rol en el servidor (403 para un usuario normal) | 8 | pendiente | — |

## Requisitos no funcionales

Se aplican los RNF-01 a RNF-08 de [requisitos.md](requisitos.md) a todo el juego: partidas persistidas en MongoDB, rutas con sesión, errores con mensaje claro, registro de actividad (crear, unirse, empezar, terminar, abandonar, disparos rechazados) y pruebas automatizadas de la lógica de partidas.
