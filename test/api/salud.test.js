const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { arrancar } = require('../ayuda/servidor');
const { montar } = require('../ayuda/montaje');

describe('Esqueleto del servidor', () => {
  let servidor;

  before(async () => {
    servidor = await arrancar(montar().app);
  });
  after(async () => { await servidor.cerrar(); });

  it('GET /api/salud incluye la versión y la revisión (MJ-17)', async () => {
    const { crearApp } = require('../../server/app');
    const ctx = require('../ayuda/montaje').montar();
    const app = crearApp({
      servicioUsuarios: ctx.servicioUsuarios, servicioSesiones: ctx.servicioSesiones,
      infoVersion: { version: '9.8.7', revision: 'procesos2627pr-00042-abc' },
    });
    const otro = await require('../ayuda/servidor').arrancar(app);
    const r = await otro.peticion('GET', '/api/salud');
    await otro.cerrar();
    assert.deepEqual(r.datos, { estado: 'ok', version: '9.8.7', revision: 'procesos2627pr-00042-abc' });
  });

  it('GET /api/salud responde 200 con estado ok', async () => {
    const r = await servidor.peticion('GET', '/api/salud');
    assert.equal(r.estado, 200);
    assert.equal(r.datos.estado, 'ok');
  });

  it('sirve el frontend desde el mismo origen', async () => {
    const r = await servidor.peticion('GET', '/');
    assert.equal(r.estado, 200);
    assert.match(r.cabeceras.get('content-type'), /text\/html/);
  });

  it('sirve la capa de comunicación del cliente', async () => {
    const r = await servidor.peticion('GET', '/js/api.js');
    assert.equal(r.estado, 200);
    assert.match(r.cabeceras.get('content-type'), /javascript/);
  });

  it('una ruta inexistente de la API responde 404 en JSON', async () => {
    const r = await servidor.peticion('GET', '/api/no-existe');
    assert.equal(r.estado, 404);
    assert.ok(r.datos.error);
  });
});
