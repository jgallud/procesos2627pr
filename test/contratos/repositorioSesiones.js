// Batería de pruebas del CONTRATO del repositorio de sesiones.
// Se ejecuta contra cada implementación (memoria y MongoDB).

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');

function probarContratoSesiones(nombre, { crear, limpiar = async () => {} }) {
  describe(`Contrato del repositorio de sesiones: ${nombre}`, () => {
    let repo;
    const sesion = (id, idUsuario, expiraEn = '2030-01-01T00:00:00.000Z') =>
      ({ id, idUsuario, creadaEn: '2026-01-01T00:00:00.000Z', expiraEn });

    beforeEach(async () => { repo = await crear(); });
    afterEach(async () => { await limpiar(); });

    it('guarda y busca una sesión por id', async () => {
      assert.deepEqual(await repo.crear(sesion('s1', 'u1')), sesion('s1', 'u1'));
      assert.deepEqual(await repo.buscarPorId('s1'), sesion('s1', 'u1'));
      assert.equal(await repo.buscarPorId('no-existe'), null);
    });

    it('rechaza una sesión sin id o sin usuario', async () => {
      await assert.rejects(() => repo.crear({ id: 's1' }));
      await assert.rejects(() => repo.crear({ idUsuario: 'u1' }));
    });

    it('elimina una sesión', async () => {
      await repo.crear(sesion('s1', 'u1'));
      assert.equal(await repo.eliminar('s1'), true);
      assert.equal(await repo.buscarPorId('s1'), null);
      assert.equal(await repo.eliminar('s1'), false);
    });

    it('elimina todas las sesiones de un usuario y solo las suyas', async () => {
      await repo.crear(sesion('s1', 'u1'));
      await repo.crear(sesion('s2', 'u1'));
      await repo.crear(sesion('s3', 'u2'));
      assert.equal(await repo.eliminarDeUsuario('u1'), 2);
      assert.equal(await repo.buscarPorId('s1'), null);
      assert.ok(await repo.buscarPorId('s3'));
    });

    it('elimina las sesiones caducadas', async () => {
      await repo.crear(sesion('vieja', 'u1', '2026-01-01T00:00:00.000Z'));
      await repo.crear(sesion('vigente', 'u1', '2030-01-01T00:00:00.000Z'));
      assert.equal(await repo.eliminarCaducadas(new Date('2027-01-01T00:00:00.000Z')), 1);
      assert.equal(await repo.buscarPorId('vieja'), null);
      assert.ok(await repo.buscarPorId('vigente'));
    });

    it('devuelve copias: modificar el resultado no altera lo almacenado', async () => {
      await repo.crear(sesion('s1', 'u1'));
      const leida = await repo.buscarPorId('s1');
      leida.idUsuario = 'otro';
      assert.equal((await repo.buscarPorId('s1')).idUsuario, 'u1');
    });
  });
}

module.exports = { probarContratoSesiones };
