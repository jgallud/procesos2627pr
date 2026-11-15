// Pruebas de integración de la recuperación de contraseña (MJ-12).

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const { arrancar, cookieDe } = require('../ayuda/servidor');
const { montar, CLAVE } = require('../ayuda/montaje');

const NUEVA = 'contrasena-nueva-123';

describe('API /api/usuarios/restablecimiento (MJ-12)', () => {
  let servidor;
  let ctx;

  beforeEach(async () => {
    ctx = montar();
    servidor = await arrancar(ctx.app);
    await ctx.usuarioActivo('ana@ejemplo.com');
  });
  afterEach(() => servidor.cerrar());

  const pedirEnlace = (email) => servidor.peticion('POST', '/api/usuarios/restablecimiento/solicitud', { cuerpo: { email } });

  it('responde lo mismo exista o no la cuenta, y solo envía el enlace si existe', async () => {
    const existe = await pedirEnlace('ana@ejemplo.com');
    const noExiste = await pedirEnlace('nadie@ejemplo.com');
    assert.equal(existe.estado, 202);
    assert.equal(noExiste.estado, 202);
    assert.deepEqual(existe.datos, noExiste.datos);
    assert.deepEqual([...ctx.enlacesRestablecimiento.keys()], ['ana@ejemplo.com']);
  });

  it('con el enlace se cambia la contraseña y se cierran las sesiones abiertas', async () => {
    const login = await servidor.peticion('POST', '/api/sesion', { cuerpo: { email: 'ana@ejemplo.com', contrasena: CLAVE } });
    const cookie = cookieDe(login.cookies);
    await pedirEnlace('ana@ejemplo.com');
    const token = ctx.enlacesRestablecimiento.get('ana@ejemplo.com');

    const r = await servidor.peticion('POST', '/api/usuarios/restablecimiento', { cuerpo: { token, contrasena: NUEVA } });
    assert.equal(r.estado, 200);
    assert.equal(r.datos.email, 'ana@ejemplo.com');
    assert.equal((await servidor.peticion('GET', '/api/sesion', { cookie })).estado, 401, 'la sesión anterior ya no vale');
    const nuevo = await servidor.peticion('POST', '/api/sesion', { cuerpo: { email: 'ana@ejemplo.com', contrasena: NUEVA } });
    assert.equal(nuevo.estado, 200);
  });

  it('400 con un enlace ya usado o una contraseña corta', async () => {
    await pedirEnlace('ana@ejemplo.com');
    const token = ctx.enlacesRestablecimiento.get('ana@ejemplo.com');
    const corta = await servidor.peticion('POST', '/api/usuarios/restablecimiento', { cuerpo: { token, contrasena: 'corta' } });
    assert.equal(corta.estado, 400);
    await servidor.peticion('POST', '/api/usuarios/restablecimiento', { cuerpo: { token, contrasena: NUEVA } });
    const repetido = await servidor.peticion('POST', '/api/usuarios/restablecimiento', { cuerpo: { token, contrasena: NUEVA } });
    assert.equal(repetido.estado, 400);
    assert.equal(repetido.datos.codigo, 'TOKEN_INVALIDO');
  });
});
