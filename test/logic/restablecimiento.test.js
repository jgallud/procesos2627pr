// Pruebas unitarias de la recuperación de contraseña (MJ-12): enlace de un
// solo uso que caduca a la hora, sin revelar qué emails están registrados.

const { describe, it, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const { crearServicioUsuarios } = require('../../server/logic/usuarioService');
const { crearRepositorioUsuariosMemoria } = require('../../server/data/usuarioRepositorioMemoria');
const { CODIGOS } = require('../../server/logic/errores');

const CLAVE = 'contrasena-segura';
const NUEVA = 'otra-contrasena-nueva';
const rechazaCon = (codigo) => (err) => err.name === 'ErrorDominio' && err.codigo === codigo;

describe('Recuperar la contraseña (MJ-12)', () => {
  let servicio;
  let repositorio;
  let ahora;
  const confirmaciones = new Map();
  let enlaces; // email -> token del último enlace para restablecer

  beforeEach(async () => {
    ahora = Date.UTC(2026, 10, 15, 10);
    enlaces = new Map();
    repositorio = crearRepositorioUsuariosMemoria();
    servicio = crearServicioUsuarios({
      repositorio,
      reloj: () => new Date(ahora),
      notificador: {
        async enviarConfirmacion({ email, token }) { confirmaciones.set(email, token); },
        async enviarRestablecimiento({ email, token }) { enlaces.set(email, token); },
      },
    });
    const ana = await servicio.registrarUsuario({ email: 'ana@ejemplo.com', contrasena: CLAVE });
    await servicio.confirmarCuenta(confirmaciones.get(ana.email));
  });

  it('envía un enlace y con él se fija una contraseña nueva; la anterior deja de valer', async () => {
    await servicio.solicitarRestablecimiento({ email: ' Ana@Ejemplo.com ' });
    const token = enlaces.get('ana@ejemplo.com');
    assert.ok(token);
    const usuario = await servicio.restablecerContrasena({ token, contrasena: NUEVA });
    assert.equal(usuario.email, 'ana@ejemplo.com');
    assert.equal(usuario.hashContrasena, undefined, 'no sale ningún hash');
    assert.equal((await servicio.iniciarSesion({ email: 'ana@ejemplo.com', contrasena: NUEVA })).email, 'ana@ejemplo.com');
    await assert.rejects(servicio.iniciarSesion({ email: 'ana@ejemplo.com', contrasena: CLAVE }), rechazaCon(CODIGOS.CREDENCIALES_INVALIDAS));
  });

  it('el enlace solo vale una vez', async () => {
    await servicio.solicitarRestablecimiento({ email: 'ana@ejemplo.com' });
    const token = enlaces.get('ana@ejemplo.com');
    await servicio.restablecerContrasena({ token, contrasena: NUEVA });
    await assert.rejects(servicio.restablecerContrasena({ token, contrasena: 'y-otra-mas-larga' }), rechazaCon(CODIGOS.TOKEN_INVALIDO));
  });

  it('el enlace caduca a la hora', async () => {
    await servicio.solicitarRestablecimiento({ email: 'ana@ejemplo.com' });
    ahora += 60 * 60 * 1000 + 1;
    await assert.rejects(
      servicio.restablecerContrasena({ token: enlaces.get('ana@ejemplo.com'), contrasena: NUEVA }),
      rechazaCon(CODIGOS.TOKEN_INVALIDO),
    );
  });

  it('pedir otro enlace invalida el anterior', async () => {
    await servicio.solicitarRestablecimiento({ email: 'ana@ejemplo.com' });
    const viejo = enlaces.get('ana@ejemplo.com');
    await servicio.solicitarRestablecimiento({ email: 'ana@ejemplo.com' });
    await assert.rejects(servicio.restablecerContrasena({ token: viejo, contrasena: NUEVA }), rechazaCon(CODIGOS.TOKEN_INVALIDO));
    await servicio.restablecerContrasena({ token: enlaces.get('ana@ejemplo.com'), contrasena: NUEVA });
  });

  it('no envía nada a un email sin cuenta, pendiente, eliminado o de Google, y no da error', async () => {
    await servicio.registrarUsuario({ email: 'pendiente@ejemplo.com', contrasena: CLAVE });
    await servicio.iniciarSesionOAuth({ email: 'google@ejemplo.com', nombre: 'G', emailVerificado: true });
    for (const email of ['nadie@ejemplo.com', 'pendiente@ejemplo.com', 'google@ejemplo.com']) {
      await servicio.solicitarRestablecimiento({ email });
    }
    assert.equal(enlaces.size, 0);
    await assert.rejects(servicio.solicitarRestablecimiento({ email: 'no-es-un-email' }), rechazaCon(CODIGOS.DATOS_INVALIDOS));
  });

  it('rechaza una contraseña nueva demasiado corta y un token inventado', async () => {
    await servicio.solicitarRestablecimiento({ email: 'ana@ejemplo.com' });
    const token = enlaces.get('ana@ejemplo.com');
    await assert.rejects(servicio.restablecerContrasena({ token, contrasena: 'corta' }), rechazaCon(CODIGOS.DATOS_INVALIDOS));
    await assert.rejects(servicio.restablecerContrasena({ token: `${token.split('.')[0]}.inventado`, contrasena: NUEVA }), rechazaCon(CODIGOS.TOKEN_INVALIDO));
    await assert.rejects(servicio.restablecerContrasena({ token: 'sin-punto', contrasena: NUEVA }), rechazaCon(CODIGOS.TOKEN_INVALIDO));
    // El enlace bueno sigue valiendo tras los intentos fallidos.
    await servicio.restablecerContrasena({ token, contrasena: NUEVA });
  });
});
