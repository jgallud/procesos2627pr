// Pruebas del notificador por correo con Brevo. No se llama al API real:
// se inyecta un doble de fetch que registra la petición y devuelve la
// respuesta que necesita cada caso.

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { crearNotificadorBrevo, URL_API_BREVO } = require('../../server/notificacion/notificadorBrevo');

const CLAVE = 'clave-de-prueba';

function crearLoggerEspia() {
  const eventos = [];
  const registrar = (nivel) => (mensaje, datos) => eventos.push({ nivel, mensaje, datos });
  return { eventos, info: registrar('info'), warn: registrar('warn'), error: registrar('error'), debug: registrar('debug') };
}

function crearFetchDoble(respuesta = { ok: true, status: 201, text: async () => '{"messageId":"<1@x>"}' }) {
  const llamadas = [];
  const fetch = async (url, opciones) => {
    llamadas.push({ url, opciones, cuerpo: JSON.parse(opciones.body) });
    if (respuesta instanceof Error) throw respuesta;
    return respuesta;
  };
  return { fetch, llamadas };
}

function crear({ fetch, logger = crearLoggerEspia(), nombre = 'Mi App' } = {}) {
  return crearNotificadorBrevo({
    apiKey: CLAVE,
    remitente: { email: 'no-responder@ejemplo.com', nombre },
    urlBase: 'https://app.ejemplo.com/',
    logger,
    fetch,
  });
}

describe('Notificador por correo con Brevo', () => {
  it('envía al API de Brevo un correo con el enlace de confirmación', async () => {
    const { fetch, llamadas } = crearFetchDoble();
    await crear({ fetch }).enviarConfirmacion({ email: 'ana@ejemplo.com', nombre: 'Ana', token: 'id.sec/reto' });

    assert.equal(llamadas.length, 1);
    const { url, opciones, cuerpo } = llamadas[0];
    assert.equal(url, URL_API_BREVO);
    assert.equal(opciones.method, 'POST');
    assert.equal(opciones.headers['api-key'], CLAVE);
    assert.deepEqual(cuerpo.sender, { email: 'no-responder@ejemplo.com', name: 'Mi App' });
    assert.deepEqual(cuerpo.to, [{ email: 'ana@ejemplo.com', name: 'Ana' }]);
    assert.match(cuerpo.subject, /Confirma tu cuenta/);
    assert.ok(cuerpo.htmlContent.includes('https://app.ejemplo.com/?confirmar=id.sec%2Freto'));
  });

  it('sin nombre, el destinatario va solo con el email', async () => {
    const { fetch, llamadas } = crearFetchDoble();
    await crear({ fetch }).enviarConfirmacion({ email: 'ana@ejemplo.com', token: 't' });
    assert.deepEqual(llamadas[0].cuerpo.to, [{ email: 'ana@ejemplo.com' }]);
  });

  it('escapa el nombre del usuario en el HTML del correo', async () => {
    const { fetch, llamadas } = crearFetchDoble();
    await crear({ fetch }).enviarConfirmacion({ email: 'ana@ejemplo.com', nombre: '<script>x</script>', token: 't' });
    assert.ok(!llamadas[0].cuerpo.htmlContent.includes('<script>'));
    assert.ok(llamadas[0].cuerpo.htmlContent.includes('&lt;script&gt;'));
  });

  it('si Brevo rechaza el envío, falla y lo registra sin la clave de API', async () => {
    const logger = crearLoggerEspia();
    const { fetch } = crearFetchDoble({ ok: false, status: 401, text: async () => '{"code":"unauthorized"}' });

    await assert.rejects(
      crear({ fetch, logger }).enviarConfirmacion({ email: 'ana@ejemplo.com', token: 't' }),
      /No se pudo enviar el correo de confirmación/,
    );
    const error = logger.eventos.find((e) => e.nivel === 'error');
    assert.equal(error.datos.estado, 401);
    assert.ok(!JSON.stringify(logger.eventos).includes(CLAVE));
  });

  it('si no se puede contactar con Brevo, falla con un error claro', async () => {
    const { fetch } = crearFetchDoble(new Error('getaddrinfo ENOTFOUND'));
    await assert.rejects(
      crear({ fetch }).enviarConfirmacion({ email: 'ana@ejemplo.com', token: 't' }),
      /No se pudo enviar el correo de confirmación/,
    );
  });

  it('exige la clave de API y el email del remitente', () => {
    const base = { remitente: { email: 'a@ejemplo.com' }, urlBase: 'https://x', logger: crearLoggerEspia() };
    assert.throws(() => crearNotificadorBrevo({ ...base, apiKey: '' }), /clave de API/);
    assert.throws(() => crearNotificadorBrevo({ ...base, apiKey: CLAVE, remitente: {} }), /remitente/);
  });
});
