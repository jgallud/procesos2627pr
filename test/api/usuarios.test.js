// Pruebas de la API de usuarios: peticiones HTTP reales contra la app con el
// repositorio en memoria. Comprueban que la API traduce bien la lógica a HTTP.

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const { crearApp } = require('../../server/app');
const { crearServicioUsuarios } = require('../../server/logic/usuarioService');
const { crearRepositorioUsuariosMemoria } = require('../../server/data/usuarioRepositorioMemoria');
const { arrancar } = require('../ayuda/servidor');

describe('API /api/usuarios', () => {
  let servidor;
  let servicio;
  let admin;

  const comoAdmin = () => ({ cabeceras: { 'X-Usuario-Id': admin.id } });
  const como = (id) => ({ cabeceras: { 'X-Usuario-Id': id } });

  async function usuarioActivo(email) {
    const u = await servicio.registrarUsuario({ email });
    return servicio.confirmarCuenta(u.id);
  }

  beforeEach(async () => {
    servicio = crearServicioUsuarios({ repositorio: crearRepositorioUsuariosMemoria() });
    admin = await servicio.asegurarAdministrador({ email: 'admin@ejemplo.com' });
    servidor = await arrancar(crearApp({ servicioUsuarios: servicio }));
  });

  afterEach(async () => { await servidor.cerrar(); });

  describe('POST /api/usuarios', () => {
    it('201 y el usuario creado en estado pendiente', async () => {
      const r = await servidor.peticion('POST', '/api/usuarios', { cuerpo: { email: 'ana@ejemplo.com', nombre: 'Ana' } });
      assert.equal(r.estado, 201);
      assert.equal(r.datos.email, 'ana@ejemplo.com');
      assert.equal(r.datos.estado, 'pendiente');
      assert.equal(r.datos.rol, 'usuario');
    });

    it('409 si el email ya existe', async () => {
      await servidor.peticion('POST', '/api/usuarios', { cuerpo: { email: 'ana@ejemplo.com' } });
      const r = await servidor.peticion('POST', '/api/usuarios', { cuerpo: { email: 'ana@ejemplo.com' } });
      assert.equal(r.estado, 409);
      assert.equal(r.datos.codigo, 'EMAIL_DUPLICADO');
    });

    it('400 si el email no es válido', async () => {
      const r = await servidor.peticion('POST', '/api/usuarios', { cuerpo: { email: 'mal' } });
      assert.equal(r.estado, 400);
      assert.ok(r.datos.error);
    });

    it('400 si el cuerpo no es JSON válido', async () => {
      const r = await servidor.peticion('POST', '/api/usuarios', { cuerpo: '{no es json' });
      assert.equal(r.estado, 400);
    });
  });

  describe('GET /api/usuarios', () => {
    it('200 con email, rol y estado para el administrador', async () => {
      await servicio.registrarUsuario({ email: 'ana@ejemplo.com' });
      const r = await servidor.peticion('GET', '/api/usuarios', comoAdmin());
      assert.equal(r.estado, 200);
      assert.equal(r.datos.length, 2);
      assert.deepEqual(Object.keys(r.datos[1]).filter((k) => ['email', 'rol', 'estado'].includes(k)).sort(), ['email', 'estado', 'rol']);
    });

    it('401 sin identificar al solicitante', async () => {
      const r = await servidor.peticion('GET', '/api/usuarios');
      assert.equal(r.estado, 401);
    });

    it('403 para un usuario normal', async () => {
      const ana = await usuarioActivo('ana@ejemplo.com');
      const r = await servidor.peticion('GET', '/api/usuarios', como(ana.id));
      assert.equal(r.estado, 403);
    });
  });

  describe('GET /api/usuarios/:id/activo', () => {
    it('false para un usuario pendiente y true tras confirmar', async () => {
      const u = await servicio.registrarUsuario({ email: 'ana@ejemplo.com' });
      let r = await servidor.peticion('GET', `/api/usuarios/${u.id}/activo`, comoAdmin());
      assert.equal(r.estado, 200);
      assert.deepEqual(r.datos, { id: u.id, activo: false });

      await servicio.confirmarCuenta(u.id);
      r = await servidor.peticion('GET', `/api/usuarios/${u.id}/activo`, comoAdmin());
      assert.equal(r.datos.activo, true);
    });

    it('404 si el usuario no existe', async () => {
      const r = await servidor.peticion('GET', '/api/usuarios/no-existe/activo', comoAdmin());
      assert.equal(r.estado, 404);
    });
  });

  describe('DELETE /api/usuarios/:id', () => {
    it('204 cuando el administrador elimina a un usuario', async () => {
      const ana = await usuarioActivo('ana@ejemplo.com');
      const r = await servidor.peticion('DELETE', `/api/usuarios/${ana.id}`, comoAdmin());
      assert.equal(r.estado, 204);
      assert.equal(await servicio.estaActivo(admin.id, ana.id), false);
    });

    it('204 cuando un usuario elimina su propia cuenta', async () => {
      const ana = await usuarioActivo('ana@ejemplo.com');
      const r = await servidor.peticion('DELETE', `/api/usuarios/${ana.id}`, como(ana.id));
      assert.equal(r.estado, 204);
    });

    it('403 cuando un usuario normal intenta eliminar a otro', async () => {
      const ana = await usuarioActivo('ana@ejemplo.com');
      const luis = await usuarioActivo('luis@ejemplo.com');
      const r = await servidor.peticion('DELETE', `/api/usuarios/${luis.id}`, como(ana.id));
      assert.equal(r.estado, 403);
      assert.equal(await servicio.estaActivo(admin.id, luis.id), true);
    });
  });
});
