// CAPA DE ACCESO A DATOS — implementación en memoria.
//
// Contrato del repositorio de usuarios (cualquier implementación, p. ej. la
// de MongoDB del Hito 3, debe cumplirlo). Todos los métodos son asíncronos
// para que sustituir la memoria por una base de datos no cambie la lógica:
//
//   crear(datos)               -> usuario creado (con id asignado)
//   buscarPorId(id)            -> usuario | null
//   buscarPorEmail(email)      -> usuario | null
//   listar()                   -> usuario[]
//   actualizar(id, cambios)    -> usuario actualizado | null
//
// Se devuelven siempre copias para que nadie fuera de esta capa pueda
// modificar los datos almacenados sin pasar por el repositorio (igual que
// ocurriría con una base de datos real).

const { randomUUID } = require('node:crypto');

function copiar(usuario) {
  return usuario ? structuredClone(usuario) : null;
}

function crearRepositorioUsuariosMemoria() {
  const usuarios = new Map(); // id -> usuario

  return {
    async crear(datos) {
      const usuario = { ...structuredClone(datos), id: randomUUID() };
      usuarios.set(usuario.id, usuario);
      return copiar(usuario);
    },

    async buscarPorId(id) {
      return copiar(usuarios.get(id));
    },

    async buscarPorEmail(email) {
      for (const usuario of usuarios.values()) {
        if (usuario.email === email) return copiar(usuario);
      }
      return null;
    },

    async listar() {
      return [...usuarios.values()].map(copiar);
    },

    async actualizar(id, cambios) {
      const actual = usuarios.get(id);
      if (!actual) return null;
      const { id: _ignorado, ...resto } = structuredClone(cambios);
      const actualizado = { ...actual, ...resto };
      usuarios.set(id, actualizado);
      return copiar(actualizado);
    },
  };
}

module.exports = { crearRepositorioUsuariosMemoria };
