// CAPA API — tiempo real por WebSocket (Hito 7, RF-24 y RF-25; D-23, D-37).
//
// Servidor WebSocket sobre el mismo servidor HTTP y el mismo origen, en
// /api/tiempo-real?partida=<id> (los avisos de una partida) o en
// /api/tiempo-real?vestibulo (MJ-14: que la lista de partidas abiertas ha
// cambiado, para cualquier usuario con sesión). Solo lleva AVISOS del servidor al cliente:
// las jugadas van siempre por la API REST, con su validación y sus errores.
//
// Este módulo:
//   - identifica la conexión con la cookie de sesión (sin sesión válida: 401);
//   - pregunta al servicio de partidas si el usuario puede seguir esa partida
//     (no lo decide él): solo los dos jugadores (403 si no, 404 si no existe);
//   - sabe qué conexiones siguen cada partida y les entrega los avisos que
//     emite el servicio de partidas a través de avisar(idPartida, evento);
//   - detecta conexiones muertas con ping/pong y las cierra.
// No valida jugadas ni guarda el estado de la partida: el estado autoritativo
// está en la base de datos, así que al reconectar el cliente lo pide por REST.

const http = require('node:http');
const { WebSocketServer, WebSocket } = require('ws');
const { leerCookie, NOMBRE_COOKIE } = require('./sesion');
const { ESTADO_HTTP } = require('./errores');
const { loggerSilencioso } = require('../logger');

const RUTA = '/api/tiempo-real';
const CIERRE_REINICIO = 1012; // código WebSocket «el servidor se reinicia»: el cliente debe reconectar

function crearTiempoReal({ logger = loggerSilencioso, intervaloPingMs = 30000 } = {}) {
  const wss = new WebSocketServer({ noServer: true, maxPayload: 1024 });
  const seguidores = new Map(); // idPartida -> Set<WebSocket>
  const vestibulo = new Set(); // conexiones que miran la lista de partidas abiertas (MJ-14)
  let servicios = null;
  let temporizador = null;

  // Responde al intento de conexión con un error HTTP y lo corta.
  function rechazar(socket, estado) {
    socket.write(`HTTP/1.1 ${estado} ${http.STATUS_CODES[estado]}\r\nConnection: close\r\nContent-Length: 0\r\n\r\n`);
    socket.destroy();
  }

  // Desde otra web no se puede abrir una conexión con la cookie del usuario:
  // la cookie es SameSite=Lax y, además, se exige que el origen sea este sitio.
  function origenPermitido(req) {
    const { origin } = req.headers;
    if (!origin) return true; // clientes que no son navegadores (pruebas)
    try {
      return new URL(origin).host === req.headers.host;
    } catch {
      return false;
    }
  }

  function seguir(ws, idPartida) {
    if (!seguidores.has(idPartida)) seguidores.set(idPartida, new Set());
    seguidores.get(idPartida).add(ws);
    ws.vivo = true;
    ws.on('pong', () => { ws.vivo = true; });
    ws.on('close', () => {
      const conjunto = seguidores.get(idPartida);
      conjunto?.delete(ws);
      if (conjunto?.size === 0) seguidores.delete(idPartida);
    });
    // Los mensajes del cliente se ignoran: el WebSocket solo lleva avisos.
    ws.on('message', () => {});
    ws.send(JSON.stringify({ tipo: 'conectado', partida: idPartida }));
  }

  function seguirVestibulo(ws) {
    vestibulo.add(ws);
    ws.vivo = true;
    ws.on('pong', () => { ws.vivo = true; });
    ws.on('close', () => { vestibulo.delete(ws); });
    ws.on('message', () => {});
    ws.send(JSON.stringify({ tipo: 'conectado', vestibulo: true }));
  }

  async function alPedirConexion(req, socket, cabeza) {
    const url = new URL(req.url, 'http://localhost');
    if (url.pathname !== RUTA) return rechazar(socket, 404);
    if (!origenPermitido(req)) return rechazar(socket, 403);
    try {
      const idSolicitante = await servicios.servicioSesiones.resolver(leerCookie(req, NOMBRE_COOKIE));
      if (!idSolicitante) return rechazar(socket, 401);
      if (url.searchParams.has('vestibulo')) {
        wss.handleUpgrade(req, socket, cabeza, (ws) => seguirVestibulo(ws));
        return undefined;
      }
      const idPartida = url.searchParams.get('partida');
      await servicios.servicioPartidas.puedeSeguir(idSolicitante, idPartida);
      wss.handleUpgrade(req, socket, cabeza, (ws) => seguir(ws, idPartida));
      logger.debug('Conexión de tiempo real abierta', { partida: idPartida, usuario: idSolicitante });
    } catch (err) {
      if (err.name === 'ErrorDominio' && ESTADO_HTTP[err.codigo]) return rechazar(socket, ESTADO_HTTP[err.codigo]);
      logger.error('Error al abrir una conexión de tiempo real', { error: err.message });
      return rechazar(socket, 500);
    }
    return undefined;
  }

  // Conexiones que no responden al ping (red caída sin cerrar): se cierran.
  function comprobarConexiones() {
    for (const ws of wss.clients) {
      if (!ws.vivo) ws.terminate();
      else {
        ws.vivo = false;
        ws.ping();
      }
    }
  }

  return {
    // El avisador que recibe el servicio de partidas (D-23).
    avisar(idPartida, evento) {
      const mensaje = JSON.stringify(evento);
      for (const ws of seguidores.get(idPartida) ?? []) {
        if (ws.readyState === WebSocket.OPEN) ws.send(mensaje);
      }
    },

    // MJ-14: aviso a todos los que miran la lista de partidas abiertas.
    avisarVestibulo(evento) {
      const mensaje = JSON.stringify(evento);
      for (const ws of vestibulo) {
        if (ws.readyState === WebSocket.OPEN) ws.send(mensaje);
      }
    },

    // Engancha el WebSocket al servidor HTTP ya creado (server/index.js).
    conectar({ servidorHttp, servicioSesiones, servicioPartidas }) {
      servicios = { servicioSesiones, servicioPartidas };
      servidorHttp.on('upgrade', (req, socket, cabeza) => { alPedirConexion(req, socket, cabeza); });
      temporizador = setInterval(comprobarConexiones, intervaloPingMs);
      temporizador.unref();
    },

    conexiones: () => wss.clients.size,

    // Parada ordenada (SIGTERM en Cloud Run, nuevo despliegue): se cierran las
    // conexiones con el código de reinicio y el cliente se reconecta (RF-25).
    async cerrar() {
      clearInterval(temporizador);
      for (const ws of wss.clients) ws.close(CIERRE_REINICIO, 'El servidor se reinicia');
      await new Promise((resolve) => { wss.close(() => resolve()); });
    },
  };
}

module.exports = { crearTiempoReal, RUTA, CIERRE_REINICIO };
