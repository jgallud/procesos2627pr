// CAPA DE LÓGICA DE NEGOCIO — gestión de usuarios.
//
// Contiene todas las reglas sobre usuarios. No conoce HTTP ni Express (eso es
// la capa API) ni cómo se guardan los datos (eso es la capa de datos): recibe
// un repositorio que cumple el contrato de server/data/ y lo usa.
//
// Modelo de usuario:
//   { id, email, nombre, rol, estado, origen, creadoEn, eliminadoEn? }
//   rol:    'usuario' | 'administrador'
//   estado: 'pendiente' (sin confirmar el correo) | 'activo' | 'eliminado'
//   origen: 'local' | 'oauth'
//
// Un usuario está ACTIVO cuando ha confirmado su cuenta (o se registró por
// OAuth) y no ha sido eliminado, es decir, cuando estado === 'activo'.
// La eliminación es lógica (estado 'eliminado'): el usuario sigue en el
// listado del administrador con ese estado y no puede volver a iniciar sesión.

const { ErrorDominio, CODIGOS } = require('./errores');
const { loggerSilencioso } = require('../logger');

const ROLES = Object.freeze({ USUARIO: 'usuario', ADMINISTRADOR: 'administrador' });
const ESTADOS = Object.freeze({ PENDIENTE: 'pendiente', ACTIVO: 'activo', ELIMINADO: 'eliminado' });

const PATRON_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const LONGITUD_MAXIMA_NOMBRE = 100;

function normalizarEmail(email) {
  if (typeof email !== 'string') {
    throw new ErrorDominio(CODIGOS.DATOS_INVALIDOS, 'El email es obligatorio');
  }
  const normalizado = email.trim().toLowerCase();
  if (!PATRON_EMAIL.test(normalizado)) {
    throw new ErrorDominio(CODIGOS.DATOS_INVALIDOS, 'El email no tiene un formato válido');
  }
  return normalizado;
}

function normalizarNombre(nombre) {
  if (nombre === undefined || nombre === null) return '';
  if (typeof nombre !== 'string') {
    throw new ErrorDominio(CODIGOS.DATOS_INVALIDOS, 'El nombre debe ser texto');
  }
  const limpio = nombre.trim();
  if (limpio.length > LONGITUD_MAXIMA_NOMBRE) {
    throw new ErrorDominio(CODIGOS.DATOS_INVALIDOS, `El nombre no puede superar ${LONGITUD_MAXIMA_NOMBRE} caracteres`);
  }
  return limpio;
}

// Vista pública de un usuario: lo que puede salir de la capa lógica.
// (En el Hito 2 aquí se excluirá el hash de la contraseña.)
function vistaPublica(usuario) {
  const { id, email, nombre, rol, estado, origen, creadoEn } = usuario;
  return { id, email, nombre, rol, estado, origen, creadoEn };
}

function crearServicioUsuarios({ repositorio, logger = loggerSilencioso, reloj = () => new Date() }) {
  if (!repositorio) throw new Error('crearServicioUsuarios necesita un repositorio');

  // Obtiene y valida a quien hace la petición. Nunca se confía en el rol que
  // diga el cliente: se consulta siempre el usuario almacenado.
  async function obtenerSolicitante(idSolicitante) {
    if (!idSolicitante) {
      throw new ErrorDominio(CODIGOS.NO_AUTENTICADO, 'Es necesario iniciar sesión');
    }
    const solicitante = await repositorio.buscarPorId(idSolicitante);
    if (!solicitante || solicitante.estado !== ESTADOS.ACTIVO) {
      throw new ErrorDominio(CODIGOS.NO_AUTENTICADO, 'Sesión no válida');
    }
    return solicitante;
  }

  async function exigirAdministrador(idSolicitante) {
    const solicitante = await obtenerSolicitante(idSolicitante);
    if (solicitante.rol !== ROLES.ADMINISTRADOR) {
      logger.warn('Acceso denegado: se requiere administrador', { solicitante: solicitante.id });
      throw new ErrorDominio(CODIGOS.PROHIBIDO, 'Solo un administrador puede realizar esta operación');
    }
    return solicitante;
  }

  async function obtenerExistente(id) {
    const usuario = id ? await repositorio.buscarPorId(id) : null;
    if (!usuario) {
      throw new ErrorDominio(CODIGOS.USUARIO_NO_ENCONTRADO, 'El usuario no existe');
    }
    return usuario;
  }

  return {
    // Alta de un usuario local. Queda pendiente hasta que confirme su correo.
    async registrarUsuario({ email, nombre } = {}) {
      const emailNormalizado = normalizarEmail(email);
      const nombreNormalizado = normalizarNombre(nombre);

      const existente = await repositorio.buscarPorEmail(emailNormalizado);
      if (existente) {
        logger.info('Registro rechazado: email ya registrado', { email: emailNormalizado });
        throw new ErrorDominio(CODIGOS.EMAIL_DUPLICADO, 'Ya existe una cuenta con ese email');
      }

      const usuario = await repositorio.crear({
        email: emailNormalizado,
        nombre: nombreNormalizado,
        rol: ROLES.USUARIO,
        estado: ESTADOS.PENDIENTE,
        origen: 'local',
        creadoEn: reloj().toISOString(),
      });
      logger.info('Usuario registrado', { id: usuario.id, email: usuario.email });
      return vistaPublica(usuario);
    },

    // Confirma la cuenta (en el Hito 4 se invocará desde el enlace del correo).
    async confirmarCuenta(id) {
      const usuario = await obtenerExistente(id);
      if (usuario.estado !== ESTADOS.PENDIENTE) {
        throw new ErrorDominio(CODIGOS.ESTADO_INVALIDO, 'La cuenta no está pendiente de confirmación');
      }
      const actualizado = await repositorio.actualizar(id, { estado: ESTADOS.ACTIVO });
      logger.info('Cuenta confirmada', { id });
      return vistaPublica(actualizado);
    },

    // Listado completo de usuarios. Solo administrador.
    async listarUsuarios(idSolicitante) {
      await exigirAdministrador(idSolicitante);
      const usuarios = await repositorio.listar();
      return usuarios
        .sort((a, b) => a.creadoEn.localeCompare(b.creadoEn))
        .map(vistaPublica);
    },

    // ¿Está activo el usuario? (cuenta confirmada y no eliminada). Solo administrador.
    async estaActivo(idSolicitante, idUsuario) {
      await exigirAdministrador(idSolicitante);
      const usuario = await obtenerExistente(idUsuario);
      return usuario.estado === ESTADOS.ACTIVO;
    },

    // Eliminación (lógica). El administrador puede eliminar a cualquiera;
    // un usuario normal solo a sí mismo.
    async eliminarUsuario(idSolicitante, idUsuario) {
      const solicitante = await obtenerSolicitante(idSolicitante);
      const esAdministrador = solicitante.rol === ROLES.ADMINISTRADOR;
      if (!esAdministrador && solicitante.id !== idUsuario) {
        logger.warn('Eliminación denegada', { solicitante: solicitante.id, objetivo: idUsuario });
        throw new ErrorDominio(CODIGOS.PROHIBIDO, 'Solo puedes eliminar tu propia cuenta');
      }

      const usuario = await obtenerExistente(idUsuario);
      if (usuario.estado === ESTADOS.ELIMINADO) {
        throw new ErrorDominio(CODIGOS.USUARIO_NO_ENCONTRADO, 'El usuario no existe');
      }

      await repositorio.actualizar(idUsuario, {
        estado: ESTADOS.ELIMINADO,
        eliminadoEn: reloj().toISOString(),
      });
      logger.info('Usuario eliminado', { id: idUsuario, por: solicitante.id });
    },

    // Crea el administrador inicial (o promueve una cuenta existente).
    // Es idempotente: se invoca en cada arranque con ADMIN_EMAIL.
    async asegurarAdministrador({ email, nombre = 'Administrador' } = {}) {
      const emailNormalizado = normalizarEmail(email);
      const existente = await repositorio.buscarPorEmail(emailNormalizado);

      if (!existente) {
        const admin = await repositorio.crear({
          email: emailNormalizado,
          nombre: normalizarNombre(nombre),
          rol: ROLES.ADMINISTRADOR,
          estado: ESTADOS.ACTIVO,
          origen: 'local',
          creadoEn: reloj().toISOString(),
        });
        logger.info('Administrador inicial creado', { id: admin.id, email: admin.email });
        return vistaPublica(admin);
      }

      if (existente.rol === ROLES.ADMINISTRADOR && existente.estado === ESTADOS.ACTIVO) {
        return vistaPublica(existente);
      }

      const promovido = await repositorio.actualizar(existente.id, {
        rol: ROLES.ADMINISTRADOR,
        estado: ESTADOS.ACTIVO,
      });
      logger.info('Usuario promovido a administrador', { id: promovido.id });
      return vistaPublica(promovido);
    },
  };
}

module.exports = { crearServicioUsuarios, ROLES, ESTADOS };
