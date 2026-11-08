// MOTOR DEL JUEGO de Hundir la Flota (capa lógica, D-22 y RNF-09).
// Funciones puras sobre el estado de una partida: no importa nada de HTTP,
// WebSocket, base de datos ni interfaz. El servicio de partidas lo usa para
// aplicar cada jugada; la API y el cliente no contienen reglas del juego.

const reglas = require('./reglas');
const coordenadas = require('./coordenadas');
const colocacion = require('./colocacion');
const partida = require('./partida');

module.exports = {
  ...reglas,
  normalizarCasilla: coordenadas.normalizar,
  todasLasCasillas: coordenadas.todasLasCasillas,
  casillasDelBarco: colocacion.casillasDelBarco,
  colocarBarco: colocacion.colocarBarco,
  retirarBarco: colocacion.retirarBarco,
  colocarFlotaAleatoria: colocacion.colocarFlotaAleatoria,
  generarFlotaAleatoria: colocacion.generarFlotaAleatoria,
  crearPartida: partida.crearPartida,
  disparar: partida.disparar,
  abandonar: partida.abandonar,
  casillasSinDisparar: partida.casillasSinDisparar,
  vistaPara: partida.vistaPara,
};
