// Pruebas unitarias del cálculo de historial y estadísticas (RF-18, RF-19).
// Funciones puras: se prueban con partidas escritas a mano, sin servicio,
// sin HTTP y sin base de datos.

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { cuenta, resumenDe, historialDe, estadisticasDe } = require('../../server/logic/estadisticas');

const disparos = (...resultados) => resultados.map((resultado, i) => ({ casilla: `A${i + 1}`, resultado }));

// Partida guardada de prueba: `ana` es el jugador 0 y su rival la máquina.
function partida({
  id = 'p1', estado = 'terminada', ganador = 0, motivoFin = 'flota_hundida', deAna = [], deMaquina = [],
  terminadaEn = '2026-11-10T10:00:00.000Z', anulada,
} = {}) {
  return {
    id,
    modo: 'maquina',
    jugadores: ['ana', null],
    enCurso: estado !== 'terminada',
    creadaEn: '2026-11-10T09:00:00.000Z',
    actualizadaEn: terminadaEn,
    terminadaEn,
    ...(anulada ? { anulada } : {}),
    juego: {
      estado,
      turno: 0,
      ganador: estado === 'terminada' ? ganador : null,
      motivoFin: estado === 'terminada' ? motivoFin : null,
      jugadores: [
        { flota: [], disparosRecibidos: deMaquina },
        { flota: [], disparosRecibidos: deAna },
      ],
    },
  };
}

describe('Historial y estadísticas', () => {
  it('solo cuentan las partidas terminadas y no anuladas', () => {
    assert.equal(cuenta(partida()), true);
    assert.equal(cuenta(partida({ estado: 'en_juego' })), false);
    assert.equal(cuenta(partida({ anulada: true })), false);
  });

  it('el resumen cuenta los disparos propios, no los del rival', () => {
    const resumen = resumenDe(partida({ deAna: disparos('agua', 'tocado', 'hundido', 'agua'), deMaquina: disparos('agua') }), 'ana');
    assert.deepEqual(resumen, {
      id: 'p1',
      fecha: '2026-11-10T10:00:00.000Z',
      modo: 'maquina',
      oponente: 'maquina',
      idOponente: null,
      resultado: 'victoria',
      motivoFin: 'flota_hundida',
      disparos: 4,
      aciertos: 2,
      porcentajeAcierto: 50,
    });
  });

  it('una partida perdida o abandonada es una derrota', () => {
    assert.equal(resumenDe(partida({ ganador: 1 }), 'ana').resultado, 'derrota');
    const abandono = resumenDe(partida({ ganador: 1, motivoFin: 'abandono' }), 'ana');
    assert.equal(abandono.resultado, 'derrota');
    assert.equal(abandono.motivoFin, 'abandono');
  });

  it('una partida anterior al Hito 6 usa actualizadaEn como fecha', () => {
    const antigua = partida();
    delete antigua.terminadaEn;
    assert.equal(resumenDe(antigua, 'ana').fecha, antigua.actualizadaEn);
  });

  it('el historial excluye partidas de otros, en curso o anuladas y ordena de más reciente a más antigua', () => {
    const otra = { ...partida({ id: 'otra' }), jugadores: ['luis', null] };
    const lista = [
      partida({ id: 'vieja', terminadaEn: '2026-11-01T10:00:00.000Z' }),
      partida({ id: 'nueva', terminadaEn: '2026-11-09T10:00:00.000Z' }),
      partida({ id: 'en-curso', estado: 'en_juego' }),
      partida({ id: 'anulada', anulada: true }),
      otra,
    ];
    assert.deepEqual(historialDe(lista, 'ana').map((h) => h.id), ['nueva', 'vieja']);
  });

  it('el acierto global pondera por disparos, no promedia porcentajes', () => {
    const historial = historialDe([
      partida({ id: 'a', deAna: disparos('tocado') }), // 1 de 1
      partida({ id: 'b', ganador: 1, deAna: disparos('agua', 'agua', 'agua', 'tocado') }), // 1 de 4
    ], 'ana');
    assert.deepEqual(estadisticasDe(historial), {
      jugadas: 2, ganadas: 1, perdidas: 1, porcentajeVictorias: 50, disparos: 5, aciertos: 2, porcentajeAcierto: 40,
    });
  });

  it('sin partidas, los porcentajes son null y no cero', () => {
    const vacias = estadisticasDe([]);
    assert.equal(vacias.porcentajeVictorias, null);
    assert.equal(vacias.porcentajeAcierto, null);
  });
});
