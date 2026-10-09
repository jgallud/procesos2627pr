// CAPA DE ACCESO A DATOS — sesiones en MongoDB.
//
// Cumple el mismo contrato que sesionRepositorioMemoria.js. Con las sesiones
// en la base de datos, un reinicio o un nuevo despliegue ya no cierra la
// sesión de nadie, y pueden atender peticiones varias instancias a la vez.
//
// Documento almacenado: { _id: id, idUsuario, creadaEn, expiraEn, caducidad }
//   - creadaEn y expiraEn: texto ISO 8601, como en el contrato.
//   - caducidad: la misma fecha que expiraEn pero de tipo Date, para que el
//     índice TTL (ver conexionMongo.js) borre solo las sesiones caducadas.
//     Es un detalle interno: no sale de esta capa.

const { COLECCIONES } = require('./conexionMongo');

function aSesion(documento) {
  if (!documento) return null;
  const { _id, idUsuario, creadaEn, expiraEn } = documento;
  return { id: _id, idUsuario, creadaEn, expiraEn };
}

function crearRepositorioSesionesMongo({ db }) {
  if (!db) throw new Error('crearRepositorioSesionesMongo necesita una base de datos');
  const sesiones = db.collection(COLECCIONES.SESIONES);

  return {
    async crear({ id, idUsuario, creadaEn, expiraEn }) {
      if (!id || !idUsuario) throw new Error('Una sesión necesita id e idUsuario');
      const documento = { _id: id, idUsuario, creadaEn, expiraEn, caducidad: new Date(expiraEn) };
      await sesiones.insertOne(documento);
      return aSesion(documento);
    },

    async buscarPorId(id) {
      if (typeof id !== 'string' || !id) return null;
      return aSesion(await sesiones.findOne({ _id: id }));
    },

    async eliminar(id) {
      if (typeof id !== 'string' || !id) return false;
      const { deletedCount } = await sesiones.deleteOne({ _id: id });
      return deletedCount === 1;
    },

    async eliminarDeUsuario(idUsuario) {
      const { deletedCount } = await sesiones.deleteMany({ idUsuario });
      return deletedCount;
    },

    async eliminarCaducadas(ahora) {
      const { deletedCount } = await sesiones.deleteMany({ expiraEn: { $lte: ahora.toISOString() } });
      return deletedCount;
    },
  };
}

module.exports = { crearRepositorioSesionesMongo };
