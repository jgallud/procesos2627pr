// Ayudas para las pruebas del motor del juego.

const motor = require('../../../server/logic/motor');

// Flota fija y válida: un barco por fila impar, empezando en la columna 1.
const FLOTA_FIJA = [
  { barco: 'portaaviones', casilla: 'A1', orientacion: 'horizontal' }, // A1-A5
  { barco: 'acorazado', casilla: 'C1', orientacion: 'horizontal' }, // C1-C4
  { barco: 'crucero', casilla: 'E1', orientacion: 'horizontal' }, // E1-E3
  { barco: 'submarino', casilla: 'G1', orientacion: 'horizontal' }, // G1-G3
  { barco: 'destructor', casilla: 'I1', orientacion: 'horizontal' }, // I1-I2
];

function colocarFlotaFija(partida, jugador) {
  return FLOTA_FIJA.reduce((p, barco) => motor.colocarBarco(p, jugador, barco), partida);
}

// Partida en juego con la flota fija en los dos tableros; empieza el jugador 0.
function partidaEnJuego() {
  return colocarFlotaFija(colocarFlotaFija(motor.crearPartida(), 0), 1);
}

// Aplica varios disparos seguidos y devuelve la partida resultante.
function disparos(partida, jugador, casillas) {
  return casillas.reduce((p, casilla) => motor.disparar(p, jugador, casilla).partida, partida);
}

// Fuente de azar fija (mulberry32): misma semilla, misma secuencia.
function azarFijo(semilla) {
  let a = semilla >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Comprueba que una función lanza un ErrorDominio con el código dado y un
// mensaje que contiene el texto indicado.
function esError(codigo, texto) {
  return (err) => err.name === 'ErrorDominio' && err.codigo === codigo && err.message.includes(texto);
}

module.exports = { FLOTA_FIJA, colocarFlotaFija, partidaEnJuego, disparos, azarFijo, esError };
