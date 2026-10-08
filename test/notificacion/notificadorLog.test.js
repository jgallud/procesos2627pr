// Pruebas del notificador provisional: escribe el enlace de confirmación en el log.

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { crearNotificadorLog } = require('../../server/notificacion/notificadorLog');

describe('Notificador por log', () => {
  it('registra un enlace de confirmación con el token y la URL base', async () => {
    const eventos = [];
    const logger = { info: (mensaje, datos) => eventos.push({ mensaje, datos }) };
    const notificador = crearNotificadorLog({ logger, urlBase: 'https://app.ejemplo.com/' });

    await notificador.enviarConfirmacion({ email: 'ana@ejemplo.com', token: 'id.secreto' });

    assert.equal(eventos.length, 1);
    assert.equal(eventos[0].datos.email, 'ana@ejemplo.com');
    assert.equal(eventos[0].datos.enlace, 'https://app.ejemplo.com/?confirmar=id.secreto');
  });
});
