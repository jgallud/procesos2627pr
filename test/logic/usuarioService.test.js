// Pruebas unitarias de la capa lógica de gestión de usuarios.
// Usan el repositorio en memoria: no hay red, ni Express, ni base de datos.

const { describe, it, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const { crearServicioUsuarios, ROLES, ESTADOS } = require('../../server/logic/usuarioService');
const { crearRepositorioUsuariosMemoria } = require('../../server/data/usuarioRepositorioMemoria');
const { CODIGOS } = require('../../server/logic/errores');

// Comprueba que una promesa se rechaza con un ErrorDominio del código indicado.
function rechazaCon(codigo) {
  return (err) => err.name === 'ErrorDominio' && err.codigo === codigo;
}

describe('Servicio de usuarios', () => {
  let servicio;
  let admin;

  // Registra y confirma un usuario normal.
  async function crearUsuarioActivo(email) {
    const u = await servicio.registrarUsuario({ email, nombre: email.split('@')[0] });
    return servicio.confirmarCuenta(u.id);
  }

  beforeEach(async () => {
    servicio = crearServicioUsuarios({ repositorio: crearRepositorioUsuariosMemoria() });
    admin = await servicio.asegurarAdministrador({ email: 'admin@ejemplo.com' });
  });

  describe('registrarUsuario', () => {
    it('crea un usuario con rol usuario y estado pendiente', async () => {
      const u = await servicio.registrarUsuario({ email: 'ana@ejemplo.com', nombre: 'Ana' });
      assert.ok(u.id);
      assert.equal(u.email, 'ana@ejemplo.com');
      assert.equal(u.rol, ROLES.USUARIO);
      assert.equal(u.estado, ESTADOS.PENDIENTE);
    });

    it('normaliza el email (espacios y mayúsculas)', async () => {
      const u = await servicio.registrarUsuario({ email: '  Ana@Ejemplo.COM ' });
      assert.equal(u.email, 'ana@ejemplo.com');
    });

    it('rechaza un email ya registrado', async () => {
      await servicio.registrarUsuario({ email: 'ana@ejemplo.com' });
      await assert.rejects(
        servicio.registrarUsuario({ email: 'ANA@ejemplo.com' }),
        rechazaCon(CODIGOS.EMAIL_DUPLICADO),
      );
    });

    it('rechaza un email con formato inválido o ausente', async () => {
      await assert.rejects(servicio.registrarUsuario({ email: 'no-es-un-email' }), rechazaCon(CODIGOS.DATOS_INVALIDOS));
      await assert.rejects(servicio.registrarUsuario({}), rechazaCon(CODIGOS.DATOS_INVALIDOS));
    });
  });

  describe('listarUsuarios', () => {
    it('el administrador obtiene email, rol y estado de cada usuario', async () => {
      await servicio.registrarUsuario({ email: 'ana@ejemplo.com' });
      const lista = await servicio.listarUsuarios(admin.id);
      assert.equal(lista.length, 2);
      for (const u of lista) {
        assert.ok(u.email);
        assert.ok(u.rol);
        assert.ok(u.estado);
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
      const u = await servicio.registrarUsuario({ email: 'ana@ejemplo.com' });
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
      const u = await servicio.registrarUsuario({ email: 'ana@ejemplo.com' });
      await assert.rejects(servicio.eliminarUsuario(u.id, u.id), rechazaCon(CODIGOS.NO_AUTENTICADO));
    });
  });

  describe('confirmarCuenta', () => {
    it('no se puede confirmar una cuenta ya activa', async () => {
      const u = await crearUsuarioActivo('ana@ejemplo.com');
      await assert.rejects(servicio.confirmarCuenta(u.id), rechazaCon(CODIGOS.ESTADO_INVALIDO));
    });
  });

  describe('asegurarAdministrador', () => {
    it('es idempotente: no duplica el administrador', async () => {
      const otra = await servicio.asegurarAdministrador({ email: 'admin@ejemplo.com' });
      assert.equal(otra.id, admin.id);
      assert.equal((await servicio.listarUsuarios(admin.id)).length, 1);
    });

    it('promueve a administrador una cuenta existente', async () => {
      const u = await servicio.registrarUsuario({ email: 'jefa@ejemplo.com' });
      const promovida = await servicio.asegurarAdministrador({ email: 'jefa@ejemplo.com' });
      assert.equal(promovida.id, u.id);
      assert.equal(promovida.rol, ROLES.ADMINISTRADOR);
      assert.equal(promovida.estado, ESTADOS.ACTIVO);
    });
  });
});
