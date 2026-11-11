// MOTOR DEL JUEGO — partida: creación, disparos, turnos, fin, abandono y la
// vista que recibe cada jugador. Funciones puras sobre el estado descrito en
// estado.js: no conocen HTTP, WebSocket, la base de datos ni la interfaz.

const { ErrorDominio, CODIGOS } = require('../errores');
const { ESTADOS, RESULTADOS, MOTIVOS_FIN } = require('./reglas');
const { normalizar, todasLasCasillas } = require('./coordenadas');
const { clonar, validarJugador, rivalDe, exigirEstado } = require('./estado');
const { flotaCompleta, barcosPendientes } = require('./colocacion');

// Partida nueva, con los dos tableros vacíos. Empieza quien crea la partida,
// el jugador 0 (D-25).
function crearPartida() {
  return {
    estado: ESTADOS.COLOCANDO,
    turno: 0,
    ganador: null,
    motivoFin: null,
    jugadores: [
      { flota: [], disparosRecibidos: [] },
      { flota: [], disparosRecibidos: [] },
    ],
  };
}

function hundido(barco, disparosRecibidos) {
  return barco.casillas.every((c) => disparosRecibidos.some((d) => d.casilla === c));
}

// MJ-04: barcos hundidos de un jugador, con todas sus casillas, para pintarlos
// enteros. No revela nada oculto: todas esas casillas ya han recibido disparo.
function barcosHundidos({ flota, disparosRecibidos }) {
  return flota
    .filter((barco) => hundido(barco, disparosRecibidos))
    .map(({ barco, casillas }) => ({ barco, casillas: [...casillas] }));
}

// RF-13: el jugador dispara a una casilla del tablero rival.
// Devuelve { partida, disparo } con disparo = { casilla, resultado, barco? };
// `barco` solo aparece si el disparo lo hunde. Si el disparo no es válido,
// lanza el error y la partida no cambia (no se consume el turno).
function disparar(partida, jugador, casilla) {
  validarJugador(jugador);
  exigirEstado(partida, ESTADOS.EN_JUEGO);
  if (partida.turno !== jugador) {
    throw new ErrorDominio(CODIGOS.ESTADO_INVALIDO, 'No es tu turno');
  }
  const objetivo = normalizar(casilla);
  const rival = rivalDe(jugador);
  if (partida.jugadores[rival].disparosRecibidos.some((d) => d.casilla === objetivo)) {
    throw new ErrorDominio(CODIGOS.DATOS_INVALIDOS, `Ya has disparado a ${objetivo}`);
  }

  const nueva = clonar(partida);
  const tablero = nueva.jugadores[rival];
  const barco = tablero.flota.find((b) => b.casillas.includes(objetivo));
  const disparo = { casilla: objetivo, resultado: RESULTADOS.AGUA };
  tablero.disparosRecibidos.push(disparo);

  if (!barco) {
    nueva.turno = rival; // agua: turno del rival
  } else if (hundido(barco, tablero.disparosRecibidos)) {
    disparo.resultado = RESULTADOS.HUNDIDO; // quien acierta repite (D-25)
    disparo.barco = barco.barco;
  } else {
    disparo.resultado = RESULTADOS.TOCADO;
  }

  // RF-15: si toda la flota rival está hundida, la partida termina.
  if (tablero.flota.every((b) => hundido(b, tablero.disparosRecibidos))) {
    nueva.estado = ESTADOS.TERMINADA;
    nueva.ganador = jugador;
    nueva.motivoFin = MOTIVOS_FIN.FLOTA_HUNDIDA;
  }
  return { partida: nueva, disparo: { ...disparo } };
}

// RF-15: abandonar cuenta como derrota. Se puede abandonar mientras se
// colocan los barcos o durante el juego, nunca una partida terminada.
function abandonar(partida, jugador) {
  validarJugador(jugador);
  if (partida.estado === ESTADOS.TERMINADA) exigirEstado(partida, ESTADOS.EN_JUEGO);
  const nueva = clonar(partida);
  nueva.estado = ESTADOS.TERMINADA;
  nueva.ganador = rivalDe(jugador);
  nueva.motivoFin = MOTIVOS_FIN.ABANDONO;
  return nueva;
}

// Casillas del tablero rival a las que el jugador aún no ha disparado
// (las usa el jugador máquina para no repetir casilla, RF-14).
function casillasSinDisparar(partida, jugador) {
  validarJugador(jugador);
  const disparadas = new Set(partida.jugadores[rivalDe(jugador)].disparosRecibidos.map((d) => d.casilla));
  return todasLasCasillas().filter((c) => !disparadas.has(c));
}

// RF-16 y RNF-10: lo que un jugador puede ver de la partida. Su tablero
// completo y, del rival, solo el resultado de sus propios disparos. La flota
// del rival solo se incluye cuando la partida ha terminado.
function vistaPara(partida, jugador) {
  validarJugador(jugador);
  const propio = partida.jugadores[jugador];
  const rival = partida.jugadores[rivalDe(jugador)];
  const terminada = partida.estado === ESTADOS.TERMINADA;
  let resultado = null;
  if (terminada) resultado = partida.ganador === jugador ? 'victoria' : 'derrota';

  return {
    estado: partida.estado,
    esMiTurno: partida.estado === ESTADOS.EN_JUEGO && partida.turno === jugador,
    resultado,
    motivoFin: partida.motivoFin,
    propio: {
      flota: clonar(propio.flota),
      barcosPendientes: barcosPendientes(propio.flota),
      disparosRecibidos: clonar(propio.disparosRecibidos),
      barcosHundidos: barcosHundidos(propio),
    },
    rival: {
      flotaColocada: flotaCompleta(rival.flota),
      disparos: clonar(rival.disparosRecibidos),
      barcosHundidos: barcosHundidos(rival),
      flota: terminada ? clonar(rival.flota) : null,
    },
  };
}

module.exports = { crearPartida, disparar, abandonar, casillasSinDisparar, vistaPara };
