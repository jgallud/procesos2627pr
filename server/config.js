// Configuración centralizada: toda la configuración y los secretos se leen
// de variables de entorno, nunca se escriben en el código.

function leerConfig(env = process.env) {
  const puerto = Number(env.PORT) || 3000;
  const entorno = env.NODE_ENV || 'development';
  const horasSesion = Number(env.SESION_HORAS);
  return {
    puerto,
    entorno,
    nivelLog: env.LOG_LEVEL || 'info',
    // Administrador inicial: se crea (o se promueve) al arrancar. La
    // contraseña es un secreto: solo llega por variable de entorno.
    adminEmail: env.ADMIN_EMAIL || '',
    adminContrasena: env.ADMIN_PASSWORD || undefined,
    // URL pública de la aplicación (para construir el enlace de confirmación).
    urlBase: env.APP_URL || `http://localhost:${puerto}`,
    // Duración de la sesión en horas (7 días por defecto).
    duracionSesionMs: (horasSesion > 0 ? horasSesion : 24 * 7) * 60 * 60 * 1000,
    // En producción la cookie de sesión solo viaja por HTTPS.
    cookieSegura: entorno === 'production',
  };
}

module.exports = { leerConfig };
