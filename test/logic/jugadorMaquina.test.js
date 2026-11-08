// Pruebas unitarias del jugador máquina (RF-14), con una fuente de azar fija
// para que sean reproducibles (RNF-11).

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const motor = require('../../server/logic/motor');
const { elegirDisparo, elegirColocacion, jugarTurno } = require('../../server/logic/jugadorMaquina');
const { CODIGOS } = require('../../server/logic/errores');
const { partidaEnJuego, colocarFlotaFija, disparos, azarFijo, esError } = require('./motor/ayuda');

const agua = (casilla) => ({ casilla, resultado: 'agua' });
const tocado = (casilla) => ({ casilla, resultado: 'tocado' });

// Partida en juego en la que le toca a la máquina (jugador 1): el jugador 0
// falla su primer disparo.
function turnoDeLaMaquina() {
  return motor.disparar(partidaEnJuego(), 0, 'J10').partida;
}

describe('Jugador máquina: elegir disparo', () => {
  it('con el mismo azar fijo elige siempre la misma casilla', () => {
    assert.equal(elegirDisparo([], azarFijo(3)), elegirDisparo([], azarFijo(3)));
  });

  it('nunca dispara a una casilla ya disparada', () => {
    const hechos = motor.todasLasCasillas().slice(0, 99).map(agua);
    assert.equal(elegirDisparo(hechos, azarFijo(1)), 'J10');
  });

  it('tras un tocado aislado, dispara a una casilla vecina por un lado', () => {
    for (let semilla = 0; semilla < 20; semilla += 1) {
      const casilla = elegirDisparo([tocado('E5')], azarFijo(semilla));
      assert.ok(['D5', 'F5', 'E4', 'E6'].includes(casilla), casilla);
    }
  });

  it('con dos tocados alineados, sigue la línea por uno de los extremos', () => {
    for (let semilla = 0; semilla < 20; semilla += 1) {
      const casilla = elegirDisparo([tocado('E5'), tocado('E6')], azarFijo(semilla));
      assert.ok(['E4', 'E7'].includes(casilla), casilla);
    }
  });

  it('si un extremo ya es agua, remata por el otro', () => {
    const casilla = elegirDisparo([tocado('E5'), tocado('E6'), agua('E7')], azarFijo(9));
    assert.equal(casilla, 'E4');
  });

  it('no dispara alrededor de un barco hundido: por la regla de no tocarse es agua', () => {
    const hechos = [tocado('A1'), { casilla: 'A2', resultado: 'hundido', barco: 'destructor' }];
    const alrededor = ['A3', 'B1', 'B2', 'B3'];
    for (let semilla = 0; semilla < 50; semilla += 1) {
      assert.ok(!alrededor.includes(elegirDisparo(hechos, azarFijo(semilla))));
    }
  });
});

describe('Jugador máquina: colocación y turno', () => {
  it('su colocación cumple las reglas y es reproducible con azar fijo', () => {
    const flota = elegirColocacion(azarFijo(11));
    assert.deepEqual(flota, elegirColocacion(azarFijo(11)));
    assert.deepEqual(flota.map((b) => b.barco), motor.FLOTA.map((b) => b.barco));
  });

  it('no ve la flota del rival: con dos flotas distintas elige el mismo primer disparo', () => {
    const conFlotaFija = turnoDeLaMaquina();
    let otra = motor.colocarFlotaAleatoria(motor.crearPartida(), 0, azarFijo(5));
    otra = colocarFlotaFija(otra, 1);
    otra = motor.disparar(otra, 0, 'J10').partida;
    const primero = (partida) => jugarTurno(partida, 1, azarFijo(42)).disparos[0].casilla;
    assert.equal(primero(conFlotaFija), primero(otra));
  });

  it('dispara mientras acierta y, tras un agua, el turno vuelve al jugador', () => {
    const { partida, disparos: hechos } = jugarTurno(turnoDeLaMaquina(), 1, azarFijo(2));
    assert.ok(hechos.length >= 1);
    assert.equal(hechos.at(-1).resultado, 'agua');
    assert.ok(hechos.slice(0, -1).every((d) => d.resultado !== 'agua'));
    assert.equal(partida.turno, 0);
  });

  it('no puede jugar fuera de su turno', () => {
    assert.throws(() => jugarTurno(partidaEnJuego(), 1, azarFijo(1)), esError(CODIGOS.ESTADO_INVALIDO, 'No es tu turno'));
  });

  it('jugando sola contra una flota termina la partida sin repetir casilla', () => {
    // El jugador 0 dispara siempre a casillas ya sin interés; la máquina juega.
    let partida = turnoDeLaMaquina();
    const azar = azarFijo(2026);
    const todos = [];
    while (partida.estado === motor.ESTADOS.EN_JUEGO) {
      if (partida.turno === 1) {
        const turno = jugarTurno(partida, 1, azar);
        partida = turno.partida;
        todos.push(...turno.disparos.map((d) => d.casilla));
      } else {
        partida = disparos(partida, 0, [motor.casillasSinDisparar(partida, 0).at(-1)]);
      }
    }
    assert.equal(new Set(todos).size, todos.length);
    assert.equal(partida.ganador, 1);
    assert.ok(todos.length < 100);
  });
});
