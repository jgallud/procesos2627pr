// Punto de entrada y "composición" de las capas:
//   capa de datos  -> repositorios de usuarios y de sesiones (en memoria hasta el Hito 3)
//   capa lógica    -> servicios de usuarios y de sesiones (reciben los repositorios)
//   capa API       -> app Express (recibe los servicios)
// Cambiar la base de datos (Hito 3) solo afecta a la creación de los
// repositorios: se crean otros con el mismo contrato. Cambiar el envío del
// enlace de confirmación (Hito 4) solo afecta a la creación del notificador.

const { leerConfig } = require('./config');
const { crearLogger } = require('./logger');
const { crearRepositorioUsuariosMemoria } = require('./data/usuarioRepositorioMemoria');
const { crearRepositorioSesionesMemoria } = require('./data/sesionRepositorioMemoria');
const { crearNotificadorLog } = require('./notificacion/notificadorLog');
const { crearServicioUsuarios } = require('./logic/usuarioService');
const { crearServicioSesiones } = require('./logic/sesionService');
const { crearApp } = require('./app');

async function main() {
  const config = leerConfig();
  const logger = crearLogger({ nivel: config.nivelLog });

  const repositorioUsuarios = crearRepositorioUsuariosMemoria();
  const repositorioSesiones = crearRepositorioSesionesMemoria();
  const notificador = crearNotificadorLog({ logger, urlBase: config.urlBase });

  const servicioUsuarios = crearServicioUsuarios({ repositorio: repositorioUsuarios, logger, notificador });
  const servicioSesiones = crearServicioSesiones({
    repositorio: repositorioSesiones,
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

  const app = crearApp({ servicioUsuarios, servicioSesiones, logger, cookieSegura: config.cookieSegura });
  app.listen(config.puerto, () => {
    logger.info('Servidor iniciado', { puerto: config.puerto, entorno: config.entorno });
  });
}

main().catch((err) => {
  console.error('No se pudo iniciar el servidor:', err);
  process.exit(1);
});
