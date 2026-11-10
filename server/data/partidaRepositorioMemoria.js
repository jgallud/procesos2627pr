// CAPA DE ACCESO A DATOS — partidas de Hundir la Flota en memoria (Hito 5).
//
// Contrato del repositorio de partidas (la implementación con MongoDB del
// Hito 6 deberá cumplirlo, con las mismas pruebas de test/contratos/).
// Todos los métodos son asíncronos:
//
//   crear(datos)                 -> partida guardada, con un id nuevo
//   buscarPorId(id)              -> partida | null
//   actualizar(id, cambios)      -> partida actualizada | null si no existe
//   buscarEnCursoDe(idUsuario)   -> la partida en curso más reciente en la que
//                                   juega ese usuario | null
//
// Una partida guardada es un objeto plano:
//   { id, modo, jugadores: [idUsuario, idUsuario | null], enCurso,
//     creadaEn, actualizadaEn, juego }
// donde `juego` es el estado que maneja el motor (server/logic/motor/) y
// `jugadores[1]` es null cuando el rival es la máquina. Este repositorio no
// interpreta `juego`: solo lo guarda y lo devuelve. Siempre devuelve copias,
// para que nadie pueda cambiar lo guardado sin pasar por actualizar().

const { randomUUID } = require('node:crypto');

function copiar(partida) {
  return partida ? structuredClone(partida) : null;
}

function crearRepositorioPartidasMemoria() {
  const partidas = new Map(); // id -> partida

  return {
    async crear(datos) {
      if (!datos || !Array.isArray(datos.jugadores) || !datos.juego) {
        throw new Error('Una partida necesita jugadores y juego');
      }
      const partida = { ...structuredClone(datos), id: randomUUID() };
      partidas.set(partida.id, partida);
      return copiar(partida);
    },

    async buscarPorId(id) {
      return copiar(partidas.get(id));
    },

    async actualizar(id, cambios) {
      const actual = partidas.get(id);
      if (!actual) return null;
      const { id: _ignorado, ...resto } = structuredClone(cambios);
      const actualizada = { ...actual, ...resto };
      partidas.set(id, actualizada);
      return copiar(actualizada);
    },

    async buscarEnCursoDe(idUsuario) {
      let elegida = null;
      for (const partida of partidas.values()) {
        if (!partida.enCurso || !partida.jugadores.includes(idUsuario)) continue;
        if (!elegida || partida.creadaEn > elegida.creadaEn) elegida = partida;
      }
      return copiar(elegida);
    },
  };
}

module.exports = { crearRepositorioPartidasMemoria };
