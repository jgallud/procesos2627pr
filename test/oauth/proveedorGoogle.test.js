// Pruebas del proveedor de Google. No se llama a Google: se inyecta un doble
// de fetch que responde según la URL y registra cada petición.

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const {
  crearProveedorGoogle, URL_AUTORIZACION, URL_TOKEN, URL_USUARIO,
} = require('../../server/oauth/proveedorGoogle');

const CONFIG = {
  clientId: 'id-de-cliente.apps.googleusercontent.com',
  clientSecret: 'secreto-de-prueba',
  urlRetorno: 'https://app.ejemplo.com/api/oauth/google/retorno',
};

const json = (cuerpo, status = 200) => ({ ok: status < 400, status, json: async () => cuerpo, text: async () => JSON.stringify(cuerpo) });

function crearFetchDoble({ token = json({ access_token: 'token-acceso' }), usuario = json({ email: 'ana@gmail.com', name: 'Ana', email_verified: true }) } = {}) {
  const llamadas = [];
  const fetch = async (url, opciones = {}) => {
    llamadas.push({ url, opciones });
    if (url === URL_TOKEN) return token;
    if (url === URL_USUARIO) return usuario;
    throw new Error(`URL inesperada: ${url}`);
  };
  return { fetch, llamadas };
}

describe('Proveedor OAuth de Google', () => {
  it('construye la URL de autorización con el client id, la URL de retorno y el state', () => {
    const proveedor = crearProveedorGoogle({ ...CONFIG, fetch: async () => {} });
    const url = new URL(proveedor.urlAutorizacion('estado-aleatorio'));
    assert.equal(`${url.origin}${url.pathname}`, URL_AUTORIZACION);
    assert.equal(url.searchParams.get('client_id'), CONFIG.clientId);
    assert.equal(url.searchParams.get('redirect_uri'), CONFIG.urlRetorno);
    assert.equal(url.searchParams.get('response_type'), 'code');
    assert.equal(url.searchParams.get('scope'), 'openid email profile');
    assert.equal(url.searchParams.get('state'), 'estado-aleatorio');
    assert.ok(!url.toString().includes(CONFIG.clientSecret), 'el secreto no viaja al navegador');
  });

  it('cambia el código por un token y devuelve email, nombre y si está verificado', async () => {
    const { fetch, llamadas } = crearFetchDoble();
    const usuario = await crearProveedorGoogle({ ...CONFIG, fetch }).obtenerUsuario('codigo-de-google');

    assert.deepEqual(usuario, { email: 'ana@gmail.com', nombre: 'Ana', emailVerificado: true });
    const cuerpoToken = new URLSearchParams(llamadas[0].opciones.body);
    assert.equal(llamadas[0].url, URL_TOKEN);
    assert.equal(cuerpoToken.get('code'), 'codigo-de-google');
    assert.equal(cuerpoToken.get('client_secret'), CONFIG.clientSecret);
    assert.equal(cuerpoToken.get('redirect_uri'), CONFIG.urlRetorno);
    assert.equal(cuerpoToken.get('grant_type'), 'authorization_code');
    assert.equal(llamadas[1].url, URL_USUARIO);
    assert.equal(llamadas[1].opciones.headers.authorization, 'Bearer token-acceso');
  });

  it('un email sin email_verified se marca como no verificado', async () => {
    const { fetch } = crearFetchDoble({ usuario: json({ email: 'ana@gmail.com', name: 'Ana' }) });
    const usuario = await crearProveedorGoogle({ ...CONFIG, fetch }).obtenerUsuario('codigo');
    assert.equal(usuario.emailVerificado, false);
  });

  it('si Google rechaza el código, falla con un error que no contiene el secreto', async () => {
    const { fetch } = crearFetchDoble({ token: json({ error: 'invalid_grant' }, 400) });
    await assert.rejects(
      crearProveedorGoogle({ ...CONFIG, fetch }).obtenerUsuario('codigo-caducado'),
      (err) => err.name === 'ErrorProveedor' && /invalid_grant/.test(err.message) && !err.message.includes(CONFIG.clientSecret),
    );
  });

  it('exige client id, client secret y URL de retorno', () => {
    assert.throws(() => crearProveedorGoogle({ ...CONFIG, clientSecret: '' }), /client secret/);
    assert.throws(() => crearProveedorGoogle({ ...CONFIG, urlRetorno: '' }), /URL de retorno/);
  });
});
