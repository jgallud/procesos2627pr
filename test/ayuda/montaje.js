// Utilidad de pruebas: compone las capas como server/index.js, pero con
// repositorios en memoria y un notificador falso que guarda los tokens de
// confirmación (en lugar de escribirlos en el log).

const { crearApp } = require('../../server/app');
const { crearServicioUsuarios } = require('../../server/logic/usuarioService');
const { crearServicioSesiones } = require('../../server/logic/sesionService');
const { crearRepositorioUsuariosMemoria } = require('../../server/data/usuarioRepositorioMemoria');
const { crearRepositorioSesionesMemoria } = require('../../server/data/sesionRepositorioMemoria');
const { crearServicioPartidas } = require('../../server/logic/partidaService');
const { crearRepositorioPartidasMemoria } = require('../../server/data/partidaRepositorioMemoria');

const CLAVE = 'contrasena-segura';
const CLAVE_ADMIN = 'clave-del-admin';

function montar({ cookieSegura = false, proveedoresOAuth, azar } = {}) {
  const tokens = new Map();
  const notificador = { async enviarConfirmacion({ email, token }) { tokens.set(email, token); } };
  const servicioUsuarios = crearServicioUsuarios({ repositorio: crearRepositorioUsuariosMemoria(), notificador });
  const servicioSesiones = crearServicioSesiones({ repositorio: crearRepositorioSesionesMemoria() });
  const repositorioPartidas = crearRepositorioPartidasMemoria();
  const servicioPartidas = crearServicioPartidas({ repositorio: repositorioPartidas, servicioUsuarios, azar });
  const app = crearApp({ servicioUsuarios, servicioSesiones, servicioPartidas, proveedoresOAuth, cookieSegura });

  // Registra y confirma un usuario normal directamente en la capa lógica.
  async function usuarioActivo(email) {
    const u = await servicioUsuarios.registrarUsuario({ email, contrasena: CLAVE });
    return servicioUsuarios.confirmarCuenta(tokens.get(u.email));
  }

  return { app, servicioUsuarios, servicioSesiones, servicioPartidas, repositorioPartidas, tokens, usuarioActivo };
}

module.exports = { montar, CLAVE, CLAVE_ADMIN };
