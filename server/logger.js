// Logger mínimo sin dependencias. Escribe una línea JSON por evento en la
// salida estándar; Cloud Run/Cloud Logging interpreta el campo "severity".

const NIVELES = { debug: 10, info: 20, warn: 30, error: 40, silent: 100 };

function crearLogger({ nivel = 'info', salida = console } = {}) {
  const umbral = NIVELES[nivel] ?? NIVELES.info;

  function escribir(nivelEvento, mensaje, datos) {
    if (NIVELES[nivelEvento] < umbral) return;
    const linea = JSON.stringify({
      severity: nivelEvento.toUpperCase(),
      time: new Date().toISOString(),
      message: mensaje,
      ...datos,
    });
    if (nivelEvento === 'error' || nivelEvento === 'warn') salida.error(linea);
    else salida.log(linea);
  }

  return {
    debug: (mensaje, datos) => escribir('debug', mensaje, datos),
    info: (mensaje, datos) => escribir('info', mensaje, datos),
    warn: (mensaje, datos) => escribir('warn', mensaje, datos),
    error: (mensaje, datos) => escribir('error', mensaje, datos),
  };
}

// Logger que no escribe nada: útil en las pruebas.
const loggerSilencioso = crearLogger({ nivel: 'silent' });

module.exports = { crearLogger, loggerSilencioso };
