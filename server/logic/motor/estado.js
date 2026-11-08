// MOTOR DEL JUEGO — utilidades comunes sobre el estado de una partida.
//
// El estado de una partida es un objeto plano (se puede guardar tal cual en
// memoria o en MongoDB):
//   {
//     estado: 'colocando' | 'en_juego' | 'terminada',
//     turno: 0 | 1,                 // jugador al que le toca disparar
//     ganador: null | 0 | 1,
//     motivoFin: null | 'flota_hundida' | 'abandono',
//     jugadores: [                  // el 0 es quien crea la partida
//       { flota: [{ barco, casillas: ['A1', 'A2'] }],
//         disparosRecibidos: [{ casilla, resultado, barco? }] },
//       { ... },
//     ],
//   }
// Las funciones del motor nunca modifican la partida que reciben: devuelven
// una copia nueva.

const { ErrorDominio, CODIGOS } = require('../errores');
const { ESTADOS } = require('./reglas');

function clonar(partida) {
  return structuredClone(partida);
}

function validarJugador(jugador) {
  if (jugador !== 0 && jugador !== 1) {
    throw new ErrorDominio(CODIGOS.DATOS_INVALIDOS, 'El jugador debe ser 0 o 1');
  }
}

function rivalDe(jugador) {
  return 1 - jugador;
}

// Mensajes claros cuando la jugada no corresponde al estado de la partida.
const MENSAJE_ESTADO = {
  [ESTADOS.COLOCANDO]: 'La partida aún no ha empezado: faltan barcos por colocar',
  [ESTADOS.EN_JUEGO]: 'La partida ya ha empezado: la flota no se puede mover',
  [ESTADOS.TERMINADA]: 'La partida ha terminado: no admite más jugadas',
};

function exigirEstado(partida, estadoEsperado) {
  if (partida.estado !== estadoEsperado) {
    throw new ErrorDominio(CODIGOS.ESTADO_INVALIDO, MENSAJE_ESTADO[partida.estado]);
  }
}

module.exports = { clonar, validarJugador, rivalDe, exigirEstado };
