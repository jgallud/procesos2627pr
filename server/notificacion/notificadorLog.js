// Notificador de confirmación de cuenta — implementación provisional (Hito 2).
//
// Todavía no se envía correo: el enlace de confirmación se escribe en el log
// del servidor (en local, en la terminal; en Cloud Run, en Cloud Logging).
// En el Hito 4 se sustituirá por un notificador que envíe un correo con el
// mismo enlace, sin cambiar la capa lógica: solo cambia el objeto que se
// crea en server/index.js.
//
// Contrato:  enviarConfirmacion({ email, nombre, token }) -> Promise<void>

function crearNotificadorLog({ logger, urlBase }) {
  const base = String(urlBase || '').replace(/\/+$/, '');
  return {
    async enviarConfirmacion({ email, token }) {
      const enlace = `${base}/?confirmar=${encodeURIComponent(token)}`;
      logger.info('Enlace de confirmación de cuenta (pendiente de envío por correo)', { email, enlace });
    },
  };
}

module.exports = { crearNotificadorLog };
