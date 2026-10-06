// Configuración centralizada: toda la configuración y los secretos se leen
// de variables de entorno, nunca se escriben en el código.

function leerConfig(env = process.env) {
  return {
    puerto: Number(env.PORT) || 3000,
    entorno: env.NODE_ENV || 'development',
    nivelLog: env.LOG_LEVEL || 'info',
    // Email del administrador inicial: se crea (o se promueve) al arrancar.
    adminEmail: env.ADMIN_EMAIL || '',
  };
}

module.exports = { leerConfig };
