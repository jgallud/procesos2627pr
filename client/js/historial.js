// FRONTEND — CAPA DE PRESENTACIÓN: historial, estadísticas y clasificación
// (Hito 6, RF-18, RF-19 y RF-20).
//
// Muestra las partidas terminadas y las estadísticas que calcula el servidor:
// aquí no se cuenta ni se calcula nada, solo se da formato. Habla con el
// servidor únicamente a través de api.js.
//
// Se recarga cuando termina una partida (evento «partida:terminada», que
// lanza juego.js). El administrador puede ver las de otro usuario desde la
// tabla de usuarios (mostrarHistorialDe).

import * as api from './api.js';

const $ = (selector) => document.querySelector(selector);

let ui = { mostrarError: () => {} };
let usuarioConsultado = null; // null: las propias; si no, { id, email } (administrador)

const formatoFecha = new Intl.DateTimeFormat('es-ES', { dateStyle: 'short', timeStyle: 'short' });
const fecha = (iso) => (iso ? formatoFecha.format(new Date(iso)) : '—');
const pct = (valor) => (valor === null || valor === undefined ? '—' : `${valor.toLocaleString('es-ES')} %`);

function textoResultado({ resultado, motivoFin }) {
  if (resultado === 'victoria') return 'Victoria';
  return motivoFin === 'abandono' ? 'Derrota (abandono)' : 'Derrota';
}

function pintarEstadisticas(e) {
  const datos = [
    ['Jugadas', e.jugadas],
    ['Ganadas', e.ganadas],
    ['Perdidas', e.perdidas],
    ['Victorias', pct(e.porcentajeVictorias)],
    ['Acierto', pct(e.porcentajeAcierto)],
  ];
  $('#estadisticas').replaceChildren(...datos.map(([nombre, valor]) => {
    const bloque = document.createElement('div');
    const dt = document.createElement('dt');
    const dd = document.createElement('dd');
    dt.textContent = nombre;
    dd.textContent = String(valor);
    bloque.append(dt, dd);
    return bloque;
  }));
}

function pintarHistorial(partidas) {
  const cuerpo = $('#tabla-historial tbody');
  cuerpo.replaceChildren(...partidas.map((p) => {
    const fila = document.createElement('tr');
    const celdas = [
      fecha(p.fecha),
      p.oponente === 'maquina' ? 'Máquina' : 'Otro jugador',
      textoResultado(p),
      String(p.disparos),
      pct(p.porcentajeAcierto),
    ];
    for (const texto of celdas) {
      const td = document.createElement('td');
      td.textContent = texto;
      fila.append(td);
    }
    fila.children[2].className = `resultado-${p.resultado}`;
    return fila;
  }));
  $('#tabla-historial').hidden = partidas.length === 0;
  $('#historial-vacio').hidden = partidas.length > 0;
}

// RF-20: la fila del propio jugador se resalta (esSolicitante lo decide el servidor).
function pintarClasificacion(filas) {
  const cuerpo = $('#tabla-clasificacion tbody');
  cuerpo.replaceChildren(...filas.map((f) => {
    const fila = document.createElement('tr');
    if (f.esSolicitante) fila.className = 'fila-propia';
    for (const texto of [f.posicion, f.esSolicitante ? `${f.nombre} (tú)` : f.nombre, f.ganadas, f.jugadas,
      pct(f.porcentajeVictorias), pct(f.porcentajeAcierto)]) {
      const td = document.createElement('td');
      td.textContent = String(texto);
      fila.append(td);
    }
    return fila;
  }));
  $('#tabla-clasificacion').hidden = filas.length === 0;
  $('#clasificacion-vacia').hidden = filas.length > 0;
}

async function cargarClasificacion() {
  try {
    pintarClasificacion(await api.clasificacion());
  } catch (error) {
    ui.mostrarError(error);
  }
}

async function cargar() {
  const id = usuarioConsultado?.id;
  $('#historial-titulo').textContent = usuarioConsultado ? `Partidas de ${usuarioConsultado.email}` : 'Mis partidas';
  $('#boton-historial-propio').hidden = !usuarioConsultado;
  try {
    const [estadisticas, historial] = await Promise.all([api.estadisticasPartidas(id), api.historialPartidas(id)]);
    pintarEstadisticas(estadisticas);
    pintarHistorial(historial);
  } catch (error) {
    ui.mostrarError(error);
  }
}

export function prepararHistorial({ mostrarError }) {
  ui = { mostrarError };
  document.addEventListener('partida:terminada', () => {
    if (!usuarioConsultado) cargar();
    cargarClasificacion();
  });
  $('#boton-historial-propio').addEventListener('click', () => { usuarioConsultado = null; cargar(); });
}

export async function mostrarHistorial() {
  usuarioConsultado = null;
  $('#seccion-historial').hidden = false;
  $('#seccion-clasificacion').hidden = false;
  await Promise.all([cargar(), cargarClasificacion()]);
}

// Administrador: partidas de otro usuario (RF-18).
export async function mostrarHistorialDe(usuario) {
  usuarioConsultado = { id: usuario.id, email: usuario.email };
  $('#seccion-historial').hidden = false;
  await cargar();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

export function ocultarHistorial() {
  usuarioConsultado = null;
  $('#seccion-historial').hidden = true;
  $('#seccion-clasificacion').hidden = true;
}
