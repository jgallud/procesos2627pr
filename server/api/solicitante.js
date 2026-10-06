// CAPA API — identificación de quién hace la petición.
//
// PROVISIONAL (Hito 1): todavía no hay sesiones, así que el cliente indica su
// id en la cabecera X-Usuario-Id. La lógica no se fía de ella a ciegas:
// comprueba que el usuario existe, está activo y tiene el rol necesario.
//
// En el Hito 2 este middleware se sustituye por uno que obtiene el usuario de
// la sesión. Las rutas y la capa lógica no cambian: siguen leyendo
// req.idSolicitante.

const CABECERA = 'x-usuario-id';

function identificarSolicitante(req, res, next) {
  const id = req.get(CABECERA);
  req.idSolicitante = typeof id === 'string' && id.trim() ? id.trim() : undefined;
  next();
}

module.exports = { identificarSolicitante, CABECERA };
