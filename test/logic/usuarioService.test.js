// Pruebas unitarias de la capa lógica de gestión de usuarios.
// Usan el repositorio en memoria y un notificador falso que guarda los tokens
// de confirmación: no hay red, ni Express, ni base de datos, ni correo.

const { describe, it, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const { crearServicioUsuarios, ROLES, ESTADOS } = require('../../server/logic/usuarioService');
const { crearRepositorioUsuariosMemoria } = require('../../server/data/usuarioRepositorioMemoria');
const { CODIGOS } = require('../../server/logic/errores');

const CLAVE = 'contrasena-segura';
const CLAVE_ADMIN = 'clave-del-admin';

// Comprueba que una promesa se rechaza con un ErrorDominio del código indicado.
function rechazaCon(codigo) {
  return (err) => err.name === 'ErrorDominio' && err.codigo === codigo;
}

// Notificador falso: recuerda el último token enviado a cada email.
function crearNotificadorFalso() {
  const tokens = new Map();
  return {
    tokens,
    async enviarConfirmacion({ email, token }) { tokens.set(email, token); },
  };
}

describe('Servicio de usuarios', () => {
  let servicio;
  let repositorio;
  let notificador;
  let admin;

  const registrar = (email, extra = {}) =>
    servicio.registrarUsuario({ email, nombre: email.split('@')[0], contrasena: CLAVE, ...extra });

  // Registra y confirma un usuario normal.
  async function crearUsuarioActivo(email) {
    const u = await registrar(email);
    return servicio.confirmarCuenta(notificador.tokens.get(u.email));
  }

  beforeEach(async () => {
    repositorio = crearRepositorioUsuariosMemoria();
    notificador = crearNotificadorFalso();
    servicio = crearServicioUsuarios({ repositorio, notificador });
    admin = await servicio.asegurarAdministrador({ email: 'admin@ejemplo.com', contrasena: CLAVE_ADMIN });
  });

  describe('registrarUsuario', () => {
    it('crea un usuario con rol usuario y estado pendiente', async () => {
      const u = await registrar('ana@ejemplo.com', { nombre: 'Ana' });
      assert.ok(u.id);
      assert.equal(u.email, 'ana@ejemplo.com');
      assert.equal(u.nombre, 'Ana');
      assert.equal(u.rol, ROLES.USUARIO);
      assert.equal(u.estado, ESTADOS.PENDIENTE);
    });

    it('normaliza el email (espacios y mayúsculas)', async () => {
      const u = await registrar('  Ana@Ejemplo.COM ');
      assert.equal(u.email, 'ana@ejemplo.com');
    });

    it('rechaza un email ya registrado', async () => {
      await registrar('ana@ejemplo.com');
      await assert.rejects(registrar('ANA@ejemplo.com'), rechazaCon(CODIGOS.EMAIL_DUPLICADO));
    });

    it('rechaza un email con formato inválido o ausente', async () => {
      await assert.rejects(registrar('no-es-un-email'), rechazaCon(CODIGOS.DATOS_INVALIDOS));
      await assert.rejects(servicio.registrarUsuario({ contrasena: CLAVE }), rechazaCon(CODIGOS.DATOS_INVALIDOS));
    });

    it('exige una contraseña de al menos 8 caracteres', async () => {
      await assert.rejects(registrar('ana@ejemplo.com', { contrasena: undefined }), rechazaCon(CODIGOS.DATOS_INVALIDOS));
      await assert.rejects(registrar('ana@ejemplo.com', { contrasena: 'corta' }), rechazaCon(CODIGOS.DATOS_INVALIDOS));
    });

    it('guarda la contraseña con hash y nunca la devuelve', async () => {
      const u = await registrar('ana@ejemplo.com');
      const almacenado = await repositorio.buscarPorId(u.id);
      assert.ok(almacenado.hashContrasena);
      assert.notEqual(almacenado.hashContrasena, CLAVE);
      assert.ok(!JSON.stringify(almacenado).includes(CLAVE));
      assert.equal(u.hashContrasena, undefined);
      assert.equal(u.hashTokenConfirmacion, undefined);
    });

    it('envía un token de confirmación a través del notificador', async () => {
      const u = await registrar('ana@ejemplo.com');
      assert.ok(notificador.tokens.get('ana@ejemplo.com').startsWith(`${u.id}.`));
    });
  });

  describe('confirmarCuenta', () => {
    it('activa la cuenta con el token recibido', async () => {
      const u = await crearUsuarioActivo('ana@ejemplo.com');
      assert.equal(u.estado, ESTADOS.ACTIVO);
    });

    it('rechaza un token manipulado', async () => {
      const u = await registrar('ana@ejemplo.com');
      await assert.rejects(servicio.confirmarCuenta(`${u.id}.inventado`), rechazaCon(CODIGOS.TOKEN_INVALIDO));
      await assert.rejects(servicio.confirmarCuenta('basura'), rechazaCon(CODIGOS.TOKEN_INVALIDO));
      await assert.rejects(servicio.confirmarCuenta(undefined), rechazaCon(CODIGOS.TOKEN_INVALIDO));
      assert.equal(await servicio.estaActivo(admin.id, u.id), false);
    });

    it('un token no se puede usar dos veces', async () => {
      const u = await registrar('ana@ejemplo.com');
      const token = notificador.tokens.get(u.email);
      await servicio.confirmarCuenta(token);
      await assert.rejects(servicio.confirmarCuenta(token), rechazaCon(CODIGOS.TOKEN_INVALIDO));
    });
  });

  describe('iniciarSesion', () => {
    it('devuelve el usuario con credenciales correctas y cuenta activa', async () => {
      const ana = await crearUsuarioActivo('ana@ejemplo.com');
      const u = await servicio.iniciarSesion({ email: ' ANA@ejemplo.com', contrasena: CLAVE });
      assert.equal(u.id, ana.id);
      assert.equal(u.hashContrasena, undefined);
    });

    it('rechaza una contraseña incorrecta', async () => {
      await crearUsuarioActivo('ana@ejemplo.com');
      await assert.rejects(
        servicio.iniciarSesion({ email: 'ana@ejemplo.com', contrasena: 'otra-contrasena' }),
        rechazaCon(CODIGOS.CREDENCIALES_INVALIDAS),
      );
    });

    it('rechaza un email no registrado con el mismo error que una contraseña incorrecta', async () => {
      await assert.rejects(
        servicio.iniciarSesion({ email: 'nadie@ejemplo.com', contrasena: CLAVE }),
        rechazaCon(CODIGOS.CREDENCIALES_INVALIDAS),
      );
    });

    it('una cuenta pendiente de confirmar no puede iniciar sesión', async () => {
      await registrar('ana@ejemplo.com');
      await assert.rejects(
        servicio.iniciarSesion({ email: 'ana@ejemplo.com', contrasena: CLAVE }),
        rechazaCon(CODIGOS.CUENTA_PENDIENTE),
      );
    });

    it('una cuenta eliminada no puede volver a iniciar sesión', async () => {
      const ana = await crearUsuarioActivo('ana@ejemplo.com');
      await servicio.eliminarUsuario(ana.id, ana.id);
      await assert.rejects(
        servicio.iniciarSesion({ email: 'ana@ejemplo.com', contrasena: CLAVE }),
        rechazaCon(CODIGOS.CUENTA_ELIMINADA),
      );
    });

    it('exige email y contraseña', async () => {
      await assert.rejects(servicio.iniciarSesion({ email: 'ana@ejemplo.com' }), rechazaCon(CODIGOS.DATOS_INVALIDOS));
      await assert.rejects(servicio.iniciarSesion(), rechazaCon(CODIGOS.DATOS_INVALIDOS));
    });

    it('el administrador inicial entra con la contraseña configurada', async () => {
      const u = await servicio.iniciarSesion({ email: 'admin@ejemplo.com', contrasena: CLAVE_ADMIN });
      assert.equal(u.rol, ROLES.ADMINISTRADOR);
    });
  });

  describe('usuarioDeSesion', () => {
    it('devuelve el usuario activo asociado a la sesión', async () => {
      const ana = await crearUsuarioActivo('ana@ejemplo.com');
      assert.deepEqual(await servicio.usuarioDeSesion(ana.id), ana);
    });

    it('rechaza la sesión de un usuario eliminado después de entrar', async () => {
      const ana = await crearUsuarioActivo('ana@ejemplo.com');
      await servicio.eliminarUsuario(admin.id, ana.id);
      await assert.rejects(servicio.usuarioDeSesion(ana.id), rechazaCon(CODIGOS.NO_AUTENTICADO));
    });

    it('sin sesión se rechaza por no autenticado', async () => {
      await assert.rejects(servicio.usuarioDeSesion(undefined), rechazaCon(CODIGOS.NO_AUTENTICADO));
    });
  });

  describe('listarUsuarios', () => {
    it('el administrador obtiene email, rol y estado de cada usuario', async () => {
      await registrar('ana@ejemplo.com');
      const lista = await servicio.listarUsuarios(admin.id);
      assert.equal(lista.length, 2);
      for (const u of lista) {
        assert.ok(u.email);
        assert.ok(u.rol);
        assert.ok(u.estado);
        assert.equal(u.hashContrasena, undefined);
      }
    });

    it('un usuario normal no puede listar usuarios', async () => {
      const ana = await crearUsuarioActivo('ana@ejemplo.com');
      await assert.rejects(servicio.listarUsuarios(ana.id), rechazaCon(CODIGOS.PROHIBIDO));
    });

    it('sin solicitante se rechaza por no autenticado', async () => {
      await assert.rejects(servicio.listarUsuarios(undefined), rechazaCon(CODIGOS.NO_AUTENTICADO));
    });
  });

  describe('estaActivo', () => {
    it('un usuario pendiente de confirmar no está activo', async () => {
      const u = await registrar('ana@ejemplo.com');
      assert.equal(await servicio.estaActivo(admin.id, u.id), false);
    });

    it('un usuario que confirma su cuenta pasa a estar activo', async () => {
      const u = await crearUsuarioActivo('ana@ejemplo.com');
      assert.equal(await servicio.estaActivo(admin.id, u.id), true);
    });

    it('un usuario eliminado deja de estar activo', async () => {
      const u = await crearUsuarioActivo('ana@ejemplo.com');
      await servicio.eliminarUsuario(admin.id, u.id);
      assert.equal(await servicio.estaActivo(admin.id, u.id), false);
    });

    it('consultar un usuario inexistente es un error', async () => {
      await assert.rejects(servicio.estaActivo(admin.id, 'no-existe'), rechazaCon(CODIGOS.USUARIO_NO_ENCONTRADO));
    });

    it('un usuario normal no puede consultarlo', async () => {
      const ana = await crearUsuarioActivo('ana@ejemplo.com');
      await assert.rejects(servicio.estaActivo(ana.id, admin.id), rechazaCon(CODIGOS.PROHIBIDO));
    });
  });

  describe('eliminarUsuario', () => {
    it('el administrador puede eliminar a cualquier usuario', async () => {
      const u = await crearUsuarioActivo('ana@ejemplo.com');
      await servicio.eliminarUsuario(admin.id, u.id);
      const lista = await servicio.listarUsuarios(admin.id);
      assert.equal(lista.find((x) => x.id === u.id).estado, ESTADOS.ELIMINADO);
    });

    it('un usuario normal puede eliminar su propia cuenta', async () => {
      const ana = await crearUsuarioActivo('ana@ejemplo.com');
      await servicio.eliminarUsuario(ana.id, ana.id);
      assert.equal(await servicio.estaActivo(admin.id, ana.id), false);
    });

    it('un usuario normal no puede eliminar a otro usuario', async () => {
      const ana = await crearUsuarioActivo('ana@ejemplo.com');
      const luis = await crearUsuarioActivo('luis@ejemplo.com');
      await assert.rejects(servicio.eliminarUsuario(ana.id, luis.id), rechazaCon(CODIGOS.PROHIBIDO));
      assert.equal(await servicio.estaActivo(admin.id, luis.id), true);
    });

    it('un usuario eliminado ya no puede actuar como solicitante', async () => {
      const ana = await crearUsuarioActivo('ana@ejemplo.com');
      await servicio.eliminarUsuario(ana.id, ana.id);
      await assert.rejects(servicio.eliminarUsuario(ana.id, ana.id), rechazaCon(CODIGOS.NO_AUTENTICADO));
    });

    it('eliminar dos veces al mismo usuario es un error', async () => {
      const u = await crearUsuarioActivo('ana@ejemplo.com');
      await servicio.eliminarUsuario(admin.id, u.id);
      await assert.rejects(servicio.eliminarUsuario(admin.id, u.id), rechazaCon(CODIGOS.USUARIO_NO_ENCONTRADO));
    });

    it('un usuario pendiente de confirmar no puede eliminar cuentas', async () => {
      const u = await registrar('ana@ejemplo.com');
      await assert.rejects(servicio.eliminarUsuario(u.id, u.id), rechazaCon(CODIGOS.NO_AUTENTICADO));
    });
  });

  describe('iniciarSesionOAuth', () => {
    const datosGoogle = (email, extra = {}) => ({ email, nombre: 'Ana Google', emailVerificado: true, ...extra });

    it('crea un usuario activo con origen oauth la primera vez', async () => {
      const u = await servicio.iniciarSesionOAuth(datosGoogle('Ana@Ejemplo.com'));
      assert.equal(u.email, 'ana@ejemplo.com');
      assert.equal(u.origen, 'oauth');
      assert.equal(u.estado, ESTADOS.ACTIVO);
      assert.equal(u.rol, ROLES.USUARIO);
      assert.equal(await servicio.estaActivo(admin.id, u.id), true);
    });

    it('la segunda vez devuelve el mismo usuario, sin duplicarlo', async () => {
      const primero = await servicio.iniciarSesionOAuth(datosGoogle('ana@ejemplo.com'));
      const segundo = await servicio.iniciarSesionOAuth(datosGoogle('ana@ejemplo.com'));
      assert.equal(segundo.id, primero.id);
      assert.equal((await servicio.listarUsuarios(admin.id)).filter((u) => u.email === 'ana@ejemplo.com').length, 1);
    });

    it('rechaza un email que ya tiene cuenta local: debe entrar con su contraseña', async () => {
      await crearUsuarioActivo('ana@ejemplo.com');
      await assert.rejects(servicio.iniciarSesionOAuth(datosGoogle('ana@ejemplo.com')), rechazaCon(CODIGOS.CUENTA_LOCAL));
    });

    it('rechaza también el email de una cuenta local pendiente de confirmar', async () => {
      await registrar('ana@ejemplo.com');
      await assert.rejects(servicio.iniciarSesionOAuth(datosGoogle('ana@ejemplo.com')), rechazaCon(CODIGOS.CUENTA_LOCAL));
    });

    it('rechaza un email que el proveedor no ha verificado', async () => {
      await assert.rejects(
        servicio.iniciarSesionOAuth(datosGoogle('ana@ejemplo.com', { emailVerificado: false })),
        rechazaCon(CODIGOS.EMAIL_NO_VERIFICADO),
      );
    });

    it('una cuenta oauth eliminada no puede volver a entrar', async () => {
      const u = await servicio.iniciarSesionOAuth(datosGoogle('ana@ejemplo.com'));
      await servicio.eliminarUsuario(admin.id, u.id);
      await assert.rejects(servicio.iniciarSesionOAuth(datosGoogle('ana@ejemplo.com')), rechazaCon(CODIGOS.CUENTA_ELIMINADA));
    });

    it('una cuenta oauth no tiene contraseña: el inicio de sesión local la rechaza', async () => {
      await servicio.iniciarSesionOAuth(datosGoogle('ana@ejemplo.com'));
      await assert.rejects(
        servicio.iniciarSesion({ email: 'ana@ejemplo.com', contrasena: CLAVE }),
        rechazaCon(CODIGOS.CREDENCIALES_INVALIDAS),
      );
    });

    it('un email ya registrado por oauth no se puede registrar como cuenta local', async () => {
      await servicio.iniciarSesionOAuth(datosGoogle('ana@ejemplo.com'));
      await assert.rejects(registrar('ana@ejemplo.com'), rechazaCon(CODIGOS.EMAIL_DUPLICADO));
    });
  });

  describe('asegurarAdministrador', () => {
    it('es idempotente: no duplica el administrador', async () => {
      const otra = await servicio.asegurarAdministrador({ email: 'admin@ejemplo.com' });
      assert.equal(otra.id, admin.id);
      assert.equal((await servicio.listarUsuarios(admin.id)).length, 1);
    });

    it('promueve a administrador una cuenta existente', async () => {
      const u = await registrar('jefa@ejemplo.com');
      const promovida = await servicio.asegurarAdministrador({ email: 'jefa@ejemplo.com' });
      assert.equal(promovida.id, u.id);
      assert.equal(promovida.rol, ROLES.ADMINISTRADOR);
      assert.equal(promovida.estado, ESTADOS.ACTIVO);
    });

    it('al cambiar la contraseña configurada, la anterior deja de valer', async () => {
      await servicio.asegurarAdministrador({ email: 'admin@ejemplo.com', contrasena: 'nueva-clave-admin' });
      await assert.rejects(
        servicio.iniciarSesion({ email: 'admin@ejemplo.com', contrasena: CLAVE_ADMIN }),
        rechazaCon(CODIGOS.CREDENCIALES_INVALIDAS),
      );
      const u = await servicio.iniciarSesion({ email: 'admin@ejemplo.com', contrasena: 'nueva-clave-admin' });
      assert.equal(u.id, admin.id);
    });
  });
});
