// Proveedor de inicio de sesión con Google (OAuth 2.0 / OpenID Connect,
// flujo "authorization code"). Decisiones D-17 y D-19 en docs/decisiones.md.
//
// Es el único módulo que habla con Google. La capa API lo usa para:
//   1. urlAutorizacion(state): adónde redirigir al navegador para que el
//      usuario acepte en Google.
//   2. obtenerUsuario(codigo): cambiar el código que devuelve Google por un
//      token y pedir con él los datos del usuario.
// La capa lógica solo recibe el resultado: { email, nombre, emailVerificado }.
//
// El client secret es un secreto: llega por variable de entorno
// (GOOGLE_CLIENT_SECRET) y nunca se escribe en el log.

const URL_AUTORIZACION = 'https://accounts.google.com/o/oauth2/v2/auth';
const URL_TOKEN = 'https://oauth2.googleapis.com/token';
const URL_USUARIO = 'https://openidconnect.googleapis.com/v1/userinfo';
const TIEMPO_MAXIMO_MS = 10_000;

class ErrorProveedor extends Error {
  constructor(mensaje) {
    super(mensaje);
    this.name = 'ErrorProveedor';
  }
}

function crearProveedorGoogle({ clientId, clientSecret, urlRetorno, fetch = globalThis.fetch }) {
  if (!clientId || !clientSecret) throw new Error('crearProveedorGoogle necesita el client id y el client secret');
  if (!urlRetorno) throw new Error('crearProveedorGoogle necesita la URL de retorno');

  async function pedir(url, opciones, paso) {
    let respuesta;
    try {
      respuesta = await fetch(url, { ...opciones, signal: AbortSignal.timeout(TIEMPO_MAXIMO_MS) });
    } catch (err) {
      throw new ErrorProveedor(`No se pudo contactar con Google (${paso}): ${err.message}`);
    }
    if (!respuesta.ok) {
      // El cuerpo de error de Google explica el motivo (código caducado,
      // URL de retorno distinta…); nunca contiene el client secret.
      const detalle = (await respuesta.text().catch(() => '')).slice(0, 300);
      throw new ErrorProveedor(`Google rechazó la petición (${paso}, ${respuesta.status}): ${detalle}`);
    }
    return respuesta.json();
  }

  return {
    nombre: 'google',

    urlAutorizacion(state) {
      const parametros = new URLSearchParams({
        client_id: clientId,
        redirect_uri: urlRetorno,
        response_type: 'code',
        scope: 'openid email profile',
        state,
        prompt: 'select_account',
      });
      return `${URL_AUTORIZACION}?${parametros}`;
    },

    async obtenerUsuario(codigo) {
      const token = await pedir(URL_TOKEN, {
        method: 'POST',
        headers: { 'content-type': 'application/x-www-form-urlencoded', accept: 'application/json' },
        body: new URLSearchParams({
          code: codigo,
          client_id: clientId,
          client_secret: clientSecret,
          redirect_uri: urlRetorno,
          grant_type: 'authorization_code',
        }),
      }, 'token');

      const datos = await pedir(URL_USUARIO, {
        headers: { authorization: `Bearer ${token.access_token}`, accept: 'application/json' },
      }, 'datos del usuario');

      return { email: datos.email, nombre: datos.name, emailVerificado: datos.email_verified === true };
    },
  };
}

module.exports = { crearProveedorGoogle, ErrorProveedor, URL_AUTORIZACION, URL_TOKEN, URL_USUARIO };
