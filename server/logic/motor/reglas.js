// MOTOR DEL JUEGO — reglas fijas de Hundir la Flota (especificación del
// Sprint 2 y decisión D-25). Solo datos: no hay lógica en este archivo.

// Tablero de 10 × 10. Las filas son letras (A-J) y las columnas números
// (1-10): A1 es la esquina superior izquierda y J10 la inferior derecha.
const TAMANO = 10;
const FILAS = 'ABCDEFGHIJ';

// La flota clásica: cinco barcos, cada uno con su número de casillas.
const FLOTA = Object.freeze([
  Object.freeze({ barco: 'portaaviones', casillas: 5 }),
  Object.freeze({ barco: 'acorazado', casillas: 4 }),
  Object.freeze({ barco: 'crucero', casillas: 3 }),
  Object.freeze({ barco: 'submarino', casillas: 3 }),
  Object.freeze({ barco: 'destructor', casillas: 2 }),
]);

const ORIENTACIONES = Object.freeze(['horizontal', 'vertical']);

// Estados de una partida (RF-16): colocando la flota, en juego o terminada.
const ESTADOS = Object.freeze({
  COLOCANDO: 'colocando',
  EN_JUEGO: 'en_juego',
  TERMINADA: 'terminada',
});

const RESULTADOS = Object.freeze({
  AGUA: 'agua',
  TOCADO: 'tocado',
  HUNDIDO: 'hundido',
});

const MOTIVOS_FIN = Object.freeze({
  FLOTA_HUNDIDA: 'flota_hundida',
  ABANDONO: 'abandono',
});

module.exports = { TAMANO, FILAS, FLOTA, ORIENTACIONES, ESTADOS, RESULTADOS, MOTIVOS_FIN };
