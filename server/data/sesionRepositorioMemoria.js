// CAPA DE ACCESO A DATOS — almacén de sesiones en memoria.
//
// Contrato del repositorio de sesiones (la implementación con MongoDB del
// Hito 3 deberá cumplirlo para que las sesiones sobrevivan a un reinicio).
// Todos los métodos son asíncronos:
//
//   crear({ id, idUsuario, creadaEn, expiraEn })  -> sesión guardada
//   buscarPorId(id)                               -> sesión | null
//   eliminar(id)                                  -> true si existía
//   eliminarDeUsuario(idUsuario)                  -> nº de sesiones eliminadas
//   eliminarCaducadas(ahora: Date)                -> nº de sesiones eliminadas
//
// El identificador lo genera la capa lógica (aleatorio y criptográficamente
// seguro); este almacén solo lo guarda. Las fechas se guardan en ISO 8601.

function copiar(sesion) {
  return sesion ? { ...sesion } : null;
}

function crearRepositorioSesionesMemoria() {
  const sesiones = new Map(); // id -> sesión

  return {
    async crear({ id, idUsuario, creadaEn, expiraEn }) {
      if (!id || !idUsuario) throw new Error('Una sesión necesita id e idUsuario');
      const sesion = { id, idUsuario, creadaEn, expiraEn };
      sesiones.set(id, sesion);
      return copiar(sesion);
    },

    async buscarPorId(id) {
      return copiar(sesiones.get(id));
    },

    async eliminar(id) {
      return sesiones.delete(id);
    },

    async eliminarDeUsuario(idUsuario) {
      let eliminadas = 0;
      for (const [id, sesion] of sesiones) {
        if (sesion.idUsuario === idUsuario) {
          sesiones.delete(id);
          eliminadas += 1;
        }
      }
      return eliminadas;
    },

    async eliminarCaducadas(ahora) {
      const limite = ahora.toISOString();
      let eliminadas = 0;
      for (const [id, sesion] of sesiones) {
        if (sesion.expiraEn <= limite) {
          sesiones.delete(id);
          eliminadas += 1;
        }
      }
      return eliminadas;
    },
  };
}

module.exports = { crearRepositorioSesionesMemoria };
