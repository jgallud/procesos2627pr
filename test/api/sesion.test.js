// Pruebas de integración de la sesión: inicio y cierre de sesión con cookie,
// mantenimiento entre peticiones (lo que ocurre al recargar la página) y
// rechazo de peticiones sin sesión válida.

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const { arrancar, cookieDe } = require('../ayuda/servidor');
const { montar, CLAVE, CLAVE_ADMIN } = require('../ayuda/montaje');

describe('API /api/sesion', () => {
  let servidor;
  let ctx;

  const entrar = (email, contrasena = CLAVE) =>
    servidor.peticion('POST', '/api/sesion', { cuerpo: { email, contrasena } });

  beforeEach(async () => {
    ctx = montar();
    await ctx.servicioUsuarios.asegurarAdministrador({ email: 'admin@ejemplo.com', contrasena: CLAVE_ADMIN });
    servidor = await arrancar(ctx.app);
  });

  afterEach(async () => { await servidor.cerrar(); });

  describe('flujo completo desde la API', () => {
    it('registro -> confirmación -> inicio de sesión', async () => {
      let r = await servidor.peticion('POST', '/api/usuarios', { cuerpo: { email: 'ana@ejemplo.com', contrasena: CLAVE } });
      assert.equal(r.estado, 201);

      r = await entrar('ana@ejemplo.com');
      assert.equal(r.estado, 403);
      assert.equal(r.datos.codigo, 'CUENTA_PENDIENTE');

      r = await servidor.peticion('POST', '/api/usuarios/confirmacion', { cuerpo: { token: ctx.tokens.get('ana@ejemplo.com') } });
      assert.equal(r.estado, 200);
      assert.equal(r.datos.estado, 'activo');

      r = await entrar('ana@ejemplo.com');
      assert.equal(r.estado, 200);
      assert.equal(r.datos.email, 'ana@ejemplo.com');
    });

    it('400 al confirmar con un token no válido', async () => {
      const r = await servidor.peticion('POST', '/api/usuarios/confirmacion', { cuerpo: { token: 'inventado' } });
      assert.equal(r.estado, 400);
      assert.equal(r.datos.codigo, 'TOKEN_INVALIDO');
    });
  });

  describe('POST /api/sesion', () => {
    it('200 con el usuario y una cookie de sesión HttpOnly y SameSite', async () => {
      await ctx.usuarioActivo('ana@ejemplo.com');
      const r = await entrar('ana@ejemplo.com');
      assert.equal(r.estado, 200);
      assert.equal(r.datos.email, 'ana@ejemplo.com');
      assert.equal(r.datos.hashContrasena, undefined);

      const linea = r.cookies.find((c) => c.startsWith('sesion='));
      assert.ok(linea, 'debe enviar la cookie de sesión');
      assert.match(linea, /HttpOnly/);
      assert.match(linea, /SameSite=Lax/);
      assert.match(linea, /Max-Age=\d+/);
      assert.doesNotMatch(linea, /Secure/);
    });

    it('en producción la cookie lleva el atributo Secure', async () => {
      await servidor.cerrar();
      ctx = montar({ cookieSegura: true });
      await ctx.usuarioActivo('ana@ejemplo.com');
      servidor = await arrancar(ctx.app);
      const r = await entrar('ana@ejemplo.com');
      assert.match(r.cookies.find((c) => c.startsWith('sesion=')), /Secure/);
    });

    it('401 con contraseña incorrecta y sin cookie', async () => {
      await ctx.usuarioActivo('ana@ejemplo.com');
      const r = await entrar('ana@ejemplo.com', 'incorrecta');
      assert.equal(r.estado, 401);
      assert.equal(r.datos.codigo, 'CREDENCIALES_INVALIDAS');
      assert.equal(cookieDe(r.cookies), undefined);
    });

    it('403 para una cuenta eliminada', async () => {
      const ana = await ctx.usuarioActivo('ana@ejemplo.com');
      await ctx.servicioUsuarios.eliminarUsuario(ana.id, ana.id);
      const r = await entrar('ana@ejemplo.com');
      assert.equal(r.estado, 403);
      assert.equal(r.datos.codigo, 'CUENTA_ELIMINADA');
    });

    it('400 si faltan datos', async () => {
      const r = await servidor.peticion('POST', '/api/sesion', { cuerpo: {} });
      assert.equal(r.estado, 400);
    });

    it('cada inicio de sesión genera un identificador nuevo e invalida el anterior', async () => {
      await ctx.usuarioActivo('ana@ejemplo.com');
      const primera = cookieDe((await entrar('ana@ejemplo.com')).cookies);
      const r = await servidor.peticion('POST', '/api/sesion', { cuerpo: { email: 'ana@ejemplo.com', contrasena: CLAVE }, cookie: primera });
      const segunda = cookieDe(r.cookies);
      assert.notEqual(primera, segunda);
      assert.equal((await servidor.peticion('GET', '/api/sesion', { cookie: primera })).estado, 401);
      assert.equal((await servidor.peticion('GET', '/api/sesion', { cookie: segunda })).estado, 200);
    });
  });

  describe('GET /api/sesion (mantenimiento entre recargas)', () => {
    it('200 con el usuario mientras la cookie sea válida', async () => {
      await ctx.usuarioActivo('ana@ejemplo.com');
      const cookie = cookieDe((await entrar('ana@ejemplo.com')).cookies);
      for (let i = 0; i < 2; i += 1) {
        const r = await servidor.peticion('GET', '/api/sesion', { cookie });
        assert.equal(r.estado, 200);
        assert.equal(r.datos.email, 'ana@ejemplo.com');
      }
    });

    it('401 sin cookie', async () => {
      const r = await servidor.peticion('GET', '/api/sesion');
      assert.equal(r.estado, 401);
      assert.equal(r.datos.codigo, 'NO_AUTENTICADO');
    });

    it('401 con una cookie inventada, y se pide borrarla', async () => {
      const r = await servidor.peticion('GET', '/api/sesion', { cookie: 'sesion=inventada' });
      assert.equal(r.estado, 401);
      assert.match(r.cookies.find((c) => c.startsWith('sesion=')), /Max-Age=0/);
    });
  });

  describe('DELETE /api/sesion (cierre de sesión)', () => {
    it('204, borra la cookie y la sesión deja de valer aunque se reutilice', async () => {
      await ctx.usuarioActivo('ana@ejemplo.com');
      const cookie = cookieDe((await entrar('ana@ejemplo.com')).cookies);

      const r = await servidor.peticion('DELETE', '/api/sesion', { cookie });
      assert.equal(r.estado, 204);
      assert.match(r.cookies.find((c) => c.startsWith('sesion=')), /Max-Age=0/);

      const despues = await servidor.peticion('GET', '/api/sesion', { cookie });
      assert.equal(despues.estado, 401);
    });

    it('204 aunque no hubiera sesión', async () => {
      const r = await servidor.peticion('DELETE', '/api/sesion');
      assert.equal(r.estado, 204);
    });
  });

  describe('eliminación de la cuenta', () => {
    it('al eliminar la propia cuenta se cierra la sesión', async () => {
      const ana = await ctx.usuarioActivo('ana@ejemplo.com');
      const cookie = cookieDe((await entrar('ana@ejemplo.com')).cookies);
      const r = await servidor.peticion('DELETE', `/api/usuarios/${ana.id}`, { cookie });
      assert.equal(r.estado, 204);
      assert.match(r.cookies.find((c) => c.startsWith('sesion=')), /Max-Age=0/);
      assert.equal((await servidor.peticion('GET', '/api/sesion', { cookie })).estado, 401);
    });

    it('si el administrador elimina a un usuario, sus sesiones dejan de valer', async () => {
      const ana = await ctx.usuarioActivo('ana@ejemplo.com');
      const cookieAna = cookieDe((await entrar('ana@ejemplo.com')).cookies);
      const cookieAdmin = cookieDe((await entrar('admin@ejemplo.com', CLAVE_ADMIN)).cookies);

      await servidor.peticion('DELETE', `/api/usuarios/${ana.id}`, { cookie: cookieAdmin });
      assert.equal((await servidor.peticion('GET', '/api/sesion', { cookie: cookieAna })).estado, 401);
      assert.equal((await servidor.peticion('GET', '/api/sesion', { cookie: cookieAdmin })).estado, 200);
    });
  });
});
