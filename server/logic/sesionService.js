// CAPA DE LÓGICA — ciclo de vida de las sesiones.
//
// Una sesión asocia un identificador aleatorio (que viaja en una cookie) con
// un usuario y una fecha de caducidad. El estado vive en el servidor, así que
// cerrar sesión la invalida de verdad: aunque alguien conserve la cookie, el
// identificador ya no existe en el almacén.
//
// Este servicio no sabe nada de cookies ni de HTTP (eso lo hace la capa API)
// ni de dónde se guardan las sesiones (lo decide el repositorio que recibe).
// Tampoco decide si el usuario puede operar: eso lo comprueba el servicio de
// usuarios en cada petición (p. ej. si fue eliminado tras iniciar sesión).

const { randomBytes } = require('node:crypto');
const { loggerSilencioso } = require('../logger');

const DURACION_POR_DEFECTO_MS = 7 * 24 * 60 * 60 * 1000; // 7 días

function crearServicioSesiones({
  repositorio,
  duracionMs = DURACION_POR_DEFECTO_MS,
  logger = loggerSilencioso,
  reloj = () => new Date(),
}) {
  if (!repositorio) throw new Error('crearServicioSesiones necesita un repositorio');

  return {
    duracionMs,

    // Abre una sesión nueva para el usuario. Se genera siempre un identificador
    // nuevo (nunca se reutiliza uno que traiga el cliente).
    async abrir(idUsuario) {
      const ahora = reloj();
      await repositorio.eliminarCaducadas(ahora);
      const sesion = await repositorio.crear({
        id: randomBytes(32).toString('base64url'),
        idUsuario,
        creadaEn: ahora.toISOString(),
        expiraEn: new Date(ahora.getTime() + duracionMs).toISOString(),
      });
      logger.debug('Sesión abierta', { idUsuario });
      return sesion;
    },

    // Devuelve el id del usuario de una sesión vigente, o undefined si no
    // existe o ha caducado (en ese caso se borra).
    async resolver(idSesion) {
      if (typeof idSesion !== 'string' || !idSesion) return undefined;
      const sesion = await repositorio.buscarPorId(idSesion);
      if (!sesion) return undefined;
      if (sesion.expiraEn <= reloj().toISOString()) {
        await repositorio.eliminar(idSesion);
        return undefined;
      }
      return sesion.idUsuario;
    },

    // Cierra una sesión concreta (cierre de sesión).
    async cerrar(idSesion) {
      if (typeof idSesion !== 'string' || !idSesion) return false;
      return repositorio.eliminar(idSesion);
    },

    // Cierra todas las sesiones de un usuario (p. ej. al eliminar su cuenta).
    async cerrarTodas(idUsuario) {
      const n = await repositorio.eliminarDeUsuario(idUsuario);
      if (n > 0) logger.info('Sesiones cerradas', { idUsuario, sesiones: n });
      return n;
    },
  };
}

module.exports = { crearServicioSesiones, DURACION_POR_DEFECTO_MS };
