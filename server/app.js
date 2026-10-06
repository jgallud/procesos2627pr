// Construcción de la aplicación Express.
// El backend sirve el frontend (carpeta client/) y la API bajo /api, en el
// mismo origen. Las dependencias se inyectan para poder probar la app.

const path = require('node:path');
const express = require('express');
const { loggerSilencioso } = require('./logger');

function crearApp({ logger = loggerSilencioso } = {}) {
  const app = express();

  app.disable('x-powered-by');
  app.use(express.json());

  // --- API -----------------------------------------------------------------
  const api = express.Router();

  api.get('/salud', (req, res) => {
    res.json({ estado: 'ok' });
  });

  // Cualquier ruta de la API no definida responde 404 en JSON.
  api.use((req, res) => {
    res.status(404).json({ error: 'Recurso no encontrado' });
  });

  app.use('/api', api);

  // --- Frontend estático ---------------------------------------------------
  app.use(express.static(path.join(__dirname, '..', 'client')));

  // --- Manejador de errores final -----------------------------------------
  // eslint-disable-next-line no-unused-vars
  app.use((err, req, res, next) => {
    logger.error('Error no controlado', { error: err.message, ruta: req.originalUrl });
    res.status(500).json({ error: 'Error interno del servidor' });
  });

  return app;
}

module.exports = { crearApp };
