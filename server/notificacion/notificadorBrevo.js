// Notificador de confirmación de cuenta por correo, con el API transaccional
// de Brevo (Hito 4, decisión D-15 en docs/decisiones.md).
//
// Cumple el mismo contrato que notificadorLog.js, así que la capa lógica no
// cambia: solo cambia el objeto que se crea en server/index.js.
//
// Contrato:  enviarConfirmacion({ email, nombre, token }) -> Promise<void>
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

function crearNotificadorBrevo({ apiKey, remitente, urlBase, logger, fetch = globalThis.fetch }) {
  if (!apiKey) throw new Error('crearNotificadorBrevo necesita la clave de API de Brevo');
  if (!remitente?.email) throw new Error('crearNotificadorBrevo necesita el email del remitente');
  const base = String(urlBase || '').replace(/\/+$/, '');
  const nombreApp = remitente.nombre || 'la aplicación';

  return {
    async enviarConfirmacion({ email, nombre, token }) {
      const enlace = `${base}/?confirmar=${encodeURIComponent(token)}`;
      const correo = construirCorreo({ nombre, enlace, nombreApp });

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
        throw new Error('No se pudo enviar el correo de confirmación');
      }

      if (!respuesta.ok) {
        // El cuerpo de error de Brevo explica el motivo (remitente sin
        // verificar, clave no válida…); nunca contiene la clave.
        const detalle = (await respuesta.text().catch(() => '')).slice(0, 300);
        logger.error('Brevo rechazó el correo de confirmación', { email, estado: respuesta.status, detalle });
        throw new Error('No se pudo enviar el correo de confirmación');
      }

      logger.info('Correo de confirmación enviado', { email });
    },
  };
}

module.exports = { crearNotificadorBrevo, URL_API_BREVO };
