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
    // Base de datos (Hito 3). La URI incluye usuario y contraseña: es un
    // secreto. Sin URI se usan los repositorios en memoria (solo desarrollo
    // y pruebas; en producción el servidor se niega a arrancar sin ella).
    mongodbUri: env.MONGODB_URI || '',
    mongodbBase: env.MONGODB_DB || 'procesos2627pr',
    // Correo de confirmación con Brevo (Hito 4). La clave de API es un
    // secreto; sin ella, el enlace de confirmación se escribe en el log.
    brevoApiKey: env.BREVO_API_KEY || '',
    correoRemitente: env.CORREO_REMITENTE || '',
    nombreRemitente: env.CORREO_REMITENTE_NOMBRE || 'procesos2627pr',
    // URL pública de la aplicación (para construir el enlace de confirmación).
    urlBase: env.APP_URL || `http://localhost:${puerto}`,
    // Duración de la sesión en horas (7 días por defecto).
    duracionSesionMs: (horasSesion > 0 ? horasSesion : 24 * 7) * 60 * 60 * 1000,
    // En producción la cookie de sesión solo viaja por HTTPS.
    cookieSegura: entorno === 'production',
  };
}

module.exports = { leerConfig };
