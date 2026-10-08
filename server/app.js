// Construcción de la aplicación Express.
// El backend sirve el frontend (carpeta client/) y la API bajo /api, en el
// mismo origen (así la cookie de sesión funciona sin CORS). Las dependencias
// (servicios, logger) se inyectan desde fuera:
// así las pruebas pueden crear la app con datos en memoria y, en el Hito 3,
// index.js podrá pasar un servicio que use MongoDB sin tocar este archivo.

const path = require('node:path');
const express = require('express');
const { loggerSilencioso } = require('./logger');
const { crearIdentificadorSesion, crearRouterSesion, crearGestorCookie } = require('./api/sesion');
const { crearRouterUsuarios } = require('./api/usuariosRouter');
const { crearManejadorErroresApi } = require('./api/errores');

function crearApp({ servicioUsuarios, servicioSesiones, logger = loggerSilencioso, cookieSegura = false } = {}) {
  if (!servicioUsuarios) throw new Error('crearApp necesita servicioUsuarios');
  if (!servicioSesiones) throw new Error('crearApp necesita servicioSesiones');
  const cookie = crearGestorCookie({ cookieSegura });

  const app = express();
  app.disable('x-powered-by');

  // Registro de cada petición atendida.
  app.use((req, res, next) => {
    const inicio = process.hrtime.bigint();
    res.on('finish', () => {
      const ms = Number(process.hrtime.bigint() - inicio) / 1e6;
      const nivel = res.statusCode >= 500 ? 'error' : req.path === '/api/salud' ? 'debug' : 'info';
      logger[nivel]('Petición HTTP', {
        metodo: req.method,
        ruta: req.originalUrl.split('?')[0],
        estado: res.statusCode,
        ms: Math.round(ms),
      });
    });
    next();
  });

  // --- API -----------------------------------------------------------------
  const api = express.Router();
  api.use(express.json());
  api.use(crearIdentificadorSesion({ servicioSesiones, cookie }));

  api.get('/salud', (req, res) => {
    res.json({ estado: 'ok' });
  });

  api.use('/sesion', crearRouterSesion({ servicioUsuarios, servicioSesiones, cookie }));
  api.use('/usuarios', crearRouterUsuarios({ servicioUsuarios, servicioSesiones, cookie }));

  // Cualquier ruta de la API no definida responde 404 en JSON.
  api.use((req, res) => {
    res.status(404).json({ error: 'Recurso no encontrado' });
  });

  api.use(crearManejadorErroresApi(logger));
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
