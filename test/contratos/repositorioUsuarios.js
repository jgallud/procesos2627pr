// Batería de pruebas del CONTRATO del repositorio de usuarios.
// Se ejecuta contra cada implementación (memoria y MongoDB): si ambas la
// superan, la capa lógica puede usar cualquiera de las dos sin cambiar.
//
//   probarContratoUsuarios(nombre, { crear, limpiar? })
//     crear():   devuelve (o promete) un repositorio vacío
//     limpiar(): opcional, se llama tras cada prueba

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');

function probarContratoUsuarios(nombre, { crear, limpiar = async () => {} }) {
  describe(`Contrato del repositorio de usuarios: ${nombre}`, () => {
    let repo;
    beforeEach(async () => { repo = await crear(); });
    afterEach(async () => { await limpiar(); });

    it('asigna un id al crear y permite buscar por id y por email', async () => {
      const creado = await repo.crear({ email: 'a@b.com', estado: 'pendiente' });
      assert.ok(creado.id);
      assert.deepEqual(await repo.buscarPorId(creado.id), creado);
      assert.deepEqual(await repo.buscarPorEmail('a@b.com'), creado);
    });

    it('ignora un id que venga en los datos al crear', async () => {
      const creado = await repo.crear({ id: 'impuesto', email: 'a@b.com' });
      assert.notEqual(creado.id, 'impuesto');
    });

    it('devuelve null si no encuentra el usuario', async () => {
      assert.equal(await repo.buscarPorId('x'), null);
      assert.equal(await repo.buscarPorEmail('x@y.com'), null);
      assert.equal(await repo.actualizar('x', { estado: 'activo' }), null);
    });

    it('lista todos los usuarios', async () => {
      assert.deepEqual(await repo.listar(), []);
      const a = await repo.crear({ email: 'a@b.com' });
      const b = await repo.crear({ email: 'c@d.com' });
      const ids = (await repo.listar()).map((u) => u.id).sort();
      assert.deepEqual(ids, [a.id, b.id].sort());
    });

    it('actualiza campos sin permitir cambiar el id', async () => {
      const creado = await repo.crear({ email: 'a@b.com', estado: 'pendiente', nombre: 'Ana' });
      const actualizado = await repo.actualizar(creado.id, { estado: 'activo', id: 'otro' });
      assert.equal(actualizado.id, creado.id);
      assert.equal(actualizado.estado, 'activo');
      assert.equal(actualizado.nombre, 'Ana');
      assert.deepEqual(await repo.buscarPorId(creado.id), actualizado);
    });

    it('permite guardar null en un campo (p. ej. al consumir el token)', async () => {
      const creado = await repo.crear({ email: 'a@b.com', hashTokenConfirmacion: 'abc' });
      const actualizado = await repo.actualizar(creado.id, { hashTokenConfirmacion: null });
      assert.equal(actualizado.hashTokenConfirmacion, null);
    });

    it('devuelve copias: modificar el resultado no altera lo almacenado', async () => {
      const creado = await repo.crear({ email: 'a@b.com', estado: 'pendiente' });
      creado.estado = 'manipulado';
      const lista = await repo.listar();
      lista[0].estado = 'manipulado';
      assert.equal((await repo.buscarPorId(creado.id)).estado, 'pendiente');
    });
  });
}

module.exports = { probarContratoUsuarios };
