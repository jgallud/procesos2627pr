// CAPA DE ACCESO A DATOS — usuarios en MongoDB.
//
// Cumple el mismo contrato que usuarioRepositorioMemoria.js (crear,
// buscarPorId, buscarPorEmail, listar, actualizar), así que la capa lógica no
// cambia al pasar de memoria a base de datos.
//
// El id sigue siendo un UUID generado aquí y se guarda como _id del documento.
// Fuera de esta capa solo existe "id": _id no sale nunca, de modo que los
// usuarios tienen exactamente la misma forma que con la implementación en
// memoria (y los tokens de confirmación "<id>.<secreto>" siguen valiendo).

const { randomUUID } = require('node:crypto');
const { COLECCIONES } = require('./conexionMongo');

function aUsuario(documento) {
  if (!documento) return null;
  const { _id, ...resto } = documento;
  return { ...resto, id: _id };
}

function crearRepositorioUsuariosMongo({ db }) {
  if (!db) throw new Error('crearRepositorioUsuariosMongo necesita una base de datos');
  const usuarios = db.collection(COLECCIONES.USUARIOS);

  return {
    async crear(datos) {
      const { id: _ignorado, _id: _tambien, ...resto } = datos;
      const documento = { ...resto, _id: randomUUID() };
      // Si el email ya existe, el índice único hace fallar la inserción
      // (la capa lógica ya lo comprueba antes; esto cubre altas simultáneas).
      await usuarios.insertOne(documento);
      return aUsuario(documento);
    },

    async buscarPorId(id) {
      if (typeof id !== 'string' || !id) return null;
      return aUsuario(await usuarios.findOne({ _id: id }));
    },

    async buscarPorEmail(email) {
      if (typeof email !== 'string' || !email) return null;
      return aUsuario(await usuarios.findOne({ email }));
    },

    async listar() {
      const documentos = await usuarios.find({}).toArray();
      return documentos.map(aUsuario);
    },

    async actualizar(id, cambios) {
      if (typeof id !== 'string' || !id) return null;
      const { id: _ignorado, _id: _tambien, ...resto } = cambios ?? {};
      if (Object.keys(resto).length === 0) return this.buscarPorId(id);
      const actualizado = await usuarios.findOneAndUpdate(
        { _id: id },
        { $set: resto },
        { returnDocument: 'after' },
      );
      return aUsuario(actualizado);
    },
  };
}

module.exports = { crearRepositorioUsuariosMongo };
