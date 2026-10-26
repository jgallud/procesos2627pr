// Pruebas de integración del inicio de sesión con OAuth (RF-04). Se usa un
// proveedor falso en lugar de Google: devuelve los datos de usuario asociados
// a cada código, como haría Google tras aceptar el usuario.

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const { arrancar, cookieDe } = require('../ayuda/servidor');
const { montar } = require('../ayuda/montaje');

function crearProveedorFalso() {
  const usuariosPorCodigo = new Map([
    ['codigo-ana', { email: 'ana@gmail.com', nombre: 'Ana', emailVerificado: true }],
    ['codigo-local', { email: 'local@ejemplo.com', nombre: 'Local', emailVerificado: true }],
  ]);
  return {
    urlAutorizacion: (state) => `https://proveedor.test/autorizar?state=${state}`,
    async obtenerUsuario(codigo) {
      if (!usuariosPorCodigo.has(codigo)) throw new Error('código no válido');
      return usuariosPorCodigo.get(codigo);
    },
  };
}

describe('API /api/oauth', () => {
  let servidor;
  let ctx;

  beforeEach(async () => {
    ctx = montar({ proveedoresOAuth: { google: crearProveedorFalso() } });
    servidor = await arrancar(ctx.app);
  });

  afterEach(async () => { await servidor.cerrar(); });

  // Paso 1 del flujo: ir al proveedor. Devuelve el state y su cookie.
  async function irAlProveedor() {
    const r = await servidor.peticion('GET', '/api/oauth/google');
    const state = new URL(r.cabeceras.get('location')).searchParams.get('state');
    return { r, state, cookieState: cookieDe(r.cookies, 'oauth_state') };
  }

  const volverDelProveedor = (consulta, cookie) =>
    servidor.peticion('GET', `/api/oauth/google/retorno?${new URLSearchParams(consulta)}`, { cookie });

  it('lista los proveedores configurados', async () => {
    const r = await servidor.peticion('GET', '/api/oauth/proveedores');
    assert.equal(r.estado, 200);
    assert.deepEqual(r.datos, { proveedores: ['google'] });
  });

  it('sin proveedores configurados, la lista está vacía y la ruta da 404', async () => {
    const sinOAuth = await arrancar(montar().app);
    try {
      assert.deepEqual((await sinOAuth.peticion('GET', '/api/oauth/proveedores')).datos, { proveedores: [] });
      assert.equal((await sinOAuth.peticion('GET', '/api/oauth/google')).estado, 404);
    } finally {
      await sinOAuth.cerrar();
    }
  });

  it('redirige al proveedor con un state aleatorio guardado en una cookie HttpOnly', async () => {
    const { r, state, cookieState } = await irAlProveedor();
    assert.equal(r.estado, 302);
    assert.match(r.cabeceras.get('location'), /^https:\/\/proveedor\.test\/autorizar\?/);
    assert.ok(state && state.length >= 32);
    assert.equal(cookieState, `oauth_state=${state}`);
    const linea = r.cookies.find((c) => c.startsWith('oauth_state='));
    assert.match(linea, /HttpOnly/);
    assert.match(linea, /SameSite=Lax/);
  });

  it('a la vuelta, con el state correcto, abre sesión y redirige a la página principal', async () => {
    const { state, cookieState } = await irAlProveedor();
    const r = await volverDelProveedor({ code: 'codigo-ana', state }, cookieState);

    assert.equal(r.estado, 302);
    assert.equal(r.cabeceras.get('location'), '/');
    const sesion = cookieDe(r.cookies, 'sesion');
    assert.ok(sesion, 'debe enviar la cookie de sesión');
    assert.ok(r.cookies.some((c) => c.startsWith('oauth_state=;') && /Max-Age=0/.test(c)), 'borra la cookie del state');

    const yo = await servidor.peticion('GET', '/api/sesion', { cookie: sesion });
    assert.equal(yo.estado, 200);
    assert.equal(yo.datos.email, 'ana@gmail.com');
    assert.equal(yo.datos.origen, 'oauth');
    assert.equal(yo.datos.estado, 'activo');
  });

  it('sin la cookie del state no se abre sesión', async () => {
    const { state } = await irAlProveedor();
    const r = await volverDelProveedor({ code: 'codigo-ana', state });
    assert.equal(r.estado, 302);
    assert.equal(r.cabeceras.get('location'), '/?error_oauth=OAUTH_FALLIDO');
    assert.equal(cookieDe(r.cookies, 'sesion'), undefined);
  });

  it('con un state distinto del guardado no se abre sesión', async () => {
    const { cookieState } = await irAlProveedor();
    const r = await volverDelProveedor({ code: 'codigo-ana', state: 'otro-state' }, cookieState);
    assert.equal(r.cabeceras.get('location'), '/?error_oauth=OAUTH_FALLIDO');
    assert.equal(cookieDe(r.cookies, 'sesion'), undefined);
  });

  it('si el email ya tiene cuenta local, vuelve con el error CUENTA_LOCAL', async () => {
    await ctx.usuarioActivo('local@ejemplo.com');
    const { state, cookieState } = await irAlProveedor();
    const r = await volverDelProveedor({ code: 'codigo-local', state }, cookieState);
    assert.equal(r.cabeceras.get('location'), '/?error_oauth=CUENTA_LOCAL');
    assert.equal(cookieDe(r.cookies, 'sesion'), undefined);
  });

  it('si el usuario cancela en el proveedor, vuelve con OAUTH_CANCELADO', async () => {
    const { state, cookieState } = await irAlProveedor();
    const r = await volverDelProveedor({ error: 'access_denied', state }, cookieState);
    assert.equal(r.cabeceras.get('location'), '/?error_oauth=OAUTH_CANCELADO');
  });

  it('si el proveedor falla, vuelve con OAUTH_FALLIDO', async () => {
    const { state, cookieState } = await irAlProveedor();
    const r = await volverDelProveedor({ code: 'codigo-inexistente', state }, cookieState);
    assert.equal(r.cabeceras.get('location'), '/?error_oauth=OAUTH_FALLIDO');
  });
});
