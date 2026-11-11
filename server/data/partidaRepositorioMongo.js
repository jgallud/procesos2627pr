// CAPA DE ACCESO A DATOS — partidas de Hundir la Flota en MongoDB (Hito 6, RF-17).
//
// Cumple el mismo contrato que partidaRepositorioMemoria.js y pasa las mismas
// pruebas (test/contratos/repositorioPartidas.js). Con las partidas en la base
// de datos, un despliegue, un reinicio o que Cloud Run pare la instancia ya no
// borra las partidas en curso, y vuelven a poder atender varias instancias.
//
// Documento almacenado:
//   { _id: id, modo, jugadores, enCurso, creadaEn, actualizadaEn, juego }
// `juego` es el estado del motor tal cual (un objeto plano, D-26): este
// repositorio no lo interpreta. El `_id` es un UUID generado aquí; fuera de
// esta capa solo existe como `id`.

const { randomUUID } = require('node:crypto');
const { COLECCIONES } = require('./conexionMongo');

function aPartida(documento) {
  if (!documento) return null;
  const { _id, ...resto } = documento;
  return { ...resto, id: _id };
}

function crearRepositorioPartidasMongo({ db }) {
  if (!db) throw new Error('crearRepositorioPartidasMongo necesita una base de datos');
  const partidas = db.collection(COLECCIONES.PARTIDAS);

  return {
    async crear(datos) {
      if (!datos || !Array.isArray(datos.jugadores) || !datos.juego) {
        throw new Error('Una partida necesita jugadores y juego');
      }
      const { id: _ignorado, ...resto } = datos;
      const documento = { ...resto, _id: randomUUID() };
      await partidas.insertOne(documento);
      return aPartida(documento);
    },

    async buscarPorId(id) {
      if (typeof id !== 'string' || !id) return null;
      return aPartida(await partidas.findOne({ _id: id }));
    },

    async actualizar(id, cambios) {
      if (typeof id !== 'string' || !id) return null;
      const { id: _id1, _id: _id2, ...resto } = cambios ?? {};
      const actualizada = await partidas.findOneAndUpdate(
        { _id: id },
        { $set: resto },
        { returnDocument: 'after' },
      );
      return aPartida(actualizada);
    },

    async buscarEnCursoDe(idUsuario) {
      const [partida] = await partidas
        .find({ enCurso: true, jugadores: idUsuario })
        .sort({ creadaEn: -1 })
        .limit(1)
        .toArray();
      return aPartida(partida);
    },
  };
}

module.exports = { crearRepositorioPartidasMongo };
