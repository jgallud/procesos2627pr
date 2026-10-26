// CAPA DE LÓGICA DE NEGOCIO — gestión de usuarios.
//
// Contiene todas las reglas sobre usuarios. No conoce HTTP ni Express (eso es
// la capa API) ni cómo se guardan los datos (eso es la capa de datos): recibe
// un repositorio que cumple el contrato de server/data/ y lo usa. Tampoco sabe
// cómo se avisa al usuario para que confirme su cuenta: recibe un
// "notificador" (en el Hito 2 escribe el enlace en el log; en el Hito 4
// enviará un correo) con el método enviarConfirmacion({ email, nombre, token }).
//
// Modelo de usuario (almacenado):
//   { id, email, nombre, rol, estado, origen, creadoEn, eliminadoEn?,
//     hashContrasena?, hashTokenConfirmacion? }
//   rol:    'usuario' | 'administrador'
//   estado: 'pendiente' (sin confirmar el correo) | 'activo' | 'eliminado'
//   origen: 'local' | 'oauth'
//
// Un usuario está ACTIVO cuando ha confirmado su cuenta (o se registró por
// OAuth) y no ha sido eliminado, es decir, cuando estado === 'activo'.
// La eliminación es lógica (estado 'eliminado'): el usuario sigue en el
// listado del administrador con ese estado y no puede volver a iniciar sesión.
//
// Los hashes (contraseña y token de confirmación) nunca salen de esta capa:
// todo lo que se devuelve pasa por vistaPublica().

const { randomBytes, createHash, timingSafeEqual } = require('node:crypto');
const { ErrorDominio, CODIGOS } = require('./errores');
const contrasenasPorDefecto = require('./contrasenas');
const { loggerSilencioso } = require('../logger');

const ROLES = Object.freeze({ USUARIO: 'usuario', ADMINISTRADOR: 'administrador' });
const ESTADOS = Object.freeze({ PENDIENTE: 'pendiente', ACTIVO: 'activo', ELIMINADO: 'eliminado' });

const PATRON_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const LONGITUD_MAXIMA_NOMBRE = 100;
const LONGITUD_MINIMA_CONTRASENA = 8;
const LONGITUD_MAXIMA_CONTRASENA = 128;

// Notificador por defecto: no hace nada (útil en pruebas que no lo necesitan).
const notificadorNulo = Object.freeze({ async enviarConfirmacion() {} });

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

function validarContrasena(contrasena) {
  if (typeof contrasena !== 'string' || contrasena.length === 0) {
    throw new ErrorDominio(CODIGOS.DATOS_INVALIDOS, 'La contraseña es obligatoria');
  }
  if (contrasena.length < LONGITUD_MINIMA_CONTRASENA) {
    throw new ErrorDominio(CODIGOS.DATOS_INVALIDOS, `La contraseña debe tener al menos ${LONGITUD_MINIMA_CONTRASENA} caracteres`);
  }
  if (contrasena.length > LONGITUD_MAXIMA_CONTRASENA) {
    throw new ErrorDominio(CODIGOS.DATOS_INVALIDOS, `La contraseña no puede superar ${LONGITUD_MAXIMA_CONTRASENA} caracteres`);
  }
  return contrasena;
}

// Token de confirmación: "<id>.<secreto>". Solo se guarda el SHA-256 del
// secreto (el token tiene 256 bits aleatorios, así que no hace falta una
// función lenta como con las contraseñas). El id permite localizar al usuario
// con el contrato actual del repositorio, sin añadir búsquedas nuevas.
function generarTokenConfirmacion(id) {
  const secreto = randomBytes(32).toString('base64url');
  return { token: `${id}.${secreto}`, hash: sha256(secreto) };
}

function sha256(texto) {
  return createHash('sha256').update(texto).digest('hex');
}

function mismoHash(a, b) {
  const ba = Buffer.from(a ?? '', 'hex');
  const bb = Buffer.from(b ?? '', 'hex');
  return ba.length > 0 && ba.length === bb.length && timingSafeEqual(ba, bb);
}

// Vista pública de un usuario: lo que puede salir de la capa lógica.
// Lista blanca de campos: el hash de la contraseña y el del token NO salen nunca.
function vistaPublica(usuario) {
  const { id, email, nombre, rol, estado, origen, creadoEn } = usuario;
  return { id, email, nombre, rol, estado, origen, creadoEn };
}

function crearServicioUsuarios({
  repositorio,
  logger = loggerSilencioso,
  reloj = () => new Date(),
  notificador = notificadorNulo,
  contrasenas = contrasenasPorDefecto,
}) {
  if (!repositorio) throw new Error('crearServicioUsuarios necesita un repositorio');

  // Hash de una contraseña cualquiera para igualar tiempos cuando el email no
  // existe: así no se puede averiguar qué emails están registrados midiendo
  // cuánto tarda el inicio de sesión.
  let hashSenuelo;
  async function obtenerHashSenuelo() {
    hashSenuelo ??= await contrasenas.hashear(randomBytes(16).toString('hex'));
    return hashSenuelo;
  }

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
    // Alta de un usuario local con email y contraseña. Queda pendiente hasta
    // que confirme su cuenta con el token que recibe a través del notificador.
    async registrarUsuario({ email, nombre, contrasena } = {}) {
      const emailNormalizado = normalizarEmail(email);
      const nombreNormalizado = normalizarNombre(nombre);
      validarContrasena(contrasena);

      const existente = await repositorio.buscarPorEmail(emailNormalizado);
      if (existente) {
        logger.info('Registro rechazado: email ya registrado', { email: emailNormalizado });
        throw new ErrorDominio(CODIGOS.EMAIL_DUPLICADO, 'Ya existe una cuenta con ese email');
      }

      const creado = await repositorio.crear({
        email: emailNormalizado,
        nombre: nombreNormalizado,
        rol: ROLES.USUARIO,
        estado: ESTADOS.PENDIENTE,
        origen: 'local',
        creadoEn: reloj().toISOString(),
        hashContrasena: await contrasenas.hashear(contrasena),
      });

      const { token, hash } = generarTokenConfirmacion(creado.id);
      const usuario = await repositorio.actualizar(creado.id, { hashTokenConfirmacion: hash });
      logger.info('Usuario registrado', { id: usuario.id, email: usuario.email });

      await notificador.enviarConfirmacion({ email: usuario.email, nombre: usuario.nombre, token });
      return vistaPublica(usuario);
    },

    // Confirma la cuenta a partir del token enviado al registrarse.
    async confirmarCuenta(token) {
      const invalido = () => new ErrorDominio(CODIGOS.TOKEN_INVALIDO, 'El enlace de confirmación no es válido o ya se usó');
      if (typeof token !== 'string') throw invalido();

      const separador = token.indexOf('.');
      const id = separador > 0 ? token.slice(0, separador) : '';
      const secreto = separador > 0 ? token.slice(separador + 1) : '';
      const usuario = id && secreto ? await repositorio.buscarPorId(id) : null;

      if (!usuario || usuario.estado !== ESTADOS.PENDIENTE || !mismoHash(sha256(secreto), usuario.hashTokenConfirmacion)) {
        logger.warn('Confirmación de cuenta rechazada', { id: id || undefined });
        throw invalido();
      }

      const actualizado = await repositorio.actualizar(id, { estado: ESTADOS.ACTIVO, hashTokenConfirmacion: null });
      logger.info('Cuenta confirmada', { id });
      return vistaPublica(actualizado);
    },

    // Inicio de sesión local. Devuelve el usuario si las credenciales son
    // correctas y la cuenta puede operar; la capa API crea entonces la sesión.
    async iniciarSesion({ email, contrasena } = {}) {
      if (typeof email !== 'string' || typeof contrasena !== 'string' || !email.trim() || !contrasena) {
        throw new ErrorDominio(CODIGOS.DATOS_INVALIDOS, 'Introduce el email y la contraseña');
      }
      const usuario = await repositorio.buscarPorEmail(email.trim().toLowerCase());

      // Primero se comprueba la contraseña (también si el usuario no existe,
      // contra un hash señuelo). Solo con la contraseña correcta se informa
      // del estado de la cuenta.
      const hash = usuario?.hashContrasena ?? (await obtenerHashSenuelo());
      const correcta = await contrasenas.verificar(contrasena, hash);
      if (!usuario || !usuario.hashContrasena || !correcta) {
        logger.warn('Inicio de sesión fallido', { email: email.trim().toLowerCase() });
        throw new ErrorDominio(CODIGOS.CREDENCIALES_INVALIDAS, 'Email o contraseña incorrectos');
      }
      if (usuario.estado === ESTADOS.PENDIENTE) {
        logger.info('Inicio de sesión rechazado: cuenta pendiente', { id: usuario.id });
        throw new ErrorDominio(CODIGOS.CUENTA_PENDIENTE, 'Debes confirmar tu cuenta antes de iniciar sesión');
      }
      if (usuario.estado === ESTADOS.ELIMINADO) {
        logger.info('Inicio de sesión rechazado: cuenta eliminada', { id: usuario.id });
        throw new ErrorDominio(CODIGOS.CUENTA_ELIMINADA, 'Esta cuenta ha sido eliminada');
      }

      logger.info('Inicio de sesión', { id: usuario.id });
      return vistaPublica(usuario);
    },

    // Inicio de sesión con un proveedor externo (OAuth, decisiones D-17 a
    // D-19). Recibe los datos que el proveedor ya ha comprobado: no sabe nada
    // de Google ni de HTTP. Si el correo no tiene cuenta, la crea activa (un
    // usuario de OAuth no necesita confirmar el correo); si tiene una cuenta
    // local, no deja entrar por esta vía (D-18).
    async iniciarSesionOAuth({ email, nombre, emailVerificado } = {}) {
      const emailNormalizado = normalizarEmail(email);
      if (emailVerificado !== true) {
        logger.warn('OAuth rechazado: email no verificado por el proveedor', { email: emailNormalizado });
        throw new ErrorDominio(CODIGOS.EMAIL_NO_VERIFICADO, 'El proveedor no ha verificado tu email');
      }

      const existente = await repositorio.buscarPorEmail(emailNormalizado);
      if (existente && existente.origen !== 'oauth') {
        logger.info('OAuth rechazado: el email tiene una cuenta local', { id: existente.id });
        throw new ErrorDominio(CODIGOS.CUENTA_LOCAL, 'Ya existe una cuenta con ese email: inicia sesión con tu contraseña');
      }
      if (existente?.estado === ESTADOS.ELIMINADO) {
        logger.info('OAuth rechazado: cuenta eliminada', { id: existente.id });
        throw new ErrorDominio(CODIGOS.CUENTA_ELIMINADA, 'Esta cuenta ha sido eliminada');
      }
      if (existente) {
        logger.info('Inicio de sesión con OAuth', { id: existente.id });
        return vistaPublica(existente);
      }

      const creado = await repositorio.crear({
        email: emailNormalizado,
        nombre: normalizarNombre(typeof nombre === 'string' ? nombre.slice(0, LONGITUD_MAXIMA_NOMBRE) : undefined),
        rol: ROLES.USUARIO,
        estado: ESTADOS.ACTIVO,
        origen: 'oauth',
        creadoEn: reloj().toISOString(),
      });
      logger.info('Usuario registrado con OAuth', { id: creado.id, email: creado.email });
      return vistaPublica(creado);
    },

    // Usuario asociado a una sesión. Falla si ya no puede operar (p. ej. ha
    // sido eliminado después de iniciar sesión).
    async usuarioDeSesion(idSolicitante) {
      return vistaPublica(await obtenerSolicitante(idSolicitante));
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
    // Es idempotente: se invoca en cada arranque con ADMIN_EMAIL y
    // ADMIN_PASSWORD. Si se indica contraseña, se (re)establece su hash, de
    // modo que cambiar la variable de entorno cambia la contraseña.
    async asegurarAdministrador({ email, nombre = 'Administrador', contrasena } = {}) {
      const emailNormalizado = normalizarEmail(email);
      const hashContrasena = contrasena === undefined ? undefined : await contrasenas.hashear(validarContrasena(contrasena));
      const conContrasena = hashContrasena ? { hashContrasena } : {};
      const existente = await repositorio.buscarPorEmail(emailNormalizado);

      if (!existente) {
        const admin = await repositorio.crear({
          email: emailNormalizado,
          nombre: normalizarNombre(nombre),
          rol: ROLES.ADMINISTRADOR,
          estado: ESTADOS.ACTIVO,
          origen: 'local',
          creadoEn: reloj().toISOString(),
          ...conContrasena,
        });
        logger.info('Administrador inicial creado', { id: admin.id, email: admin.email });
        return vistaPublica(admin);
      }

      const yaEsAdmin = existente.rol === ROLES.ADMINISTRADOR && existente.estado === ESTADOS.ACTIVO;
      if (yaEsAdmin && !hashContrasena) return vistaPublica(existente);

      const actualizado = await repositorio.actualizar(existente.id, {
        rol: ROLES.ADMINISTRADOR,
        estado: ESTADOS.ACTIVO,
        hashTokenConfirmacion: null,
        ...conContrasena,
      });
      if (!yaEsAdmin) logger.info('Usuario promovido a administrador', { id: actualizado.id });
      return vistaPublica(actualizado);
    },
  };
}

module.exports = { crearServicioUsuarios, ROLES, ESTADOS, LONGITUD_MINIMA_CONTRASENA };
