// Utilidad de pruebas: compone las capas como server/index.js, pero con
// repositorios en memoria y un notificador falso que guarda los tokens de
// confirmación (en lugar de escribirlos en el log).

const { crearApp } = require('../../server/app');
const { crearServicioUsuarios } = require('../../server/logic/usuarioService');
const { crearServicioSesiones } = require('../../server/logic/sesionService');
const { crearRepositorioUsuariosMemoria } = require('../../server/data/usuarioRepositorioMemoria');
const { crearRepositorioSesionesMemoria } = require('../../server/data/sesionRepositorioMemoria');

const CLAVE = 'contrasena-segura';
const CLAVE_ADMIN = 'clave-del-admin';

function montar({ cookieSegura = false } = {}) {
  const tokens = new Map();
  const notificador = { async enviarConfirmacion({ email, token }) { tokens.set(email, token); } };
  const servicioUsuarios = crearServicioUsuarios({ repositorio: crearRepositorioUsuariosMemoria(), notificador });
  const servicioSesiones = crearServicioSesiones({ repositorio: crearRepositorioSesionesMemoria() });
  const app = crearApp({ servicioUsuarios, servicioSesiones, cookieSegura });

  // Registra y confirma un usuario normal directamente en la capa lógica.
  async function usuarioActivo(email) {
    const u = await servicioUsuarios.registrarUsuario({ email, contrasena: CLAVE });
    return servicioUsuarios.confirmarCuenta(tokens.get(u.email));
  }

  return { app, servicioUsuarios, servicioSesiones, tokens, usuarioActivo };
}

module.exports = { montar, CLAVE, CLAVE_ADMIN };
