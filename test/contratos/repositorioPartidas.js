// Batería de pruebas del CONTRATO del repositorio de partidas.
// Se ejecuta contra cada implementación (memoria en el Hito 5; MongoDB en el
// Hito 6, que deberá pasar exactamente estas mismas pruebas).

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');

function probarContratoPartidas(nombre, { crear, limpiar = async () => {} }) {
  describe(`Contrato del repositorio de partidas: ${nombre}`, () => {
    let repo;
    const juego = { estado: 'colocando', turno: 0, jugadores: [{ flota: [] }, { flota: [] }] };
    const datos = (idUsuario, creadaEn = '2026-11-01T10:00:00.000Z', extra = {}) => ({
      modo: 'maquina', jugadores: [idUsuario, null], enCurso: true, creadaEn, actualizadaEn: creadaEn, juego, ...extra,
    });

    beforeEach(async () => { repo = await crear(); });
    afterEach(async () => { await limpiar(); });

    it('guarda una partida con un id nuevo y la busca por id', async () => {
      const guardada = await repo.crear(datos('u1'));
      assert.ok(guardada.id);
      assert.deepEqual(guardada, { ...datos('u1'), id: guardada.id });
      assert.deepEqual(await repo.buscarPorId(guardada.id), guardada);
      assert.equal(await repo.buscarPorId('no-existe'), null);
    });

    it('cada partida recibe un id distinto', async () => {
      const a = await repo.crear(datos('u1'));
      const b = await repo.crear(datos('u1'));
      assert.notEqual(a.id, b.id);
    });

    it('rechaza una partida sin jugadores o sin juego', async () => {
      await assert.rejects(() => repo.crear({ juego }));
      await assert.rejects(() => repo.crear({ jugadores: ['u1', null] }));
    });

    it('actualiza solo los campos indicados y no permite cambiar el id', async () => {
      const p = await repo.crear(datos('u1'));
      const nuevoJuego = { ...juego, estado: 'en_juego' };
      const act = await repo.actualizar(p.id, { juego: nuevoJuego, actualizadaEn: '2026-11-01T11:00:00.000Z', id: 'otro' });
      assert.equal(act.id, p.id);
      assert.deepEqual(act.juego, nuevoJuego);
      assert.equal(act.creadaEn, p.creadaEn);
      assert.deepEqual(await repo.buscarPorId(p.id), act);
      assert.equal(await repo.actualizar('no-existe', { enCurso: false }), null);
    });

    it('devuelve copias: cambiar lo devuelto no cambia lo guardado', async () => {
      const p = await repo.crear(datos('u1'));
      p.juego.estado = 'terminada';
      assert.equal((await repo.buscarPorId(p.id)).juego.estado, 'colocando');
    });

    it('busca la partida en curso más reciente de un usuario, y solo si está en curso', async () => {
      assert.equal(await repo.buscarEnCursoDe('u1'), null);
      const antigua = await repo.crear(datos('u1', '2026-11-01T10:00:00.000Z'));
      const reciente = await repo.crear(datos('u1', '2026-11-02T10:00:00.000Z'));
      await repo.crear(datos('u2', '2026-11-03T10:00:00.000Z'));
      assert.equal((await repo.buscarEnCursoDe('u1')).id, reciente.id);

      await repo.actualizar(reciente.id, { enCurso: false });
      assert.equal((await repo.buscarEnCursoDe('u1')).id, antigua.id);
      await repo.actualizar(antigua.id, { enCurso: false });
      assert.equal(await repo.buscarEnCursoDe('u1'), null);
    });
  });
}

module.exports = { probarContratoPartidas };
