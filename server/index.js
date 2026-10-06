// Punto de entrada y "composición" de las capas:
//   capa de datos  -> repositorio de usuarios (en memoria en el Hito 1)
//   capa lógica    -> servicio de usuarios (recibe el repositorio)
//   capa API       -> app Express (recibe el servicio)
// Cambiar la base de datos (Hito 3) solo afecta a la primera línea de la
// composición: se crea otro repositorio con el mismo contrato.

const { leerConfig } = require('./config');
const { crearLogger } = require('./logger');
const { crearRepositorioUsuariosMemoria } = require('./data/usuarioRepositorioMemoria');
const { crearServicioUsuarios } = require('./logic/usuarioService');
const { crearApp } = require('./app');

async function main() {
  const config = leerConfig();
  const logger = crearLogger({ nivel: config.nivelLog });

  const repositorio = crearRepositorioUsuariosMemoria();
  const servicioUsuarios = crearServicioUsuarios({ repositorio, logger });

  if (config.adminEmail) {
    await servicioUsuarios.asegurarAdministrador({ email: config.adminEmail });
  } else {
    logger.warn('ADMIN_EMAIL no está definida: no habrá administrador inicial');
  }

  const app = crearApp({ servicioUsuarios, logger });
  app.listen(config.puerto, () => {
    logger.info('Servidor iniciado', { puerto: config.puerto, entorno: config.entorno });
  });
}

main().catch((err) => {
  console.error('No se pudo iniciar el servidor:', err);
  process.exit(1);
});
