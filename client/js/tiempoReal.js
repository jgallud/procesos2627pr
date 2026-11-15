// FRONTEND — CAPA DE COMUNICACIÓN: tiempo real por WebSocket (Hito 7, RF-24 y RF-25).
//
// Único módulo del cliente que abre un WebSocket (igual que api.js es el único
// que usa fetch). Conecta con /api/tiempo-real en el mismo origen, así que el
// navegador envía la cookie de sesión y el servidor sabe quién es. No envía
// jugadas (van por api.js): solo recibe avisos y los entrega a la interfaz
// como eventos del documento:
//   'tiempo-real:aviso'        detail = aviso del servidor ({ tipo, partida, … })
//   'tiempo-real:estado'       detail = { estado: 'conectado' | 'reconectando' | 'desconectado' }
//   'tiempo-real:reconectado'  tras volver a conectar: la interfaz pide el
//                              estado completo de la partida por REST (RF-25)
//
// Si la conexión se corta (recarga del servidor, nuevo despliegue, cambio de
// red), se reconecta sola, esperando 1, 2, 4… hasta 10 segundos entre intentos.

const ESPERA_MAXIMA_MS = 10000;

let ws = null;
let idSeguido = null;
let intentos = 0;
let huboConexion = false;
let temporizador = null;

const emitir = (nombre, detail) => document.dispatchEvent(new CustomEvent(nombre, { detail }));

function abrir() {
  temporizador = null;
  const protocolo = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const url = `${protocolo}//${window.location.host}/api/tiempo-real?partida=${encodeURIComponent(idSeguido)}`;
  const socket = new WebSocket(url);
  ws = socket;

  socket.addEventListener('message', (evento) => {
    let aviso;
    try { aviso = JSON.parse(evento.data); } catch { return; }
    if (aviso.tipo === 'conectado') {
      const esReconexion = huboConexion;
      huboConexion = true;
      intentos = 0;
      emitir('tiempo-real:estado', { estado: 'conectado' });
      if (esReconexion) emitir('tiempo-real:reconectado');
      return;
    }
    emitir('tiempo-real:aviso', aviso);
  });

  socket.addEventListener('close', () => {
    if (ws !== socket) return; // ya se cerró a propósito o se abrió otra
    ws = null;
    if (!idSeguido) return;
    intentos += 1;
    huboConexion = true; // al volver a conectar hay que pedir el estado completo
    emitir('tiempo-real:estado', { estado: 'reconectando' });
    temporizador = setTimeout(abrir, Math.min(ESPERA_MAXIMA_MS, 1000 * 2 ** (intentos - 1)));
  });
}

// Empieza a recibir los avisos de una partida (si ya la seguía, no hace nada).
export function seguirPartida(idPartida) {
  if (idSeguido === idPartida) return;
  dejarDeSeguir();
  idSeguido = idPartida;
  huboConexion = false;
  abrir();
}

export function dejarDeSeguir() {
  const habia = idSeguido !== null;
  idSeguido = null;
  intentos = 0;
  clearTimeout(temporizador);
  temporizador = null;
  if (ws) {
    const socket = ws;
    ws = null;
    socket.close();
  }
  if (habia) emitir('tiempo-real:estado', { estado: 'desconectado' });
}

// Al recuperar la red no se espera al siguiente intento.
window.addEventListener('online', () => {
  if (idSeguido && !ws) {
    clearTimeout(temporizador);
    abrir();
  }
});
