// Punto de entrada: lee la configuración, crea la app y la pone a escuchar.

const { leerConfig } = require('./config');
const { crearLogger } = require('./logger');
const { crearApp } = require('./app');

const config = leerConfig();
const logger = crearLogger({ nivel: config.nivelLog });

const app = crearApp({ logger });

app.listen(config.puerto, () => {
  logger.info('Servidor iniciado', { puerto: config.puerto, entorno: config.entorno });
});
