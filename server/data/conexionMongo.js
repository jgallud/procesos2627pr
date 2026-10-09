// CAPA DE ACCESO A DATOS — conexión con MongoDB.
//
// Abre un único cliente para toda la aplicación (el driver gestiona un pool de
// conexiones), prepara los índices que necesitan los repositorios y ofrece un
// cierre ordenado. La URI de conexión contiene la contraseña: llega siempre
// por variable de entorno y nunca se escribe en el log (solo el host).

const { MongoClient } = require('mongodb');
const { loggerSilencioso } = require('../logger');

const COLECCIONES = Object.freeze({ USUARIOS: 'usuarios', SESIONES: 'sesiones' });

// Host del cluster sin credenciales, para poder registrarlo sin riesgo.
function hostDe(uri) {
  const sinEsquema = String(uri).replace(/^[a-z+]+:\/\//i, '');
  const trasCredenciales = sinEsquema.slice(sinEsquema.lastIndexOf('@') + 1);
  return trasCredenciales.split(/[/?]/)[0] || 'desconocido';
}

async function prepararIndices(db) {
  const usuarios = db.collection(COLECCIONES.USUARIOS);
  const sesiones = db.collection(COLECCIONES.SESIONES);
  await Promise.all([
    // Un email solo puede pertenecer a una cuenta (también ante dos altas simultáneas).
    usuarios.createIndex({ email: 1 }, { unique: true, name: 'email_unico' }),
    sesiones.createIndex({ idUsuario: 1 }, { name: 'por_usuario' }),
    // Índice TTL: MongoDB borra solo las sesiones caducadas (revisa cada ~60 s).
    sesiones.createIndex({ caducidad: 1 }, { expireAfterSeconds: 0, name: 'caducidad_ttl' }),
  ]);
}

async function conectarMongo({ uri, nombreBase, logger = loggerSilencioso, opcionesCliente = {} }) {
  if (!uri) throw new Error('conectarMongo necesita la URI de conexión');
  if (!nombreBase) throw new Error('conectarMongo necesita el nombre de la base de datos');

  const host = hostDe(uri);
  const cliente = new MongoClient(uri, {
    appName: 'procesos2627pr',
    serverSelectionTimeoutMS: 10000,
    ignoreUndefined: true,
    ...opcionesCliente,
  });

  try {
    await cliente.connect();
    const db = cliente.db(nombreBase);
    await db.command({ ping: 1 });
    await prepararIndices(db);
    logger.info('Conectado a MongoDB', { host, base: nombreBase });

    let cerrado = false;
    return {
      db,
      async cerrar() {
        if (cerrado) return;
        cerrado = true;
        await cliente.close();
        logger.info('Conexión con MongoDB cerrada', { host });
      },
    };
  } catch (err) {
    logger.error('No se pudo conectar a MongoDB', { host, base: nombreBase, error: err.message });
    await cliente.close().catch(() => {});
    throw err;
  }
}

module.exports = { conectarMongo, COLECCIONES, hostDe };
