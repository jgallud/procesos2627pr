// MOTOR DEL JUEGO — coordenadas del tablero.
// Una casilla se escribe como 'A1'…'J10' (fila en letra, columna en número)
// y se maneja internamente como { fila, columna }, ambas de 0 a 9.

const { ErrorDominio, CODIGOS } = require('../errores');
const { TAMANO, FILAS } = require('./reglas');

const PATRON_CASILLA = /^([A-J])(10|[1-9])$/;

// 'b7' -> { fila: 1, columna: 6 }. Rechaza cualquier cosa fuera de A1-J10.
function aPosicion(casilla) {
  const texto = typeof casilla === 'string' ? casilla.trim().toUpperCase() : '';
  const partes = PATRON_CASILLA.exec(texto);
  if (!partes) {
    throw new ErrorDominio(
      CODIGOS.DATOS_INVALIDOS,
      `La casilla «${String(casilla)}» no existe: el tablero va de A1 a J10`,
    );
  }
  return { fila: FILAS.indexOf(partes[1]), columna: Number(partes[2]) - 1 };
}

// { fila: 1, columna: 6 } -> 'B7'.
function aCasilla({ fila, columna }) {
  return `${FILAS[fila]}${columna + 1}`;
}

// Forma canónica de una casilla escrita por el usuario ('b7 ' -> 'B7').
function normalizar(casilla) {
  return aCasilla(aPosicion(casilla));
}

function dentroDelTablero({ fila, columna }) {
  return fila >= 0 && fila < TAMANO && columna >= 0 && columna < TAMANO;
}

// La casilla y sus hasta 8 vecinas (lados y diagonales), para la regla de
// que los barcos no pueden tocarse (D-25).
function casillaYVecinas(casilla) {
  const { fila, columna } = aPosicion(casilla);
  const resultado = [];
  for (let df = -1; df <= 1; df += 1) {
    for (let dc = -1; dc <= 1; dc += 1) {
      const vecina = { fila: fila + df, columna: columna + dc };
      if (dentroDelTablero(vecina)) resultado.push(aCasilla(vecina));
    }
  }
  return resultado;
}

// Las 100 casillas del tablero, en orden A1, A2… J10.
function todasLasCasillas() {
  const casillas = [];
  for (let fila = 0; fila < TAMANO; fila += 1) {
    for (let columna = 0; columna < TAMANO; columna += 1) casillas.push(aCasilla({ fila, columna }));
  }
  return casillas;
}

module.exports = { aPosicion, aCasilla, normalizar, dentroDelTablero, casillaYVecinas, todasLasCasillas };
