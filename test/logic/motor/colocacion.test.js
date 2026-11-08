// Pruebas unitarias del motor: colocación de la flota (RF-12, D-25).

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const motor = require('../../../server/logic/motor');
const { CODIGOS } = require('../../../server/logic/errores');
const { colocarFlotaFija, azarFijo, esError } = require('./ayuda');

const { DATOS_INVALIDOS, ESTADO_INVALIDO } = CODIGOS;

describe('Motor: colocación de la flota', () => {
  it('una partida nueva está colocando, con los dos tableros vacíos', () => {
    const partida = motor.crearPartida();
    assert.equal(partida.estado, motor.ESTADOS.COLOCANDO);
    assert.equal(partida.turno, 0);
    assert.deepEqual(partida.jugadores.map((j) => j.flota), [[], []]);
  });

  it('coloca un barco en horizontal y en vertical', () => {
    let partida = motor.crearPartida();
    partida = motor.colocarBarco(partida, 0, { barco: 'acorazado', casilla: 'b2', orientacion: 'horizontal' });
    partida = motor.colocarBarco(partida, 0, { barco: 'destructor', casilla: 'E7', orientacion: 'vertical' });
    assert.deepEqual(partida.jugadores[0].flota, [
      { barco: 'acorazado', casillas: ['B2', 'B3', 'B4', 'B5'] },
      { barco: 'destructor', casillas: ['E7', 'F7'] },
    ]);
  });

  it('no modifica la partida que recibe', () => {
    const partida = motor.crearPartida();
    motor.colocarBarco(partida, 0, { barco: 'destructor', casilla: 'A1', orientacion: 'horizontal' });
    assert.deepEqual(partida.jugadores[0].flota, []);
  });

  it('rechaza un barco que se sale del tablero', () => {
    assert.throws(
      () => motor.colocarBarco(motor.crearPartida(), 0, { barco: 'portaaviones', casilla: 'A7', orientacion: 'horizontal' }),
      esError(DATOS_INVALIDOS, 'se sale del tablero'),
    );
  });

  it('rechaza una casilla inicial que no existe', () => {
    assert.throws(
      () => motor.colocarBarco(motor.crearPartida(), 0, { barco: 'destructor', casilla: 'K1', orientacion: 'vertical' }),
      esError(DATOS_INVALIDOS, 'A1 a J10'),
    );
  });

  it('rechaza un barco solapado con otro', () => {
    const partida = motor.colocarBarco(motor.crearPartida(), 0, { barco: 'crucero', casilla: 'C3', orientacion: 'vertical' });
    assert.throws(
      () => motor.colocarBarco(partida, 0, { barco: 'acorazado', casilla: 'D1', orientacion: 'horizontal' }),
      esError(DATOS_INVALIDOS, 'se solapa con el crucero'),
    );
  });

  it('rechaza un barco que toca a otro por un lado o en diagonal (D-25)', () => {
    const partida = motor.colocarBarco(motor.crearPartida(), 0, { barco: 'crucero', casilla: 'C3', orientacion: 'horizontal' });
    assert.throws(
      () => motor.colocarBarco(partida, 0, { barco: 'destructor', casilla: 'D3', orientacion: 'horizontal' }),
      esError(DATOS_INVALIDOS, 'toca al crucero'),
    );
    assert.throws(
      () => motor.colocarBarco(partida, 0, { barco: 'destructor', casilla: 'D6', orientacion: 'vertical' }),
      esError(DATOS_INVALIDOS, 'tampoco en diagonal'),
    );
  });

  it('rechaza un barco repetido, uno desconocido y una orientación inválida', () => {
    const partida = motor.colocarBarco(motor.crearPartida(), 0, { barco: 'destructor', casilla: 'A1', orientacion: 'horizontal' });
    assert.throws(
      () => motor.colocarBarco(partida, 0, { barco: 'destructor', casilla: 'J1', orientacion: 'horizontal' }),
      esError(DATOS_INVALIDOS, 'ya está colocado'),
    );
    assert.throws(
      () => motor.colocarBarco(partida, 0, { barco: 'lancha', casilla: 'J1', orientacion: 'horizontal' }),
      esError(DATOS_INVALIDOS, 'Barco desconocido'),
    );
    assert.throws(
      () => motor.colocarBarco(partida, 0, { barco: 'crucero', casilla: 'J1', orientacion: 'diagonal' }),
      esError(DATOS_INVALIDOS, 'orientación'),
    );
  });

  it('permite retirar un barco para colocarlo en otro sitio antes de empezar', () => {
    let partida = motor.colocarBarco(motor.crearPartida(), 0, { barco: 'destructor', casilla: 'A1', orientacion: 'horizontal' });
    partida = motor.retirarBarco(partida, 0, 'destructor');
    partida = motor.colocarBarco(partida, 0, { barco: 'destructor', casilla: 'J9', orientacion: 'horizontal' });
    assert.deepEqual(partida.jugadores[0].flota, [{ barco: 'destructor', casillas: ['J9', 'J10'] }]);
  });

  it('la partida empieza cuando los dos tienen los cinco barcos, y ya no se pueden mover', () => {
    let partida = colocarFlotaFija(motor.crearPartida(), 0);
    assert.equal(partida.estado, motor.ESTADOS.COLOCANDO);
    partida = colocarFlotaFija(partida, 1);
    assert.equal(partida.estado, motor.ESTADOS.EN_JUEGO);
    assert.throws(() => motor.retirarBarco(partida, 0, 'destructor'), esError(ESTADO_INVALIDO, 'no se puede mover'));
    assert.throws(() => motor.colocarFlotaAleatoria(partida, 0), esError(ESTADO_INVALIDO, 'no se puede mover'));
  });

  it('la colocación aleatoria cumple las reglas y es reproducible con azar fijo', () => {
    const una = motor.colocarFlotaAleatoria(motor.crearPartida(), 0, azarFijo(7)).jugadores[0].flota;
    const otra = motor.colocarFlotaAleatoria(motor.crearPartida(), 0, azarFijo(7)).jugadores[0].flota;
    assert.deepEqual(una, otra);
    assert.deepEqual(una.map((b) => b.barco), motor.FLOTA.map((b) => b.barco));
    // Volver a colocarla barco a barco con colocarBarco aplica todas las validaciones.
    let partida = motor.crearPartida();
    for (const { barco, casillas } of una) {
      const orientacion = casillas.length > 1 && casillas[0][0] === casillas[1][0] ? 'horizontal' : 'vertical';
      partida = motor.colocarBarco(partida, 0, { barco, casilla: casillas[0], orientacion });
    }
    assert.deepEqual(partida.jugadores[0].flota, una);
  });

  it('la colocación aleatoria funciona aunque el azar devuelva siempre lo mismo', () => {
    const flota = motor.generarFlotaAleatoria(() => 0);
    assert.equal(flota.length, motor.FLOTA.length);
  });
});
