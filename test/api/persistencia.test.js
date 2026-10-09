// Prueba de integración del Hito 3: la aplicación completa (API + lógica +
// repositorios de MongoDB) conserva usuarios y sesiones cuando el servidor se
// reinicia. Se simula el reinicio montando una segunda aplicación con una
// conexión nueva a la misma base de datos.
//
// Solo se ejecuta si existe MONGODB_URI_TEST (ver test/ayuda/mongo.js).

const { describe, it, after } = require('node:test');
const assert = require('node:assert/strict');
const { crearApp } = require('../../server/app');
const { crearServicioUsuarios } = require('../../server/logic/usuarioService');
const { crearServicioSesiones } = require('../../server/logic/sesionService');
const { crearRepositorioUsuariosMongo } = require('../../server/data/usuarioRepositorioMongo');
const { crearRepositorioSesionesMongo } = require('../../server/data/sesionRepositorioMongo');
const { arrancar, cookieDe } = require('../ayuda/servidor');
const { CLAVE, CLAVE_ADMIN } = require('../ayuda/montaje');
const { omitirSinMongo, conectarPruebas, nombreBasePruebas } = require('../ayuda/mongo');

// Compone las capas igual que server/index.js, pero sobre la base de pruebas.
async function arrancarSobreMongo(nombreBase, tokens) {
  const conexion = await conectarPruebas(nombreBase);
  const notificador = { async enviarConfirmacion({ email, token }) { tokens.set(email, token); } };
  const servicioUsuarios = crearServicioUsuarios({ repositorio: crearRepositorioUsuariosMongo({ db: conexion.db }), notificador });
  const servicioSesiones = crearServicioSesiones({ repositorio: crearRepositorioSesionesMongo({ db: conexion.db }) });
  await servicioUsuarios.asegurarAdministrador({ email: 'admin@ejemplo.com', contrasena: CLAVE_ADMIN });
  const servidor = await arrancar(crearApp({ servicioUsuarios, servicioSesiones }));
  return {
    peticion: servidor.peticion,
    async parar() {
      await servidor.cerrar();
      await conexion.cerrar();
    },
  };
}

describe('Persistencia de la aplicación completa con MongoDB', { skip: omitirSinMongo }, () => {
  const nombreBase = nombreBasePruebas();
  after(async () => {
    const conexion = await conectarPruebas(nombreBase);
    await conexion.db.dropDatabase();
    await conexion.cerrar();
  });

  it('usuarios, sesiones, roles y eliminaciones sobreviven a un reinicio', async () => {
    const tokens = new Map();
    const entrar = (s, email, contrasena) => s.peticion('POST', '/api/sesion', { cuerpo: { email, contrasena } });

    // --- Antes del reinicio ---------------------------------------------
    const antes = await arrancarSobreMongo(nombreBase, tokens);
    let r = await antes.peticion('POST', '/api/usuarios', { cuerpo: { email: 'ana@ejemplo.com', nombre: 'Ana', contrasena: CLAVE } });
    assert.equal(r.estado, 201);
    r = await antes.peticion('POST', '/api/usuarios/confirmacion', { cuerpo: { token: tokens.get('ana@ejemplo.com') } });
    assert.equal(r.estado, 200);
    await antes.peticion('POST', '/api/usuarios', { cuerpo: { email: 'luis@ejemplo.com', contrasena: CLAVE } });
    await antes.peticion('POST', '/api/usuarios/confirmacion', { cuerpo: { token: tokens.get('luis@ejemplo.com') } });

    r = await entrar(antes, 'ana@ejemplo.com', CLAVE);
    assert.equal(r.estado, 200);
    const cookieAna = cookieDe(r.cookies);
    r = await entrar(antes, 'admin@ejemplo.com', CLAVE_ADMIN);
    const cookieAdmin = cookieDe(r.cookies);
    const luis = (await antes.peticion('GET', '/api/usuarios', { cookie: cookieAdmin })).datos
      .find((u) => u.email === 'luis@ejemplo.com');
    r = await antes.peticion('DELETE', `/api/usuarios/${luis.id}`, { cookie: cookieAdmin });
    assert.equal(r.estado, 204);
    await antes.parar();

    // --- Después del reinicio -------------------------------------------
    const despues = await arrancarSobreMongo(nombreBase, tokens);
    try {
      // La sesión de Ana sigue abierta sin volver a iniciar sesión.
      r = await despues.peticion('GET', '/api/sesion', { cookie: cookieAna });
      assert.equal(r.estado, 200);
      assert.equal(r.datos.email, 'ana@ejemplo.com');

      // Ana sigue siendo un usuario normal: no puede listar.
      r = await despues.peticion('GET', '/api/usuarios', { cookie: cookieAna });
      assert.equal(r.estado, 403);

      // El administrador ve los tres usuarios; Luis sigue eliminado.
      r = await despues.peticion('GET', '/api/usuarios', { cookie: cookieAdmin });
      assert.equal(r.estado, 200);
      assert.equal(r.datos.length, 3);
      assert.equal(r.datos.find((u) => u.email === 'luis@ejemplo.com').estado, 'eliminado');

      // Luis no puede iniciar sesión y la contraseña de Ana sigue valiendo.
      r = await entrar(despues, 'luis@ejemplo.com', CLAVE);
      assert.equal(r.datos.codigo, 'CUENTA_ELIMINADA');
      r = await entrar(despues, 'ana@ejemplo.com', CLAVE);
      assert.equal(r.estado, 200);

      // El email sigue siendo único entre reinicios.
      r = await despues.peticion('POST', '/api/usuarios', { cuerpo: { email: 'ana@ejemplo.com', contrasena: CLAVE } });
      assert.equal(r.estado, 409);
    } finally {
      await despues.parar();
    }
  });
});
