// Notificador de confirmación de cuenta por correo, con el API transaccional
// de Brevo (Hito 4, decisión D-15 en docs/decisiones.md).
//
// Cumple el mismo contrato que notificadorLog.js, así que la capa lógica no
// cambia: solo cambia el objeto que se crea en server/index.js.
//
// Contrato:  enviarConfirmacion({ email, nombre, token }) -> Promise<void>
//            enviarRestablecimiento({ email, nombre, token }) -> Promise<void>  (MJ-12)
//
// La clave de API es un secreto: llega por variable de entorno (BREVO_API_KEY)
// y nunca se escribe en el log. El remitente debe estar verificado en Brevo.

const URL_API_BREVO = 'https://api.brevo.com/v3/smtp/email';
const TIEMPO_MAXIMO_MS = 10_000;

function escaparHtml(texto) {
  return String(texto).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
}

function construirCorreo({ nombre, enlace, nombreApp }) {
  const saludo = nombre ? `Hola, ${escaparHtml(nombre)}:` : 'Hola:';
  const app = escaparHtml(nombreApp);
  return {
    subject: `Confirma tu cuenta en ${nombreApp}`,
    htmlContent:
      `<p>${saludo}</p>` +
      `<p>Para activar tu cuenta en ${app}, abre este enlace:</p>` +
      `<p><a href="${escaparHtml(enlace)}">Confirmar mi cuenta</a></p>` +
      '<p>Si no has creado esta cuenta, ignora este mensaje.</p>',
  };
}

// MJ-12: correo con el enlace para elegir una contraseña nueva.
function construirCorreoRestablecimiento({ nombre, enlace, nombreApp }) {
  const saludo = nombre ? `Hola, ${escaparHtml(nombre)}:` : 'Hola:';
  const app = escaparHtml(nombreApp);
  return {
    subject: `Cambia tu contraseña de ${nombreApp}`,
    htmlContent:
      `<p>${saludo}</p>` +
      `<p>Hemos recibido una petición para cambiar la contraseña de tu cuenta en ${app}. Para elegir una nueva, abre este enlace (vale durante una hora y una sola vez):</p>` +
      `<p><a href="${escaparHtml(enlace)}">Elegir una contraseña nueva</a></p>` +
      '<p>Si no lo has pedido tú, ignora este mensaje: tu contraseña no cambia.</p>',
  };
}

function crearNotificadorBrevo({ apiKey, remitente, urlBase, logger, fetch = globalThis.fetch }) {
  if (!apiKey) throw new Error('crearNotificadorBrevo necesita la clave de API de Brevo');
  if (!remitente?.email) throw new Error('crearNotificadorBrevo necesita el email del remitente');
  const base = String(urlBase || '').replace(/\/+$/, '');
  const nombreApp = remitente.nombre || 'la aplicación';

  // Envía un correo con el API de Brevo; `que` describe el correo en el log.
  async function enviar({ email, nombre, correo, que }) {
    let respuesta;
    try {
      respuesta = await fetch(URL_API_BREVO, {
        method: 'POST',
        headers: { 'api-key': apiKey, accept: 'application/json', 'content-type': 'application/json' },
        body: JSON.stringify({
          sender: { email: remitente.email, name: nombreApp },
          to: [{ email, ...(nombre ? { name: nombre } : {}) }],
          ...correo,
        }),
        signal: AbortSignal.timeout(TIEMPO_MAXIMO_MS),
      });
    } catch (err) {
      logger.error('No se pudo contactar con Brevo', { email, error: err.message });
      throw new Error(`No se pudo enviar el correo de ${que}`);
    }

    if (!respuesta.ok) {
      // El cuerpo de error de Brevo explica el motivo (remitente sin
      // verificar, clave no válida…); nunca contiene la clave.
      const detalle = (await respuesta.text().catch(() => '')).slice(0, 300);
      logger.error(`Brevo rechazó el correo de ${que}`, { email, estado: respuesta.status, detalle });
      throw new Error(`No se pudo enviar el correo de ${que}`);
    }

    logger.info(`Correo de ${que} enviado`, { email });
  }

  return {
    async enviarConfirmacion({ email, nombre, token }) {
      const enlace = `${base}/?confirmar=${encodeURIComponent(token)}`;
      await enviar({ email, nombre, correo: construirCorreo({ nombre, enlace, nombreApp }), que: 'confirmación' });
    },

    async enviarRestablecimiento({ email, nombre, token }) {
      const enlace = `${base}/?restablecer=${encodeURIComponent(token)}`;
      await enviar({ email, nombre, correo: construirCorreoRestablecimiento({ nombre, enlace, nombreApp }), que: 'cambio de contraseña' });
    },
  };
}

module.exports = { crearNotificadorBrevo, URL_API_BREVO };
