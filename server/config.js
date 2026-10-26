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
    // Inicio de sesión con Google (Hito 4). El client secret es un secreto;
    // sin las dos variables, el inicio de sesión con Google no se ofrece.
    googleClientId: env.GOOGLE_CLIENT_ID || '',
    googleClientSecret: env.GOOGLE_CLIENT_SECRET || '',
    // URL pública de la aplicación (para construir el enlace de confirmación).
    // En desarrollo, por defecto localhost; en producción es obligatoria
    // (ver validarConfig), para que el enlace nunca apunte a localhost.
    urlBase: env.APP_URL || `http://localhost:${puerto}`,
    urlBaseDefinida: Boolean(env.APP_URL),
    // Duración de la sesión en horas (7 días por defecto).
    duracionSesionMs: (horasSesion > 0 ? horasSesion : 24 * 7) * 60 * 60 * 1000,
    // En producción la cookie de sesión solo viaja por HTTPS.
    cookieSegura: entorno === 'production',
  };
}

// Comprueba la configuración que no puede faltar en producción. Lanza un
// error con un mensaje claro: el servidor no arranca y Cloud Run sigue
// sirviendo la revisión anterior.
function validarConfig(config) {
  if (config.entorno !== 'production') return;
  if (!config.urlBaseDefinida) {
    throw new Error('APP_URL es obligatoria en producción: es la URL pública que llevan los enlaces de confirmación');
  }
  if (!config.urlBase.startsWith('https://')) {
    throw new Error('APP_URL debe empezar por https:// en producción');
  }
}

module.exports = { leerConfig, validarConfig };
