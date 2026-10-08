// Pruebas unitarias del ciclo de vida de las sesiones (sin HTTP).

const { describe, it, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const { crearServicioSesiones } = require('../../server/logic/sesionService');
const { crearRepositorioSesionesMemoria } = require('../../server/data/sesionRepositorioMemoria');

describe('Servicio de sesiones', () => {
  let ahora;
  let sesiones;
  const HORA = 60 * 60 * 1000;

  beforeEach(() => {
    ahora = new Date('2026-10-01T10:00:00.000Z');
    sesiones = crearServicioSesiones({
      repositorio: crearRepositorioSesionesMemoria(),
      duracionMs: HORA,
      reloj: () => ahora,
    });
  });

  it('abre una sesión con un identificador aleatorio largo y la resuelve al usuario', async () => {
    const s = await sesiones.abrir('u1');
    assert.ok(s.id.length >= 40);
    assert.equal(await sesiones.resolver(s.id), 'u1');
  });

  it('cada sesión tiene un identificador distinto', async () => {
    const a = await sesiones.abrir('u1');
    const b = await sesiones.abrir('u1');
    assert.notEqual(a.id, b.id);
  });

  it('una sesión cerrada deja de resolverse', async () => {
    const s = await sesiones.abrir('u1');
    assert.equal(await sesiones.cerrar(s.id), true);
    assert.equal(await sesiones.resolver(s.id), undefined);
  });

  it('una sesión caducada deja de resolverse', async () => {
    const s = await sesiones.abrir('u1');
    ahora = new Date(ahora.getTime() + HORA + 1);
    assert.equal(await sesiones.resolver(s.id), undefined);
  });

  it('cerrarTodas invalida todas las sesiones del usuario', async () => {
    const a = await sesiones.abrir('u1');
    const b = await sesiones.abrir('u1');
    const c = await sesiones.abrir('u2');
    assert.equal(await sesiones.cerrarTodas('u1'), 2);
    assert.equal(await sesiones.resolver(a.id), undefined);
    assert.equal(await sesiones.resolver(b.id), undefined);
    assert.equal(await sesiones.resolver(c.id), 'u2');
  });

  it('identificadores ausentes o inválidos no resuelven a nadie', async () => {
    assert.equal(await sesiones.resolver(undefined), undefined);
    assert.equal(await sesiones.resolver(''), undefined);
    assert.equal(await sesiones.resolver('inventado'), undefined);
    assert.equal(await sesiones.cerrar(undefined), false);
  });
});
