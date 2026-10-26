// Punto de entrada y "composición" de las capas:
//   capa de datos  -> repositorios de usuarios y de sesiones (MongoDB o memoria)
//   capa lógica    -> servicios de usuarios y de sesiones (reciben los repositorios)
//   capa API       -> app Express (recibe los servicios)
// Cambiar la base de datos solo afecta a esta función: los repositorios de
// MongoDB cumplen el mismo contrato que los de memoria, así que ni la lógica
// ni la API cambian. El envío del enlace de confirmación (por correo con
// Brevo, o en el log si no hay clave) solo afecta a la creación del notificador.

const { leerConfig, validarConfig } = require('./config');
const { crearLogger } = require('./logger');
const { conectarMongo } = require('./data/conexionMongo');
const { crearRepositorioUsuariosMongo } = require('./data/usuarioRepositorioMongo');
const { crearRepositorioSesionesMongo } = require('./data/sesionRepositorioMongo');
const { crearRepositorioUsuariosMemoria } = require('./data/usuarioRepositorioMemoria');
const { crearRepositorioSesionesMemoria } = require('./data/sesionRepositorioMemoria');
const { crearNotificadorLog } = require('./notificacion/notificadorLog');
const { crearNotificadorBrevo } = require('./notificacion/notificadorBrevo');
const { crearProveedorGoogle } = require('./oauth/proveedorGoogle');
const { crearServicioUsuarios } = require('./logic/usuarioService');
const { crearServicioSesiones } = require('./logic/sesionService');
const { crearApp } = require('./app');

// Elige la implementación de la capa de datos según la configuración.
async function crearRepositorios(config, logger) {
  if (config.mongodbUri) {
    const conexion = await conectarMongo({ uri: config.mongodbUri, nombreBase: config.mongodbBase, logger });
    return {
      usuarios: crearRepositorioUsuariosMongo({ db: conexion.db }),
      sesiones: crearRepositorioSesionesMongo({ db: conexion.db }),
      cerrar: conexion.cerrar,
    };
  }
  if (config.entorno === 'production') {
    throw new Error('MONGODB_URI es obligatoria en producción');
  }
  logger.warn('MONGODB_URI no está definida: datos en memoria (se pierden al reiniciar)');
  return {
    usuarios: crearRepositorioUsuariosMemoria(),
    sesiones: crearRepositorioSesionesMemoria(),
    cerrar: async () => {},
  };
}

// Elige cómo se envía el enlace de confirmación de cuenta: por correo con
// Brevo si hay clave de API; si no, se escribe en el log (desarrollo, o
// producción mientras no se configure el secreto).
function crearNotificador(config, logger) {
  if (config.brevoApiKey) {
    if (!config.correoRemitente) {
      throw new Error('CORREO_REMITENTE es obligatoria si se define BREVO_API_KEY');
    }
    logger.info('Correo de confirmación con Brevo', { remitente: config.correoRemitente });
    return crearNotificadorBrevo({
      apiKey: config.brevoApiKey,
      remitente: { email: config.correoRemitente, nombre: config.nombreRemitente },
      urlBase: config.urlBase,
      logger,
    });
  }
  const aviso = 'BREVO_API_KEY no está definida: el enlace de confirmación se escribe en el log';
  if (config.entorno === 'production') logger.warn(aviso);
  else logger.info(aviso);
  return crearNotificadorLog({ logger, urlBase: config.urlBase });
}

// Proveedores de inicio de sesión externo (OAuth) configurados. Sin las
// credenciales de Google, no se ofrece y todo lo demás funciona igual.
function crearProveedoresOAuth(config, logger) {
  const { googleClientId, googleClientSecret } = config;
  if (!googleClientId && !googleClientSecret) {
    logger.info('GOOGLE_CLIENT_ID y GOOGLE_CLIENT_SECRET no están definidas: inicio de sesión con Google desactivado');
    return {};
  }
  if (!googleClientId || !googleClientSecret) {
    throw new Error('Para el inicio de sesión con Google hacen falta GOOGLE_CLIENT_ID y GOOGLE_CLIENT_SECRET');
  }
  const urlRetorno = `${config.urlBase.replace(/\/+$/, '')}/api/oauth/google/retorno`;
  logger.info('Inicio de sesión con Google activado', { urlRetorno });
  return { google: crearProveedorGoogle({ clientId: googleClientId, clientSecret: googleClientSecret, urlRetorno }) };
}

async function main() {
  const config = leerConfig();
  validarConfig(config);
  const logger = crearLogger({ nivel: config.nivelLog });

  const repositorios = await crearRepositorios(config, logger);
  const notificador = crearNotificador(config, logger);

  const servicioUsuarios = crearServicioUsuarios({ repositorio: repositorios.usuarios, logger, notificador });
  const servicioSesiones = crearServicioSesiones({
    repositorio: repositorios.sesiones,
    duracionMs: config.duracionSesionMs,
    logger,
  });

  if (config.adminEmail) {
    await servicioUsuarios.asegurarAdministrador({ email: config.adminEmail, contrasena: config.adminContrasena });
    if (!config.adminContrasena) {
      logger.warn('ADMIN_PASSWORD no está definida: el administrador no podrá iniciar sesión');
    }
  } else {
    logger.warn('ADMIN_EMAIL no está definida: no habrá administrador inicial');
  }

  const proveedoresOAuth = crearProveedoresOAuth(config, logger);
  const app = crearApp({ servicioUsuarios, servicioSesiones, proveedoresOAuth, logger, cookieSegura: config.cookieSegura });
  const servidor = app.listen(config.puerto, () => {
    logger.info('Servidor iniciado', { puerto: config.puerto, entorno: config.entorno });
  });

  // Parada ordenada: Cloud Run envía SIGTERM antes de apagar la instancia.
  // Se dejan de aceptar peticiones, se terminan las que están en curso y se
  // cierra la conexión con la base de datos.
  let parando = false;
  async function parar(senal) {
    if (parando) return;
    parando = true;
    logger.info('Parando el servidor', { senal });
    await new Promise((resolve) => servidor.close(resolve));
    await repositorios.cerrar();
    process.exit(0);
  }
  process.on('SIGTERM', () => parar('SIGTERM'));
  process.on('SIGINT', () => parar('SIGINT'));
}

main().catch((err) => {
  console.error('No se pudo iniciar el servidor:', err.message);
  process.exit(1);
});
