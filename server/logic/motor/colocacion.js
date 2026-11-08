// MOTOR DEL JUEGO — colocación de la flota (RF-12).
// Un barco se coloca con su casilla inicial y su orientación; ocupa casillas
// hacia la derecha (horizontal) o hacia abajo (vertical). Debe quedar dentro
// del tablero, sin solaparse ni tocar a otro barco, tampoco en diagonal (D-25).

const { ErrorDominio, CODIGOS } = require('../errores');
const { FLOTA, ORIENTACIONES, ESTADOS, TAMANO } = require('./reglas');
const { aPosicion, aCasilla, dentroDelTablero, casillaYVecinas } = require('./coordenadas');
const { clonar, validarJugador, exigirEstado } = require('./estado');

function datosDelBarco(barco) {
  const datos = FLOTA.find((b) => b.barco === barco);
  if (!datos) {
    const nombres = FLOTA.map((b) => b.barco).join(', ');
    throw new ErrorDominio(CODIGOS.DATOS_INVALIDOS, `Barco desconocido: «${String(barco)}». La flota es: ${nombres}`);
  }
  return datos;
}

// Casillas que ocupa un barco, o error si se sale del tablero.
function casillasDelBarco(barco, casillaInicial, orientacion) {
  const { casillas: longitud } = datosDelBarco(barco);
  if (!ORIENTACIONES.includes(orientacion)) {
    throw new ErrorDominio(CODIGOS.DATOS_INVALIDOS, 'La orientación debe ser «horizontal» o «vertical»');
  }
  const inicio = aPosicion(casillaInicial);
  const casillas = [];
  for (let i = 0; i < longitud; i += 1) {
    const posicion = orientacion === 'horizontal'
      ? { fila: inicio.fila, columna: inicio.columna + i }
      : { fila: inicio.fila + i, columna: inicio.columna };
    if (!dentroDelTablero(posicion)) {
      throw new ErrorDominio(
        CODIGOS.DATOS_INVALIDOS,
        `El ${barco} (${longitud} casillas) no cabe desde ${aCasilla(inicio)} en ${orientacion}: se sale del tablero`,
      );
    }
    casillas.push(aCasilla(posicion));
  }
  return casillas;
}

// Comprueba que un barco nuevo se puede añadir a una flota: no repetido, sin
// solaparse y sin tocar a ningún barco ya colocado.
function comprobarHueco(flota, barco, casillas) {
  if (flota.some((b) => b.barco === barco)) {
    throw new ErrorDominio(CODIGOS.DATOS_INVALIDOS, `El ${barco} ya está colocado`);
  }
  for (const otro of flota) {
    if (casillas.some((c) => otro.casillas.includes(c))) {
      throw new ErrorDominio(CODIGOS.DATOS_INVALIDOS, `El ${barco} se solapa con el ${otro.barco}`);
    }
    const alrededor = new Set(otro.casillas.flatMap(casillaYVecinas));
    if (casillas.some((c) => alrededor.has(c))) {
      throw new ErrorDominio(
        CODIGOS.DATOS_INVALIDOS,
        `El ${barco} toca al ${otro.barco}: los barcos no pueden tocarse, tampoco en diagonal`,
      );
    }
  }
}

function flotaCompleta(flota) {
  return FLOTA.every(({ barco }) => flota.some((b) => b.barco === barco));
}

function barcosPendientes(flota) {
  return FLOTA.filter(({ barco }) => !flota.some((b) => b.barco === barco)).map(({ barco }) => barco);
}

// Si los dos jugadores tienen la flota completa, la partida empieza.
function empezarSiProcede(partida) {
  if (partida.jugadores.every((j) => flotaCompleta(j.flota))) partida.estado = ESTADOS.EN_JUEGO;
  return partida;
}

// RF-12: coloca un barco. Devuelve la partida nueva; la recibida no cambia.
function colocarBarco(partida, jugador, { barco, casilla, orientacion } = {}) {
  validarJugador(jugador);
  exigirEstado(partida, ESTADOS.COLOCANDO);
  const casillas = casillasDelBarco(barco, casilla, orientacion);
  comprobarHueco(partida.jugadores[jugador].flota, barco, casillas);
  const nueva = clonar(partida);
  nueva.jugadores[jugador].flota.push({ barco, casillas });
  return empezarSiProcede(nueva);
}

// Quita un barco ya colocado, para corregir la colocación antes de empezar.
function retirarBarco(partida, jugador, barco) {
  validarJugador(jugador);
  exigirEstado(partida, ESTADOS.COLOCANDO);
  datosDelBarco(barco);
  if (!partida.jugadores[jugador].flota.some((b) => b.barco === barco)) {
    throw new ErrorDominio(CODIGOS.DATOS_INVALIDOS, `El ${barco} no está colocado`);
  }
  const nueva = clonar(partida);
  nueva.jugadores[jugador].flota = nueva.jugadores[jugador].flota.filter((b) => b.barco !== barco);
  return nueva;
}

// Genera una flota completa y válida al azar. `azar` es una función que
// devuelve un número en [0, 1), como Math.random; en las pruebas se inyecta
// una fija para que el resultado sea reproducible (RNF-11).
// Para cada barco se elige al azar un punto de partida en la lista de todas
// las posiciones posibles (casilla y orientación) y se recorre desde ahí
// hasta encontrar un hueco válido: así nunca se queda probando sin fin,
// aunque la fuente de azar devuelva siempre el mismo número.
function generarFlotaAleatoria(azar = Math.random) {
  const posiciones = [];
  for (let fila = 0; fila < TAMANO; fila += 1) {
    for (let columna = 0; columna < TAMANO; columna += 1) {
      for (const orientacion of ORIENTACIONES) posiciones.push({ casilla: aCasilla({ fila, columna }), orientacion });
    }
  }
  for (let intento = 0; intento < 50; intento += 1) {
    const flota = [];
    for (const { barco } of FLOTA) {
      const inicio = Math.floor(azar() * posiciones.length);
      for (let k = 0; k < posiciones.length; k += 1) {
        const { casilla, orientacion } = posiciones[(inicio + k) % posiciones.length];
        try {
          const casillas = casillasDelBarco(barco, casilla, orientacion);
          comprobarHueco(flota, barco, casillas);
          flota.push({ barco, casillas });
          break;
        } catch (err) {
          if (err.name !== 'ErrorDominio') throw err;
        }
      }
    }
    if (flotaCompleta(flota)) return flota;
  }
  throw new Error('No se ha podido generar una flota aleatoria');
}

// RF-12: colocación automática. Sustituye lo que el jugador hubiera colocado.
function colocarFlotaAleatoria(partida, jugador, azar = Math.random) {
  validarJugador(jugador);
  exigirEstado(partida, ESTADOS.COLOCANDO);
  const nueva = clonar(partida);
  nueva.jugadores[jugador].flota = generarFlotaAleatoria(azar);
  return empezarSiProcede(nueva);
}

module.exports = {
  casillasDelBarco,
  colocarBarco,
  retirarBarco,
  colocarFlotaAleatoria,
  generarFlotaAleatoria,
  flotaCompleta,
  barcosPendientes,
};
