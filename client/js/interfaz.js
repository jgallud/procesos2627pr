// FRONTEND — CAPA DE PRESENTACIÓN (interfaz gráfica).
//
// Gestiona el DOM: muestra vistas, lee formularios y enseña mensajes. Para
// hablar con el servidor usa exclusivamente el módulo api.js (la capa de
// comunicación); aquí no hay ningún fetch ni ninguna URL de la API.
//
// Ocultar botones según el rol es solo comodidad: las restricciones reales
// las aplica el servidor en cada petición.

import * as api from './api.js';
import { confirmar } from './dialogo.js';
import { prepararJuego, mostrarJuego, ocultarJuego } from './juego.js';
import {
  prepararHistorial, mostrarHistorial, mostrarHistorialDe, ocultarHistorial,
} from './historial.js';
import { prepararAdminPartidas, mostrarAdminPartidas, ocultarAdminPartidas } from './adminPartidas.js';

const $ = (selector) => document.querySelector(selector);

const vistas = {
  cargando: $('#vista-cargando'),
  acceso: $('#vista-acceso'),
  panel: $('#vista-panel'),
};

let usuarioActual = null;

// --- Utilidades de presentación -------------------------------------------

function mostrarVista(nombre) {
  for (const [clave, elemento] of Object.entries(vistas)) {
    elemento.hidden = clave !== nombre;
  }
  $('#menu').hidden = nombre !== 'panel'; // el menú solo tiene sentido con sesión (MJ-05)
  $('#menu-cuenta').hidden = nombre !== 'panel';
}

// MJ-07: el aviso flota sobre la página (no desplaza nada). Los informativos
// se ocultan solos; los de error se quedan hasta cerrarlos o hasta el
// siguiente aviso, para que dé tiempo a leerlos.
const DURACION_AVISO_MS = 6000;
let temporizadorAviso = null;

function avisar(texto, tipo = 'info') {
  const aviso = $('#aviso');
  clearTimeout(temporizadorAviso);
  $('#aviso-texto').textContent = texto;
  aviso.className = `aviso aviso-${tipo}`;
  aviso.setAttribute('role', tipo === 'error' ? 'alert' : 'status');
  aviso.hidden = !texto;
  if (texto && tipo !== 'error') temporizadorAviso = setTimeout(() => { aviso.hidden = true; }, DURACION_AVISO_MS);
}

// --- Menú del panel (MJ-05 y MJ-06) ---------------------------------------
// Cada opción del menú muestra una sección del panel. La sección va en la URL
// (#jugar, #estadisticas, #administracion): así funcionan el botón «atrás»,
// recargar la página y el enlace de la marca, que lleva a #jugar.

const SECCIONES = ['jugar', 'estadisticas', 'cuenta', 'administracion'];

function seccionPedida() {
  const nombre = window.location.hash.slice(1);
  const permitida = SECCIONES.includes(nombre) && (nombre !== 'administracion' || usuarioActual?.rol === 'administrador');
  return permitida ? nombre : 'jugar';
}

// Muestra una sección. Con `recargar`, vuelve a pedir sus datos al servidor
// (las estadísticas y la clasificación pueden haber cambiado por otros jugadores).
async function mostrarSeccion(nombre, { recargar = true } = {}) {
  for (const panel of document.querySelectorAll('[data-panel]')) panel.hidden = panel.dataset.panel !== nombre;
  for (const enlace of document.querySelectorAll('[data-menu]')) {
    if (enlace.dataset.menu === nombre) enlace.setAttribute('aria-current', 'page');
    else enlace.removeAttribute('aria-current');
  }
  if (!recargar) return;
  if (nombre === 'estadisticas') await mostrarHistorial();
  if (nombre === 'administracion') await Promise.all([cargarUsuarios(), mostrarAdminPartidas()]);
}

// Lleva a una sección cambiando la URL sin disparar hashchange.
function irA(nombre, opciones) {
  if (window.location.hash !== `#${nombre}`) window.history.pushState(null, '', `#${nombre}`);
  return mostrarSeccion(nombre, opciones);
}

function alCambiarHash() {
  if (usuarioActual) mostrarSeccion(seccionPedida());
}

const limpiarAviso = () => avisar('');

// Desactiva el botón de un formulario mientras se espera al servidor.
async function conBotonOcupado(boton, accion) {
  const textoOriginal = boton.textContent;
  boton.disabled = true;
  boton.textContent = 'Un momento…';
  try {
    return await accion();
  } finally {
    boton.disabled = false;
    boton.textContent = textoOriginal;
  }
}

// Muestra un error de la API. Si la sesión ya no es válida, vuelve al acceso.
function mostrarError(error) {
  if (error instanceof api.ErrorApi && error.sinSesion && usuarioActual) {
    usuarioActual = null;
    ocultarSecciones();
    mostrarVista('acceso');
    avisar('Tu sesión ha caducado o ya no es válida. Vuelve a iniciar sesión.', 'error');
    return;
  }
  const texto = error instanceof api.ErrorApi ? error.message : 'Ha ocurrido un error inesperado.';
  if (!(error instanceof api.ErrorApi)) console.error(error);
  avisar(texto, 'error');
}

const formatearFecha = (iso) => (iso ? new Date(iso).toLocaleString('es-ES') : '');

// --- Acceso: inicio de sesión y registro ------------------------------------

// Formularios de la pantalla de acceso: los dos de las pestañas y los de
// recuperar la contraseña (MJ-12), que no tienen pestaña propia.
const FORMULARIOS_ACCESO = ['entrar', 'registro', 'olvido', 'restablecer'];

function elegirPestana(nombre) {
  for (const formulario of FORMULARIOS_ACCESO) $(`#form-${formulario}`).hidden = formulario !== nombre;
  for (const pestana of document.querySelectorAll('[data-pestana]')) {
    pestana.setAttribute('aria-selected', String(pestana.dataset.pestana === nombre));
  }
  // El acceso con Google solo junto al formulario de inicio de sesión.
  $('#acceso-externo').classList.toggle('oculto-fuera-de-entrar', nombre !== 'entrar');
}

// --- Recuperar la contraseña (MJ-12) ------------------------------------------

let tokenRestablecimiento = null;

async function alPedirRestablecimiento(evento) {
  evento.preventDefault();
  const form = evento.currentTarget;
  limpiarAviso();
  try {
    await conBotonOcupado(form.querySelector('button[type="submit"]'), () => api.pedirRestablecimiento(form.email.value));
    const email = form.email.value;
    form.reset();
    elegirPestana('entrar');
    $('#form-entrar').email.value = email;
    avisar(`Si ${email} corresponde a una cuenta, te hemos enviado un enlace para cambiar la contraseña (revisa también la carpeta de spam).`, 'exito');
  } catch (error) {
    mostrarError(error);
  }
}

async function alRestablecer(evento) {
  evento.preventDefault();
  const form = evento.currentTarget;
  limpiarAviso();
  if (form.contrasena.value !== form.repetir.value) {
    avisar('Las contraseñas no coinciden.', 'error');
    return;
  }
  try {
    const usuario = await conBotonOcupado(form.querySelector('button[type="submit"]'), () =>
      api.restablecerContrasena({ token: tokenRestablecimiento, contrasena: form.contrasena.value }));
    tokenRestablecimiento = null;
    form.reset();
    elegirPestana('entrar');
    $('#form-entrar').email.value = usuario.email;
    avisar('Contraseña cambiada. Ya puedes iniciar sesión con la nueva.', 'exito');
  } catch (error) {
    mostrarError(error);
  }
}

// Al abrir el enlace del correo (?restablecer=<token>): se muestra el
// formulario de la contraseña nueva y se quita el token de la URL.
function restablecerSiProcede() {
  const token = new URLSearchParams(window.location.search).get('restablecer');
  if (!token) return false;
  window.history.replaceState(null, '', window.location.pathname);
  tokenRestablecimiento = token;
  return true;
}

async function alIniciarSesion(evento) {
  evento.preventDefault();
  const form = evento.currentTarget;
  limpiarAviso();
  try {
    const usuario = await conBotonOcupado(form.querySelector('button'), () =>
      api.iniciarSesion({ email: form.email.value, contrasena: form.contrasena.value }));
    form.reset();
    await entrarEnPanel(usuario);
  } catch (error) {
    mostrarError(error);
  }
}

async function alRegistrarse(evento) {
  evento.preventDefault();
  const form = evento.currentTarget;
  limpiarAviso();
  if (form.contrasena.value !== form.repetir.value) {
    avisar('Las contraseñas no coinciden.', 'error');
    return;
  }
  try {
    const usuario = await conBotonOcupado(form.querySelector('button'), () =>
      api.registrar({ email: form.email.value, nombre: form.nombre.value, contrasena: form.contrasena.value }));
    form.reset();
    elegirPestana('entrar');
    $('#form-entrar').email.value = usuario.email;
    avisar(`Cuenta creada para ${usuario.email}. Te hemos enviado un correo con el enlace para confirmarla (revisa también la carpeta de spam). Después podrás iniciar sesión.`, 'exito');
  } catch (error) {
    mostrarError(error);
  }
}

// --- Panel del usuario --------------------------------------------------------

// Al salir del panel: el juego y el historial dejan de mostrarse.
function ocultarSecciones() {
  ocultarJuego();
  ocultarHistorial();
  ocultarAdminPartidas();
}

async function entrarEnPanel(usuario) {
  usuarioActual = usuario;
  $('#menu-cuenta-nombre').textContent = usuario.nombre || usuario.email.split('@')[0];
  // Mi cuenta (MJ-01)
  $('#cuenta-nombre').textContent = usuario.nombre || '—';
  $('#cuenta-email').textContent = usuario.email;
  $('#cuenta-rol').textContent = usuario.rol;
  $('#cuenta-origen').textContent = usuario.origen === 'oauth' ? 'Google' : 'Email y contraseña';
  $('#cuenta-alta').textContent = formatearFecha(usuario.creadoEn);
  const esAdmin = usuario.rol === 'administrador';
  $('#seccion-admin').hidden = !esAdmin;
  $('[data-menu="administracion"]').hidden = !esAdmin;
  mostrarVista('panel');
  mostrarSeccion(seccionPedida(), { recargar: false });
  await Promise.all([mostrarJuego(), mostrarHistorial()]);
  if (esAdmin) await Promise.all([cargarUsuarios(), mostrarAdminPartidas()]);
  else ocultarAdminPartidas();
}

async function alCerrarSesion() {
  limpiarAviso();
  try {
    await api.cerrarSesion();
  } catch (error) {
    // Aunque falle la red, la interfaz vuelve al acceso; la cookie se
    // invalidará en el servidor al caducar.
    if (!(error instanceof api.ErrorApi && error.sinSesion)) mostrarError(error);
  }
  usuarioActual = null;
  ocultarSecciones();
  mostrarVista('acceso');
  elegirPestana('entrar');
  avisar('Has cerrado la sesión.', 'info');
}

async function alEliminarMiCuenta() {
  const seguro = await confirmar({
    titulo: '¿Eliminar tu cuenta?',
    mensaje: 'No podrás volver a iniciar sesión con ella. No se puede deshacer.',
    aceptar: 'Eliminar mi cuenta', peligro: true,
  });
  if (!seguro) return;
  limpiarAviso();
  try {
    await api.eliminarUsuario(usuarioActual.id);
    usuarioActual = null;
    ocultarSecciones();
    mostrarVista('acceso');
    avisar('Tu cuenta ha sido eliminada.', 'info');
  } catch (error) {
    mostrarError(error);
  }
}

// --- Administración de usuarios ---------------------------------------------

function crearBoton(texto, clase, accion) {
  const boton = document.createElement('button');
  boton.type = 'button';
  boton.className = clase;
  boton.textContent = texto;
  boton.addEventListener('click', accion);
  return boton;
}

function celda(texto, clase) {
  const td = document.createElement('td');
  td.textContent = texto;
  if (clase) td.className = clase;
  return td;
}

function pintarUsuarios(usuarios) {
  const cuerpo = $('#tabla-usuarios tbody');
  cuerpo.replaceChildren();
  for (const u of usuarios) {
    const fila = document.createElement('tr');
    const resultado = celda('', 'resultado-activo');
    fila.append(
      celda(u.email),
      celda(u.nombre || '—'),
      celda(u.rol),
      celda(u.estado, `estado estado-${u.estado}`),
      celda(formatearFecha(u.creadoEn)),
    );

    const acciones = document.createElement('td');
    acciones.className = 'celda-acciones';
    acciones.append(crearBoton('¿Activo?', 'boton-secundario', async () => {
      try {
        const { activo } = await api.estaActivo(u.id);
        resultado.textContent = activo ? 'Sí, activo' : 'No activo';
        resultado.dataset.activo = String(activo);
      } catch (error) {
        mostrarError(error);
      }
    }));
    acciones.append(crearBoton('Partidas', 'boton-secundario', async () => {
      await irA('estadisticas', { recargar: false });
      await mostrarHistorialDe(u);
    }));
    if (u.estado !== 'eliminado') {
      acciones.append(crearBoton('Eliminar', 'boton-peligro', () => eliminarDesdeAdmin(u)));
    }
    fila.append(acciones, resultado);
    cuerpo.append(fila);
  }
  $('#total-usuarios').textContent = `${usuarios.length} usuario${usuarios.length === 1 ? '' : 's'}`;
}

async function cargarUsuarios() {
  try {
    pintarUsuarios(await api.listarUsuarios());
  } catch (error) {
    mostrarError(error);
  }
}

async function eliminarDesdeAdmin(usuario) {
  const propio = usuario.id === usuarioActual.id;
  const pregunta = propio
    ? 'Es tu propia cuenta de administrador: se cerrará tu sesión.'
    : `${usuario.email} no podrá volver a iniciar sesión.`;
  if (!(await confirmar({ titulo: '¿Eliminar la cuenta?', mensaje: pregunta, aceptar: 'Eliminar', peligro: true }))) return;
  limpiarAviso();
  try {
    await api.eliminarUsuario(usuario.id);
    if (propio) {
      usuarioActual = null;
      mostrarVista('acceso');
      avisar('Tu cuenta ha sido eliminada.', 'info');
      return;
    }
    avisar(`Se ha eliminado la cuenta de ${usuario.email}.`, 'exito');
    await cargarUsuarios();
  } catch (error) {
    mostrarError(error);
  }
}

// --- Arranque ---------------------------------------------------------------

// Si la página se abre desde el enlace de confirmación (?confirmar=<token>),
// se confirma la cuenta y se limpia la URL para no repetirlo al recargar.
async function confirmarSiProcede() {
  const parametros = new URLSearchParams(window.location.search);
  const token = parametros.get('confirmar');
  if (!token) return;
  window.history.replaceState(null, '', window.location.pathname);
  try {
    const usuario = await api.confirmarCuenta(token);
    avisar(`Cuenta ${usuario.email} confirmada. Ya puedes iniciar sesión.`, 'exito');
    $('#form-entrar').email.value = usuario.email;
  } catch (error) {
    mostrarError(error);
  }
}

// Muestra el botón de cada proveedor externo configurado en el servidor.
async function mostrarAccesoExterno() {
  try {
    const { proveedores } = await api.proveedoresOAuth();
    if (!proveedores.includes('google')) return;
    $('#boton-google').href = api.urlInicioOAuth('google');
    $('#acceso-externo').hidden = false;
  } catch {
    // Sin la lista de proveedores, simplemente no se ofrece el acceso externo.
  }
}

// Si se vuelve del proveedor externo con un error (?error_oauth=<código>), se
// explica al usuario y se limpia la URL.
const MENSAJES_OAUTH = {
  CUENTA_LOCAL: 'Ya tienes una cuenta con ese email. Inicia sesión con tu contraseña.',
  CUENTA_ELIMINADA: 'Esta cuenta ha sido eliminada.',
  EMAIL_NO_VERIFICADO: 'Google no ha verificado tu email, así que no se puede usar para entrar.',
  OAUTH_CANCELADO: 'Has cancelado el inicio de sesión con Google.',
};
function avisarErrorOAuthSiProcede() {
  const codigo = new URLSearchParams(window.location.search).get('error_oauth');
  if (!codigo) return;
  window.history.replaceState(null, '', window.location.pathname);
  avisar(MENSAJES_OAUTH[codigo] || 'No se pudo iniciar sesión con Google. Inténtalo de nuevo.', 'error');
}

// Al cargar (o recargar) la página se pregunta al servidor si ya hay sesión:
// así un usuario que ya entró no tiene que volver a autenticarse.
async function recuperarSesion() {
  try {
    await entrarEnPanel(await api.sesionActual());
  } catch (error) {
    mostrarVista('acceso');
    if (!(error instanceof api.ErrorApi && error.sinSesion)) mostrarError(error);
  }
}

// MJ-11: el estado del servidor ya no ocupa la cabecera; solo se avisa si no
// responde, que es cuando le sirve al usuario saberlo.
async function comprobarServidor() {
  try {
    await api.salud();
  } catch {
    avisar('No se puede conectar con el servidor. Comprueba tu conexión y recarga la página.', 'error');
  }
}

function enlazarEventos() {
  $('#aviso-cerrar').addEventListener('click', () => { clearTimeout(temporizadorAviso); $('#aviso').hidden = true; });
  window.addEventListener('hashchange', alCambiarHash);
  for (const pestana of document.querySelectorAll('[data-pestana]')) {
    pestana.addEventListener('click', () => { limpiarAviso(); elegirPestana(pestana.dataset.pestana); });
  }
  $('#form-entrar').addEventListener('submit', alIniciarSesion);
  $('#form-registro').addEventListener('submit', alRegistrarse);
  $('#form-olvido').addEventListener('submit', alPedirRestablecimiento);
  $('#form-restablecer').addEventListener('submit', alRestablecer);
  $('#boton-olvido').addEventListener('click', () => {
    limpiarAviso();
    elegirPestana('olvido');
    $('#form-olvido').email.value = $('#form-entrar').email.value;
  });
  for (const boton of document.querySelectorAll('[data-volver-a-entrar]')) {
    boton.addEventListener('click', () => { limpiarAviso(); elegirPestana('entrar'); });
  }
  $('#boton-salir').addEventListener('click', alCerrarSesion);
  $('#boton-eliminar-cuenta').addEventListener('click', alEliminarMiCuenta);
  $('#boton-recargar-usuarios').addEventListener('click', cargarUsuarios);
}

async function iniciar() {
  enlazarEventos();
  prepararJuego({ avisar, mostrarError });
  prepararHistorial({ mostrarError });
  prepararAdminPartidas({ avisar, mostrarError });
  elegirPestana('entrar');
  comprobarServidor();
  mostrarAccesoExterno();
  avisarErrorOAuthSiProcede();
  await confirmarSiProcede();
  // Con el enlace para cambiar la contraseña se muestra ese formulario, aunque
  // haya una sesión abierta en este navegador (MJ-12).
  if (restablecerSiProcede()) {
    mostrarVista('acceso');
    elegirPestana('restablecer');
    return;
  }
  await recuperarSesion();
}

iniciar();
