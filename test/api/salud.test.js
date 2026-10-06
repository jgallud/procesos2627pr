const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { crearApp } = require('../../server/app');
const { arrancar } = require('../ayuda/servidor');

describe('Esqueleto del servidor', () => {
  let servidor;

  before(async () => { servidor = await arrancar(crearApp()); });
  after(async () => { await servidor.cerrar(); });

  it('GET /api/salud responde 200 con estado ok', async () => {
    const r = await servidor.peticion('GET', '/api/salud');
    assert.equal(r.estado, 200);
    assert.deepEqual(r.datos, { estado: 'ok' });
  });

  it('sirve el frontend desde el mismo origen', async () => {
    const r = await servidor.peticion('GET', '/');
    assert.equal(r.estado, 200);
    assert.match(r.cabeceras.get('content-type'), /text\/html/);
  });

  it('una ruta inexistente de la API responde 404 en JSON', async () => {
    const r = await servidor.peticion('GET', '/api/no-existe');
    assert.equal(r.estado, 404);
    assert.ok(r.datos.error);
  });
});
