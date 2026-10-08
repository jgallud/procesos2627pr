// FRONTEND — CAPA DE PRESENTACIÓN (interfaz gráfica).
//
// Gestiona el DOM: muestra vistas, lee formularios y enseña mensajes. Para
// hablar con el servidor usa exclusivamente el módulo api.js (la capa de
// comunicación); aquí no hay ningún fetch ni ninguna URL de la API.
//
// Ocultar botones según el rol es solo comodidad: las restricciones reales
// las aplica el servidor en cada petición.

import * as api from './api.js';

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
}

function avisar(texto, tipo = 'info') {
  const aviso = $('#aviso');
  aviso.textContent = texto;
  aviso.className = `aviso aviso-${tipo}`;
  aviso.hidden = !texto;
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

function elegirPestana(nombre) {
  for (const pestana of document.querySelectorAll('[data-pestana]')) {
    const activa = pestana.dataset.pestana === nombre;
    pestana.setAttribute('aria-selected', String(activa));
    $(`#form-${pestana.dataset.pestana}`).hidden = !activa;
  }
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
    avisar(`Cuenta creada para ${usuario.email}. Confirma tu cuenta con el enlace de confirmación antes de iniciar sesión.`, 'exito');
  } catch (error) {
    mostrarError(error);
  }
}

// --- Panel del usuario --------------------------------------------------------

async function entrarEnPanel(usuario) {
  usuarioActual = usuario;
  $('#perfil-nombre').textContent = usuario.nombre || usuario.email;
  $('#perfil-email').textContent = usuario.email;
  $('#perfil-rol').textContent = usuario.rol;
  const esAdmin = usuario.rol === 'administrador';
  $('#seccion-admin').hidden = !esAdmin;
  mostrarVista('panel');
  if (esAdmin) await cargarUsuarios();
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
  mostrarVista('acceso');
  elegirPestana('entrar');
  avisar('Has cerrado la sesión.', 'info');
}

async function alEliminarMiCuenta() {
  if (!window.confirm('¿Seguro que quieres eliminar tu cuenta? No podrás volver a iniciar sesión.')) return;
  limpiarAviso();
  try {
    await api.eliminarUsuario(usuarioActual.id);
    usuarioActual = null;
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
    ? 'Vas a eliminar tu propia cuenta de administrador y se cerrará tu sesión. ¿Continuar?'
    : `¿Eliminar la cuenta de ${usuario.email}?`;
  if (!window.confirm(pregunta)) return;
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

async function comprobarServidor() {
  const indicador = $('#estado-servidor');
  try {
    const { estado } = await api.salud();
    indicador.textContent = estado;
  } catch {
    indicador.textContent = 'sin conexión';
  }
}

function enlazarEventos() {
  for (const pestana of document.querySelectorAll('[data-pestana]')) {
    pestana.addEventListener('click', () => { limpiarAviso(); elegirPestana(pestana.dataset.pestana); });
  }
  $('#form-entrar').addEventListener('submit', alIniciarSesion);
  $('#form-registro').addEventListener('submit', alRegistrarse);
  $('#boton-salir').addEventListener('click', alCerrarSesion);
  $('#boton-eliminar-cuenta').addEventListener('click', alEliminarMiCuenta);
  $('#boton-recargar-usuarios').addEventListener('click', cargarUsuarios);
}

async function iniciar() {
  enlazarEventos();
  elegirPestana('entrar');
  comprobarServidor();
  await confirmarSiProcede();
  await recuperarSesion();
}

iniciar();
