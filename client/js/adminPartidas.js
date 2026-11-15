// FRONTEND — CAPA DE PRESENTACIÓN: gestión de partidas del administrador
// (Hito 6, RF-21).
//
// Lista las partidas en curso de todos los jugadores y permite anular una.
// Mostrar esta sección solo al administrador es comodidad: el rol lo
// comprueba el servidor en cada petición. Habla con el servidor únicamente a
// través de api.js.

import * as api from './api.js';
import { confirmar } from './dialogo.js';

const $ = (selector) => document.querySelector(selector);

let ui = { avisar: () => {}, mostrarError: () => {} };

const formatoFecha = new Intl.DateTimeFormat('es-ES', { dateStyle: 'short', timeStyle: 'short' });
const fecha = (iso) => (iso ? formatoFecha.format(new Date(iso)) : '—');
const TEXTO_ESTADO = { colocando: 'Colocando barcos', en_juego: 'En juego', terminada: 'Terminada' };
const nombreJugador = (j) => (j === 'maquina' ? 'Máquina' : j);

function pintar(partidas) {
  const cuerpo = $('#tabla-admin-partidas tbody');
  cuerpo.replaceChildren(...partidas.map((p) => {
    const fila = document.createElement('tr');
    for (const texto of [
      p.jugadores.map(nombreJugador).join(' contra '),
      TEXTO_ESTADO[p.estado] ?? p.estado,
      String(p.disparos),
      fecha(p.creadaEn),
      fecha(p.actualizadaEn),
    ]) {
      const td = document.createElement('td');
      td.textContent = texto;
      fila.append(td);
    }
    const acciones = document.createElement('td');
    acciones.className = 'celda-acciones';
    const boton = document.createElement('button');
    boton.type = 'button';
    boton.className = 'boton-peligro';
    boton.textContent = 'Anular';
    boton.addEventListener('click', () => anular(p));
    acciones.append(boton);
    fila.append(acciones);
    return fila;
  }));
  $('#tabla-admin-partidas').hidden = partidas.length === 0;
  $('#admin-partidas-vacio').hidden = partidas.length > 0;
  $('#total-partidas').textContent = `${partidas.length} partida${partidas.length === 1 ? '' : 's'}`;
}

async function cargar() {
  try {
    pintar(await api.partidasEnCurso());
  } catch (error) {
    ui.mostrarError(error);
  }
}

async function anular(partida) {
  const quien = partida.jugadores.map(nombreJugador).join(' contra ');
  const seguro = await confirmar({
    titulo: '¿Anular la partida?',
    mensaje: `${quien}. No contará en las estadísticas y no se puede deshacer.`,
    aceptar: 'Anular', peligro: true,
  });
  if (!seguro) return;
  try {
    await api.anularPartida(partida.id);
    ui.avisar('Partida anulada.', 'info');
  } catch (error) {
    ui.mostrarError(error);
  }
  await cargar();
}

export function prepararAdminPartidas({ avisar, mostrarError }) {
  ui = { avisar, mostrarError };
  $('#boton-recargar-partidas').addEventListener('click', cargar);
}

export async function mostrarAdminPartidas() {
  $('#seccion-admin-partidas').hidden = false;
  await cargar();
}

export function ocultarAdminPartidas() {
  $('#seccion-admin-partidas').hidden = true;
}
