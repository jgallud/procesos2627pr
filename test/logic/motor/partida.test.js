// Pruebas unitarias del motor: disparos, turnos, fin de partida, abandono y
// vista de cada jugador (RF-13, RF-15, RF-16, RNF-10, D-25).

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const motor = require('../../../server/logic/motor');
const { CODIGOS } = require('../../../server/logic/errores');
const { colocarFlotaFija, partidaEnJuego, disparos, esError } = require('./ayuda');

const { DATOS_INVALIDOS, ESTADO_INVALIDO } = CODIGOS;

// Todas las casillas de la flota fija (ver ayuda.js).
const CASILLAS_FLOTA = [
  'A1', 'A2', 'A3', 'A4', 'A5', 'C1', 'C2', 'C3', 'C4', 'E1', 'E2', 'E3', 'G1', 'G2', 'G3', 'I1', 'I2',
];

describe('Motor: disparos y turnos', () => {
  it('no se puede disparar mientras se colocan los barcos', () => {
    const partida = colocarFlotaFija(motor.crearPartida(), 0);
    assert.throws(() => motor.disparar(partida, 0, 'A1'), esError(ESTADO_INVALIDO, 'aún no ha empezado'));
  });

  it('agua: el turno pasa al rival', () => {
    const { partida, disparo } = motor.disparar(partidaEnJuego(), 0, 'J10');
    assert.deepEqual(disparo, { casilla: 'J10', resultado: 'agua' });
    assert.equal(partida.turno, 1);
  });

  it('tocado: quien acierta repite turno, sin saber aún qué barco es', () => {
    const { partida, disparo } = motor.disparar(partidaEnJuego(), 0, 'a2');
    assert.deepEqual(disparo, { casilla: 'A2', resultado: 'tocado' });
    assert.equal(partida.turno, 0);
  });

  it('hundido: indica el nombre del barco', () => {
    const partida = disparos(partidaEnJuego(), 0, ['I1']);
    const { disparo } = motor.disparar(partida, 0, 'I2');
    assert.deepEqual(disparo, { casilla: 'I2', resultado: 'hundido', barco: 'destructor' });
  });

  it('rechaza disparar fuera de turno sin cambiar nada', () => {
    const partida = partidaEnJuego();
    assert.throws(() => motor.disparar(partida, 1, 'A1'), esError(ESTADO_INVALIDO, 'No es tu turno'));
    assert.equal(partida.jugadores[0].disparosRecibidos.length, 0);
  });

  it('rechaza un disparo repetido o fuera del tablero y no consume el turno', () => {
    const partida = disparos(partidaEnJuego(), 0, ['A1']);
    assert.throws(() => motor.disparar(partida, 0, 'a1'), esError(DATOS_INVALIDOS, 'Ya has disparado a A1'));
    assert.throws(() => motor.disparar(partida, 0, 'B11'), esError(DATOS_INVALIDOS, 'A1 a J10'));
    assert.equal(partida.turno, 0);
    assert.doesNotThrow(() => motor.disparar(partida, 0, 'B1'));
  });
});

describe('Motor: fin de partida y abandono', () => {
  it('hundir toda la flota rival termina la partida con su ganador', () => {
    const partida = disparos(partidaEnJuego(), 0, CASILLAS_FLOTA);
    assert.equal(partida.estado, motor.ESTADOS.TERMINADA);
    assert.equal(partida.ganador, 0);
    assert.equal(partida.motivoFin, motor.MOTIVOS_FIN.FLOTA_HUNDIDA);
  });

  it('una partida terminada no admite más jugadas', () => {
    const partida = disparos(partidaEnJuego(), 0, CASILLAS_FLOTA);
    assert.throws(() => motor.disparar(partida, 0, 'J10'), esError(ESTADO_INVALIDO, 'ha terminado'));
    assert.throws(() => motor.disparar(partida, 1, 'J10'), esError(ESTADO_INVALIDO, 'ha terminado'));
    assert.throws(() => motor.abandonar(partida, 1), esError(ESTADO_INVALIDO, 'ha terminado'));
  });

  it('abandonar cuenta como derrota, también mientras se colocan los barcos', () => {
    const enJuego = motor.abandonar(partidaEnJuego(), 0);
    assert.equal(enJuego.estado, motor.ESTADOS.TERMINADA);
    assert.equal(enJuego.ganador, 1);
    assert.equal(enJuego.motivoFin, motor.MOTIVOS_FIN.ABANDONO);
    assert.equal(motor.abandonar(motor.crearPartida(), 1).ganador, 0);
  });

  it('casillasSinDisparar descuenta las casillas ya disparadas', () => {
    const partida = disparos(partidaEnJuego(), 0, ['J10']);
    const libres = motor.casillasSinDisparar(partida, 0);
    assert.equal(libres.length, 99);
    assert.ok(!libres.includes('J10'));
    assert.equal(motor.casillasSinDisparar(partida, 1).length, 100);
  });
});

describe('Motor: vista de cada jugador (RF-16, RNF-10)', () => {
  it('durante la partida, la vista no incluye la flota del rival', () => {
    const partida = disparos(partidaEnJuego(), 0, ['A1', 'J10']);
    const vista = motor.vistaPara(partida, 0);
    assert.equal(vista.rival.flota, null);
    assert.deepEqual(vista.rival.disparos, [
      { casilla: 'A1', resultado: 'tocado' },
      { casilla: 'J10', resultado: 'agua' },
    ]);
    assert.equal(vista.propio.flota.length, 5);
    assert.equal(vista.esMiTurno, false);
    assert.equal(motor.vistaPara(partida, 1).esMiTurno, true);
    // Ninguna casilla de barco rival sin disparar aparece en la vista.
    const texto = JSON.stringify(vista.rival);
    assert.ok(!texto.includes('"A2"'));
  });

  it('mientras se colocan los barcos, indica los pendientes y si el rival ya ha terminado', () => {
    const partida = colocarFlotaFija(motor.crearPartida(), 1);
    const vista = motor.vistaPara(partida, 0);
    assert.equal(vista.estado, motor.ESTADOS.COLOCANDO);
    assert.deepEqual(vista.propio.barcosPendientes, motor.FLOTA.map((b) => b.barco));
    assert.equal(vista.rival.flotaColocada, true);
    assert.equal(vista.rival.flota, null);
  });

  it('al terminar, muestra las dos flotas y el resultado de cada jugador', () => {
    const partida = disparos(partidaEnJuego(), 0, CASILLAS_FLOTA);
    const ganador = motor.vistaPara(partida, 0);
    const perdedor = motor.vistaPara(partida, 1);
    assert.equal(ganador.resultado, 'victoria');
    assert.equal(perdedor.resultado, 'derrota');
    assert.equal(perdedor.rival.flota.length, 5);
  });
});
