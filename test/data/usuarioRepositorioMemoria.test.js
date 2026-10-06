// Pruebas del contrato del repositorio. Cuando exista la implementación con
// MongoDB (Hito 3), estas mismas pruebas servirán para verificarla.

const { describe, it, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const { crearRepositorioUsuariosMemoria } = require('../../server/data/usuarioRepositorioMemoria');

describe('Repositorio de usuarios en memoria', () => {
  let repo;
  beforeEach(() => { repo = crearRepositorioUsuariosMemoria(); });

  it('asigna un id al crear y permite buscar por id y por email', async () => {
    const creado = await repo.crear({ email: 'a@b.com', estado: 'pendiente' });
    assert.ok(creado.id);
    assert.deepEqual(await repo.buscarPorId(creado.id), creado);
    assert.deepEqual(await repo.buscarPorEmail('a@b.com'), creado);
  });

  it('devuelve null si no encuentra el usuario', async () => {
    assert.equal(await repo.buscarPorId('x'), null);
    assert.equal(await repo.buscarPorEmail('x@y.com'), null);
    assert.equal(await repo.actualizar('x', { estado: 'activo' }), null);
  });

  it('actualiza campos sin permitir cambiar el id', async () => {
    const creado = await repo.crear({ email: 'a@b.com', estado: 'pendiente' });
    const actualizado = await repo.actualizar(creado.id, { estado: 'activo', id: 'otro' });
    assert.equal(actualizado.id, creado.id);
    assert.equal(actualizado.estado, 'activo');
  });

  it('devuelve copias: modificar el resultado no altera lo almacenado', async () => {
    const creado = await repo.crear({ email: 'a@b.com', estado: 'pendiente' });
    creado.estado = 'manipulado';
    const lista = await repo.listar();
    lista[0].estado = 'manipulado';
    assert.equal((await repo.buscarPorId(creado.id)).estado, 'pendiente');
  });
});
