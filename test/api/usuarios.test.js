// Pruebas de la API de usuarios: peticiones HTTP reales contra la app con los
// repositorios en memoria. El solicitante se identifica con la cookie de
// sesión obtenida en POST /api/sesion, como haría el navegador.

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const { arrancar, cookieDe } = require('../ayuda/servidor');
const { montar, CLAVE, CLAVE_ADMIN } = require('../ayuda/montaje');

describe('API /api/usuarios', () => {
  let servidor;
  let ctx;
  let admin;
  let cookieAdmin;

  async function iniciarSesion(email, contrasena = CLAVE) {
    const r = await servidor.peticion('POST', '/api/sesion', { cuerpo: { email, contrasena } });
    assert.equal(r.estado, 200);
    return cookieDe(r.cookies);
  }

  // Crea un usuario activo y devuelve { usuario, cookie } con su sesión.
  async function conSesion(email) {
    const usuario = await ctx.usuarioActivo(email);
    return { usuario, cookie: await iniciarSesion(email) };
  }

  beforeEach(async () => {
    ctx = montar();
    admin = await ctx.servicioUsuarios.asegurarAdministrador({ email: 'admin@ejemplo.com', contrasena: CLAVE_ADMIN });
    servidor = await arrancar(ctx.app);
    cookieAdmin = await iniciarSesion('admin@ejemplo.com', CLAVE_ADMIN);
  });

  afterEach(async () => { await servidor.cerrar(); });

  describe('POST /api/usuarios', () => {
    it('201 y el usuario creado en estado pendiente, sin datos sensibles', async () => {
      const r = await servidor.peticion('POST', '/api/usuarios', { cuerpo: { email: 'ana@ejemplo.com', nombre: 'Ana', contrasena: CLAVE } });
      assert.equal(r.estado, 201);
      assert.equal(r.datos.email, 'ana@ejemplo.com');
      assert.equal(r.datos.estado, 'pendiente');
      assert.equal(r.datos.rol, 'usuario');
      assert.equal(r.datos.hashContrasena, undefined);
      assert.equal(r.datos.contrasena, undefined);
    });

    it('409 si el email ya existe', async () => {
      await servidor.peticion('POST', '/api/usuarios', { cuerpo: { email: 'ana@ejemplo.com', contrasena: CLAVE } });
      const r = await servidor.peticion('POST', '/api/usuarios', { cuerpo: { email: 'ana@ejemplo.com', contrasena: CLAVE } });
      assert.equal(r.estado, 409);
      assert.equal(r.datos.codigo, 'EMAIL_DUPLICADO');
    });

    it('400 si el email no es válido', async () => {
      const r = await servidor.peticion('POST', '/api/usuarios', { cuerpo: { email: 'mal', contrasena: CLAVE } });
      assert.equal(r.estado, 400);
      assert.ok(r.datos.error);
    });

    it('400 si la contraseña es demasiado corta', async () => {
      const r = await servidor.peticion('POST', '/api/usuarios', { cuerpo: { email: 'ana@ejemplo.com', contrasena: 'corta' } });
      assert.equal(r.estado, 400);
      assert.equal(r.datos.codigo, 'DATOS_INVALIDOS');
    });

    it('400 si el cuerpo no es JSON válido', async () => {
      const r = await servidor.peticion('POST', '/api/usuarios', { cuerpo: '{no es json' });
      assert.equal(r.estado, 400);
    });
  });

  describe('GET /api/usuarios', () => {
    it('200 con email, rol y estado para el administrador', async () => {
      await ctx.servicioUsuarios.registrarUsuario({ email: 'ana@ejemplo.com', contrasena: CLAVE });
      const r = await servidor.peticion('GET', '/api/usuarios', { cookie: cookieAdmin });
      assert.equal(r.estado, 200);
      assert.equal(r.datos.length, 2);
      for (const u of r.datos) {
        assert.ok(u.email && u.rol && u.estado);
        assert.equal(u.hashContrasena, undefined);
      }
    });

    it('401 sin sesión', async () => {
      const r = await servidor.peticion('GET', '/api/usuarios');
      assert.equal(r.estado, 401);
    });

    it('401 con la antigua cabecera provisional X-Usuario-Id (ya no se acepta)', async () => {
      const r = await servidor.peticion('GET', '/api/usuarios', { cabeceras: { 'X-Usuario-Id': admin.id } });
      assert.equal(r.estado, 401);
    });

    it('403 para un usuario normal con sesión', async () => {
      const { cookie } = await conSesion('ana@ejemplo.com');
      const r = await servidor.peticion('GET', '/api/usuarios', { cookie });
      assert.equal(r.estado, 403);
    });
  });

  describe('GET /api/usuarios/:id/activo', () => {
    it('false para un usuario pendiente y true tras confirmar', async () => {
      const u = await ctx.servicioUsuarios.registrarUsuario({ email: 'ana@ejemplo.com', contrasena: CLAVE });
      let r = await servidor.peticion('GET', `/api/usuarios/${u.id}/activo`, { cookie: cookieAdmin });
      assert.equal(r.estado, 200);
      assert.deepEqual(r.datos, { id: u.id, activo: false });

      await ctx.servicioUsuarios.confirmarCuenta(ctx.tokens.get(u.email));
      r = await servidor.peticion('GET', `/api/usuarios/${u.id}/activo`, { cookie: cookieAdmin });
      assert.equal(r.datos.activo, true);
    });

    it('404 si el usuario no existe', async () => {
      const r = await servidor.peticion('GET', '/api/usuarios/no-existe/activo', { cookie: cookieAdmin });
      assert.equal(r.estado, 404);
    });

    it('401 sin sesión y 403 para un usuario normal', async () => {
      const { usuario, cookie } = await conSesion('ana@ejemplo.com');
      assert.equal((await servidor.peticion('GET', `/api/usuarios/${usuario.id}/activo`)).estado, 401);
      assert.equal((await servidor.peticion('GET', `/api/usuarios/${usuario.id}/activo`, { cookie })).estado, 403);
    });
  });

  describe('DELETE /api/usuarios/:id', () => {
    it('204 cuando el administrador elimina a un usuario', async () => {
      const ana = await ctx.usuarioActivo('ana@ejemplo.com');
      const r = await servidor.peticion('DELETE', `/api/usuarios/${ana.id}`, { cookie: cookieAdmin });
      assert.equal(r.estado, 204);
      assert.equal(await ctx.servicioUsuarios.estaActivo(admin.id, ana.id), false);
    });

    it('204 cuando un usuario elimina su propia cuenta', async () => {
      const { usuario, cookie } = await conSesion('ana@ejemplo.com');
      const r = await servidor.peticion('DELETE', `/api/usuarios/${usuario.id}`, { cookie });
      assert.equal(r.estado, 204);
    });

    it('403 cuando un usuario normal intenta eliminar a otro', async () => {
      const { cookie } = await conSesion('ana@ejemplo.com');
      const luis = await ctx.usuarioActivo('luis@ejemplo.com');
      const r = await servidor.peticion('DELETE', `/api/usuarios/${luis.id}`, { cookie });
      assert.equal(r.estado, 403);
      assert.equal(await ctx.servicioUsuarios.estaActivo(admin.id, luis.id), true);
    });

    it('401 sin sesión', async () => {
      const ana = await ctx.usuarioActivo('ana@ejemplo.com');
      const r = await servidor.peticion('DELETE', `/api/usuarios/${ana.id}`);
      assert.equal(r.estado, 401);
    });
  });
});
