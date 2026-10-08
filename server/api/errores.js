// CAPA API — traducción de errores a respuestas HTTP.
// La lógica lanza ErrorDominio con un código; aquí se decide el estado HTTP.

const { CODIGOS } = require('../logic/errores');

const ESTADO_HTTP = {
  [CODIGOS.DATOS_INVALIDOS]: 400,
  [CODIGOS.NO_AUTENTICADO]: 401,
  [CODIGOS.PROHIBIDO]: 403,
  [CODIGOS.USUARIO_NO_ENCONTRADO]: 404,
  [CODIGOS.EMAIL_DUPLICADO]: 409,
  [CODIGOS.ESTADO_INVALIDO]: 409,
  [CODIGOS.CREDENCIALES_INVALIDAS]: 401,
  [CODIGOS.CUENTA_PENDIENTE]: 403,
  [CODIGOS.CUENTA_ELIMINADA]: 403,
  [CODIGOS.TOKEN_INVALIDO]: 400,
};

function crearManejadorErroresApi(logger) {
  // eslint-disable-next-line no-unused-vars
  return (err, req, res, next) => {
    // Error de dominio esperado: se devuelve su mensaje al cliente.
    if (err.name === 'ErrorDominio' && ESTADO_HTTP[err.codigo]) {
      return res.status(ESTADO_HTTP[err.codigo]).json({ error: err.message, codigo: err.codigo });
    }

    // JSON mal formado en el cuerpo de la petición.
    if (err.type === 'entity.parse.failed') {
      return res.status(400).json({ error: 'El cuerpo de la petición no es JSON válido', codigo: CODIGOS.DATOS_INVALIDOS });
    }

    // Cualquier otro error es inesperado: se registra y no se dan detalles.
    logger.error('Error no controlado en la API', {
      error: err.message,
      stack: err.stack,
      metodo: req.method,
      ruta: req.originalUrl,
    });
    return res.status(500).json({ error: 'Error interno del servidor' });
  };
}

module.exports = { crearManejadorErroresApi, ESTADO_HTTP };
