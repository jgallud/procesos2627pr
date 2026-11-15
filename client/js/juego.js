// FRONTEND — CAPA DE PRESENTACIÓN: partida de Hundir la Flota (Hito 5, RF-16;
// Hito 7, partidas entre jugadores: RF-22 y RF-23).
//
// Dibuja los dos tableros, recoge los clics y muestra el estado de la partida.
// Como interfaz.js, solo habla con el servidor a través de api.js (aquí no hay
// ningún fetch) y no contiene reglas del juego: no decide si un barco cabe ni
// si un disparo acierta. Envía cada jugada al servidor y pinta la vista que
// este devuelve, que nunca incluye la flota del rival hasta el final (RNF-10).

import * as api from './api.js';
import { seguirPartida, dejarDeSeguir } from './tiempoReal.js';

const $ = (selector) => document.querySelector(selector);

const FILAS = 'ABCDEFGHIJ';
const TAMANO = 10;

// Solo para mostrar: los tamaños los valida el servidor.
const NOMBRES_BARCOS = {
  portaaviones: 'Portaaviones (5)',
  acorazado: 'Acorazado (4)',
  crucero: 'Crucero (3)',
  submarino: 'Submarino (3)',
  destructor: 'Destructor (2)',
};
const nombreBarco = (barco) => (NOMBRES_BARCOS[barco] ?? barco).replace(/ \(\d\)$/, '');
const TEXTO_RESULTADO = { agua: 'agua', tocado: 'tocado', hundido: 'hundido' };

let partida = null; // última vista recibida del servidor
let barcoElegido = null; // barco que se va a colocar
let orientacion = 'horizontal';
let ocupado = false; // evita enviar dos jugadas a la vez
let ui = { avisar: () => {}, mostrarError: () => {} };

// --- Peticiones ---------------------------------------------------------------

// Ejecuta una jugada en el servidor y pinta la vista que devuelve.
async function jugar(accion) {
  if (ocupado) return null;
  ocupado = true;
  document.body.classList.add('juego-ocupado'); // solo cambia el cursor (MJ-02)
  try {
    const respuesta = await accion();
    return respuesta;
  } catch (error) {
    // RF-21: si el administrador ha anulado la partida, se cierra aquí
    // también y se puede empezar otra.
    if (error?.codigo === 'PARTIDA_ANULADA') {
      actualizar(null);
      ui.avisar('El administrador ha anulado esta partida. Puedes empezar otra.', 'error');
      return null;
    }
    ui.mostrarError(error);
    return null;
  } finally {
    ocupado = false;
    document.body.classList.remove('juego-ocupado');
  }
}

function actualizar(vista) {
  const acabaDeTerminar = vista?.estado === 'terminada' && partida?.estado !== 'terminada' && partida?.id === vista.id;
  partida = vista;
  // Aviso para el historial (historial.js): hay una partida terminada más.
  if (acabaDeTerminar) document.dispatchEvent(new CustomEvent('partida:terminada'));
  if (partida && !partida.propio.barcosPendientes.includes(barcoElegido)) {
    [barcoElegido = null] = partida.propio.barcosPendientes;
  }
  sincronizarTiempoReal();
  pintar();
}

async function nuevaPartida() {
  ui.avisar('');
  const vista = await jugar(() => api.crearPartidaContraMaquina());
  if (vista) {
    actualizar(vista);
    ui.avisar('Partida creada. La máquina ya ha colocado su flota: coloca la tuya.', 'info');
  }
}

// --- Partidas entre jugadores (RF-22) -----------------------------------------

async function crearPartidaAbierta() {
  ui.avisar('');
  const vista = await jugar(() => api.crearPartidaAbierta());
  if (vista) {
    actualizar(vista);
    ui.avisar('Partida creada. Cuando alguien se una, aparecerá su nombre; mientras, coloca tu flota.', 'info');
  }
}

async function unirseA(abierta) {
  ui.avisar('');
  const vista = await jugar(() => api.unirseAPartida(abierta.id));
  if (vista) {
    actualizar(vista);
    ui.avisar(`Te has unido a la partida de ${vista.nombreRival}. Coloca tu flota.`, 'info');
  } else {
    cargarAbiertas(); // quizá otro jugador se unió antes
  }
}

async function cancelar() {
  if (!window.confirm('¿Cancelar la partida? Nadie se ha unido todavía, así que no contará como derrota.')) return;
  const hecho = await jugar(async () => { await api.cancelarPartida(partida.id); return true; });
  if (hecho) { actualizar(null); ui.avisar('Partida cancelada.', 'info'); }
}

// Pide de nuevo la partida al servidor: al recibir un aviso, al reconectar
// (RF-25: el estado completo está en el servidor, no en la conexión) o con el
// botón «Actualizar partida».
async function actualizarPartida() {
  if (!partida) return;
  const vista = await jugar(() => api.obtenerPartida(partida.id));
  if (!vista) return;
  if (vista.anulada) {
    actualizar(null);
    ui.avisar('El administrador ha anulado esta partida. Puedes empezar otra.', 'error');
    return;
  }
  actualizar(vista);
}

// --- Tiempo real (RF-24 a RF-26) ----------------------------------------------

// Se siguen los avisos mientras haya una partida entre jugadores sin terminar.
function sincronizarTiempoReal() {
  const seguir = partida && partida.oponente === 'usuario' && partida.estado !== 'terminada' && !partida.anulada;
  if (seguir) seguirPartida(partida.id);
  else dejarDeSeguir();
}

const miIndice = () => (partida.soyCreador ? 0 : 1);

async function alRecibirAviso({ detail: aviso }) {
  if (!partida || aviso.partida !== partida.id) return;
  if (aviso.jugador === miIndice()) return; // mi propia jugada: ya la tengo
  await actualizarPartida();
  if (!partida) return;
  if (aviso.tipo === 'rival-unido') ui.avisar(`${partida.nombreRival} se ha unido a la partida.`, 'info');
  else if (aviso.tipo === 'flota-colocada') ui.avisar(`${NombreDelRival()} ha colocado su flota.`, 'info');
  else if (aviso.tipo === 'disparo') ui.avisar(`${NombreDelRival()} ha disparado a ${describirDisparo(aviso.disparo)}.`, 'info');
  else if (aviso.tipo === 'fin' || aviso.tipo === 'abandono') ui.avisar(textoFinal(), 'info');
}

function alCambiarConexion({ detail: { estado } }) {
  const indicador = $('#juego-conexion');
  indicador.hidden = estado === 'desconectado';
  indicador.textContent = estado === 'conectado' ? 'En directo' : 'Reconectando…';
  indicador.className = `etiqueta conexion-${estado}`;
}

function pintarAbiertas(abiertas) {
  const lista = $('#lista-abiertas');
  lista.replaceChildren(...abiertas.map((abierta) => {
    const elemento = document.createElement('li');
    const texto = document.createElement('span');
    texto.textContent = `Partida de ${abierta.creador}`;
    const boton = document.createElement('button');
    boton.type = 'button';
    boton.className = 'boton-principal';
    boton.textContent = 'Unirse';
    boton.addEventListener('click', () => unirseA(abierta));
    elemento.append(texto, boton);
    return elemento;
  }));
  $('#abiertas-vacio').hidden = abiertas.length > 0;
}

async function cargarAbiertas() {
  try {
    pintarAbiertas(await api.partidasAbiertas());
  } catch (error) {
    ui.mostrarError(error);
  }
}

async function colocarEn(casilla) {
  const barcoEnCasilla = partida.propio.flota.find((b) => b.casillas.includes(casilla));
  if (barcoEnCasilla) {
    const vista = await jugar(() => api.retirarBarco(partida.id, barcoEnCasilla.barco));
    if (vista) { barcoElegido = barcoEnCasilla.barco; actualizar(vista); ui.avisar(''); }
    return;
  }
  if (!barcoElegido) return;
  const vista = await jugar(() => api.colocarBarco(partida.id, { barco: barcoElegido, casilla, orientacion }));
  if (vista) { actualizar(vista); avisarSiEmpieza(); }
}

async function colocarAutomatica() {
  const vista = await jugar(() => api.colocarFlotaAleatoria(partida.id));
  if (vista) { actualizar(vista); avisarSiEmpieza(); }
}

function avisarSiEmpieza() {
  if (partida.estado === 'en_juego') {
    ui.avisar(partida.esMiTurno ? `¡Empieza la partida! Dispara en el tablero de ${nombreDelRival()}.` : `¡Empieza la partida! Empieza ${nombreDelRival()}.`, 'info');
  }
  else ui.avisar('');
}

async function dispararA(casilla) {
  const respuesta = await jugar(() => api.disparar(partida.id, casilla));
  if (!respuesta) return;
  actualizar(respuesta.partida);
  // MJ-09: el fin de partida se avisa con el mismo estilo que los disparos;
  // el resultado ya se destaca en la línea de estado, encima de los tableros.
  ui.avisar(describirTurno(respuesta), 'info');
}

async function abandonar() {
  if (!window.confirm('¿Seguro que quieres abandonar? La partida contará como derrota.')) return;
  const vista = await jugar(() => api.abandonarPartida(partida.id));
  if (vista) { actualizar(vista); ui.avisar('Has abandonado la partida.', 'info'); }
}

// --- Textos ---------------------------------------------------------------------

function describirDisparo({ casilla, resultado, barco }) {
  return resultado === 'hundido'
    ? `${casilla}: ¡hundido! (${nombreBarco(barco).toLowerCase()})`
    : `${casilla}: ${TEXTO_RESULTADO[resultado] ?? resultado}`;
}

// «la máquina», o el nombre del otro jugador.
const nombreDelRival = () => (partida.oponente === 'maquina' ? 'la máquina' : partida.nombreRival ?? 'tu rival');
const NombreDelRival = () => { const r = nombreDelRival(); return r[0].toUpperCase() + r.slice(1); };

function describirTurno({ disparo, disparosRival }) {
  const partes = [`Tu disparo a ${describirDisparo(disparo)}.`];
  if (disparosRival.length) {
    partes.push(`La máquina ha disparado: ${disparosRival.map(describirDisparo).join(', ')}.`);
  }
  if (partida.estado === 'terminada') partes.push(textoFinal());
  return partes.join(' ');
}

function textoFinal() {
  if (partida.resultado === 'victoria') {
    return partida.motivoFin === 'abandono'
      ? `¡Has ganado! ${NombreDelRival()} ha abandonado la partida.`
      : `¡Has ganado! Has hundido toda la flota de ${nombreDelRival()}.`;
  }
  if (partida.motivoFin === 'abandono') return 'Has abandonado: la partida cuenta como derrota.';
  return `Has perdido: ${nombreDelRival()} ha hundido toda tu flota.`;
}


function textoEstado() {
  if (partida.estado === 'colocando') {
    const quedan = partida.propio.barcosPendientes.length;
    const espera = partida.esperandoRival ? 'Esperando a que alguien se una. ' : '';
    if (quedan === 0) return `${espera || `Esperando a que ${nombreDelRival()} coloque su flota…`}`.trim();
    return `${espera}Coloca tu flota: te ${quedan === 1 ? 'queda 1 barco' : `quedan ${quedan} barcos`}.`;
  }
  if (partida.estado === 'en_juego') {
    return partida.esMiTurno ? `Tu turno: dispara en el tablero de ${nombreDelRival()}.` : `Turno de ${nombreDelRival()}…`;
  }
  return textoFinal();
}

// --- Tableros -------------------------------------------------------------------

// Clases de cada casilla a partir de una lista de barcos y otra de disparos.
// Las casillas de un barco hundido se marcan todas como «hundido» (MJ-04),
// no solo la del último disparo.
function clasesDeCasillas(barcos, disparos, claseBarco, hundidos) {
  const casillasHundidas = new Set((hundidos ?? []).flatMap((b) => b.casillas));
  const clases = new Map();
  const anadir = (casilla, clase) => clases.set(casilla, [...(clases.get(casilla) ?? []), clase]);
  for (const barco of barcos ?? []) for (const casilla of barco.casillas) anadir(casilla, claseBarco);
  for (const { casilla, resultado } of disparos ?? []) {
    anadir(casilla, casillasHundidas.has(casilla) ? 'hundido' : resultado);
  }
  return clases;
}

// Qué hace pulsar una casilla en cada tablero; lo cambia cada pintado.
const accionesTablero = new Map(); // contenedor -> { puede, accion } | null

// Crea la cuadrícula una sola vez, con un único manejador de clic.
function crearTablero(contenedor) {
  contenedor.append(document.createElement('span'));
  for (let c = 1; c <= TAMANO; c++) {
    const cabecera = document.createElement('span');
    cabecera.className = 'tablero-coordenada';
    cabecera.textContent = c;
    contenedor.append(cabecera);
  }
  for (const fila of FILAS) {
    const etiqueta = document.createElement('span');
    etiqueta.className = 'tablero-coordenada';
    etiqueta.textContent = fila;
    contenedor.append(etiqueta);
    for (let c = 1; c <= TAMANO; c++) {
      const celda = document.createElement('button');
      celda.type = 'button';
      celda.className = 'casilla';
      celda.dataset.casilla = `${fila}${c}`;
      contenedor.append(celda);
    }
  }
  contenedor.addEventListener('click', (evento) => {
    const celda = evento.target.closest('button.casilla');
    const alPulsar = accionesTablero.get(contenedor);
    if (celda && !celda.disabled && alPulsar && !ocupado) alPulsar.accion(celda.dataset.casilla);
  });
}

// MJ-02: actualiza las casillas existentes en lugar de rehacer el tablero,
// para que disparar no haga parpadear la página. Solo toca lo que cambia.
function pintarTablero(contenedor, { clases, alPulsar, nombre }) {
  if (!contenedor.querySelector('button.casilla')) crearTablero(contenedor);
  contenedor.setAttribute('aria-label', nombre);
  accionesTablero.set(contenedor, alPulsar);
  for (const celda of contenedor.querySelectorAll('button.casilla')) {
    const casilla = celda.dataset.casilla;
    const lista = clases.get(casilla) ?? [];
    const clase = ['casilla', ...lista].join(' ');
    if (celda.className !== clase) celda.className = clase;
    const etiqueta = [casilla, ...lista].join(', ');
    if (celda.getAttribute('aria-label') !== etiqueta) celda.setAttribute('aria-label', etiqueta);
    const pulsable = Boolean(alPulsar && alPulsar.puede(casilla, lista));
    if (celda.disabled === pulsable) celda.disabled = !pulsable;
  }
}

function pintarColocacion() {
  const lista = $('#juego-barcos');
  lista.replaceChildren();
  for (const barco of partida.propio.barcosPendientes) {
    const boton = document.createElement('button');
    boton.type = 'button';
    boton.className = barco === barcoElegido ? 'boton-principal' : 'boton-secundario';
    boton.textContent = NOMBRES_BARCOS[barco] ?? barco;
    boton.setAttribute('aria-pressed', String(barco === barcoElegido));
    boton.addEventListener('click', () => { barcoElegido = barco; pintar(); });
    lista.append(boton);
  }
  $('#juego-orientacion').textContent = orientacion === 'horizontal' ? 'Horizontal ↔' : 'Vertical ↕';
}

function pintar() {
  const hayPartida = Boolean(partida);
  $('#juego-sin-partida').hidden = hayPartida;
  $('#juego-partida').hidden = !hayPartida;
  if (!hayPartida) {
    cargarAbiertas();
    return;
  }

  const { estado, esMiTurno, propio, rival } = partida;
  const colocando = estado === 'colocando';
  const enJuego = estado === 'en_juego';
  const terminada = estado === 'terminada';

  const estadoEl = $('#juego-estado');
  estadoEl.textContent = textoEstado();
  estadoEl.className = `juego-estado${terminada ? ` juego-${partida.resultado}` : ''}`;
  $('#juego-colocacion').hidden = !colocando;
  const entreJugadores = partida.oponente === 'usuario';
  $('#juego-entre-jugadores').hidden = !entreJugadores || terminada;
  $('#boton-cancelar-partida').hidden = !partida.esperandoRival;
  $('#boton-abandonar').hidden = terminada || Boolean(partida.esperandoRival);
  $('#boton-otra-partida').hidden = !terminada;
  const tituloRival = partida.oponente === 'maquina' ? 'Flota de la máquina' : `Flota de ${partida.nombreRival ?? 'tu rival'}`;
  $('#titulo-tablero-rival').textContent = tituloRival;
  if (colocando) pintarColocacion();

  pintarTablero($('#tablero-propio'), {
    nombre: 'Tu flota',
    clases: clasesDeCasillas(propio.flota, propio.disparosRecibidos, 'barco', propio.barcosHundidos),
    alPulsar: colocando
      ? { puede: (casilla, lista) => lista.includes('barco') || Boolean(barcoElegido), accion: colocarEn }
      : null,
  });
  pintarTablero($('#tablero-rival'), {
    nombre: tituloRival,
    clases: clasesDeCasillas(terminada ? rival.flota : [], rival.disparos, 'barco-revelado', rival.barcosHundidos),
    alPulsar: enJuego && esMiTurno
      ? { puede: (casilla, lista) => !lista.some((c) => c in TEXTO_RESULTADO), accion: dispararA }
      : null,
  });
}

// --- Entrada desde interfaz.js ----------------------------------------------

export function prepararJuego({ avisar, mostrarError }) {
  ui = { avisar, mostrarError };
  $('#boton-nueva-partida').addEventListener('click', nuevaPartida);
  // Al terminar, se vuelve a la pantalla para elegir contra quién jugar.
  $('#boton-otra-partida').addEventListener('click', () => { actualizar(null); ui.avisar(''); });
  $('#boton-partida-jugadores').addEventListener('click', crearPartidaAbierta);
  $('#boton-recargar-abiertas').addEventListener('click', cargarAbiertas);
  $('#boton-actualizar-partida').addEventListener('click', actualizarPartida);
  $('#boton-cancelar-partida').addEventListener('click', cancelar);
  document.addEventListener('tiempo-real:aviso', alRecibirAviso);
  document.addEventListener('tiempo-real:reconectado', actualizarPartida);
  document.addEventListener('tiempo-real:estado', alCambiarConexion);
  $('#boton-abandonar').addEventListener('click', abandonar);
  $('#boton-colocacion-automatica').addEventListener('click', colocarAutomatica);
  $('#juego-orientacion').addEventListener('click', () => {
    orientacion = orientacion === 'horizontal' ? 'vertical' : 'horizontal';
    pintar();
  });
}

// Al entrar en el panel: retoma la partida en curso, si la hay.
export async function mostrarJuego() {
  $('#seccion-juego').hidden = false;
  try {
    actualizar(await api.partidaActual());
  } catch (error) {
    ui.mostrarError(error);
  }
}

export function ocultarJuego() {
  dejarDeSeguir();
  partida = null;
  barcoElegido = null;
  $('#seccion-juego').hidden = true;
}
