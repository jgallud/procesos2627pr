// Repositorios de MongoDB: mismo contrato que los de memoria, más las
// garantías propias de una base de datos (índice único de email, TTL de
// sesiones, datos que sobreviven a cerrar y reabrir la conexión).

const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { crearRepositorioUsuariosMongo } = require('../../server/data/usuarioRepositorioMongo');
const { crearRepositorioSesionesMongo } = require('../../server/data/sesionRepositorioMongo');
const { COLECCIONES, hostDe } = require('../../server/data/conexionMongo');
const { probarContratoUsuarios } = require('../contratos/repositorioUsuarios');
const { probarContratoSesiones } = require('../contratos/repositorioSesiones');
const { omitirSinMongo, conectarPruebas, nombreBasePruebas } = require('../ayuda/mongo');

describe('hostDe: el host se registra sin credenciales', () => {
  it('quita usuario y contraseña de la URI', () => {
    assert.equal(hostDe('mongodb+srv://usu:secreto@cluster0.abc.mongodb.net/?retryWrites=true'), 'cluster0.abc.mongodb.net');
    assert.equal(hostDe('mongodb://localhost:27017'), 'localhost:27017');
  });
});

describe('Repositorios MongoDB', { skip: omitirSinMongo }, () => {
  let conexion;
  before(async () => { conexion = await conectarPruebas(); });
  after(async () => {
    await conexion.db.dropDatabase();
    await conexion.cerrar();
  });

  const vaciar = async () => {
    await conexion.db.collection(COLECCIONES.USUARIOS).deleteMany({});
    await conexion.db.collection(COLECCIONES.SESIONES).deleteMany({});
  };

  probarContratoUsuarios('MongoDB', { crear: () => crearRepositorioUsuariosMongo({ db: conexion.db }), limpiar: vaciar });
  probarContratoSesiones('MongoDB', { crear: () => crearRepositorioSesionesMongo({ db: conexion.db }), limpiar: vaciar });

  describe('garantías de la base de datos', () => {
    it('el índice único impide dos cuentas con el mismo email', async () => {
      const repo = crearRepositorioUsuariosMongo({ db: conexion.db });
      await repo.crear({ email: 'dup@b.com' });
      await assert.rejects(() => repo.crear({ email: 'dup@b.com' }), { code: 11000 });
      await vaciar();
    });

    it('el documento de usuario no expone _id, solo id', async () => {
      const repo = crearRepositorioUsuariosMongo({ db: conexion.db });
      const creado = await repo.crear({ email: 'a@b.com' });
      assert.equal('_id' in creado, false);
      assert.equal('_id' in (await repo.buscarPorId(creado.id)), false);
      await vaciar();
    });

    it('la sesión guarda la caducidad como fecha para el índice TTL, sin exponerla', async () => {
      const repo = crearRepositorioSesionesMongo({ db: conexion.db });
      await repo.crear({ id: 's1', idUsuario: 'u1', creadaEn: '2026-01-01T00:00:00.000Z', expiraEn: '2030-01-01T00:00:00.000Z' });
      const documento = await conexion.db.collection(COLECCIONES.SESIONES).findOne({ _id: 's1' });
      assert.ok(documento.caducidad instanceof Date);
      assert.equal('caducidad' in (await repo.buscarPorId('s1')), false);
      const indices = await conexion.db.collection(COLECCIONES.SESIONES).indexes();
      assert.ok(indices.some((i) => i.expireAfterSeconds === 0 && i.key.caducidad === 1));
      await vaciar();
    });
  });
});

describe('Persistencia: los datos sobreviven a un reinicio', { skip: omitirSinMongo }, () => {
  const nombreBase = nombreBasePruebas();
  after(async () => {
    const conexion = await conectarPruebas(nombreBase);
    await conexion.db.dropDatabase();
    await conexion.cerrar();
  });

  it('un usuario y su sesión siguen ahí tras cerrar y reabrir la conexión', async () => {
    const primera = await conectarPruebas(nombreBase);
    const usuario = await crearRepositorioUsuariosMongo({ db: primera.db }).crear({ email: 'persiste@b.com', estado: 'activo' });
    await crearRepositorioSesionesMongo({ db: primera.db })
      .crear({ id: 'sesion-1', idUsuario: usuario.id, creadaEn: '2026-01-01T00:00:00.000Z', expiraEn: '2030-01-01T00:00:00.000Z' });
    await primera.cerrar();

    const segunda = await conectarPruebas(nombreBase);
    try {
      assert.deepEqual(await crearRepositorioUsuariosMongo({ db: segunda.db }).buscarPorEmail('persiste@b.com'), usuario);
      assert.equal((await crearRepositorioSesionesMongo({ db: segunda.db }).buscarPorId('sesion-1')).idUsuario, usuario.id);
    } finally {
      await segunda.cerrar();
    }
  });
});
