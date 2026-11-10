// FRONTEND — CAPA DE COMUNICACIÓN CON EL SERVIDOR.
//
// Único módulo del cliente que habla con el backend. Traduce cada operación a
// una petición HTTP/JSON contra /api (mismo origen) y devuelve datos o lanza
// un ErrorApi. No toca el DOM: la interfaz (interfaz.js) solo llama a estas
// funciones y nunca usa fetch directamente.
//
// La sesión viaja en una cookie HttpOnly que gestiona el navegador: este
// módulo no puede leerla ni necesita guardarla en ningún sitio.

export class ErrorApi extends Error {
  constructor(estado, codigo, mensaje) {
    super(mensaje);
    this.name = 'ErrorApi';
    this.estado = estado; // código HTTP (0 si no hubo respuesta)
    this.codigo = codigo; // código de dominio enviado por el servidor, si lo hay
  }

  get sinSesion() {
    return this.estado === 401;
  }
}

async function peticion(metodo, ruta, cuerpo) {
  const opciones = {
    method: metodo,
    credentials: 'same-origin',
    headers: { Accept: 'application/json' },
  };
  if (cuerpo !== undefined) {
    opciones.headers['Content-Type'] = 'application/json';
    opciones.body = JSON.stringify(cuerpo);
  }

  let respuesta;
  try {
    respuesta = await fetch(`/api${ruta}`, opciones);
  } catch {
    throw new ErrorApi(0, 'SIN_CONEXION', 'No se pudo conectar con el servidor. Comprueba tu conexión e inténtalo de nuevo.');
  }

  if (respuesta.status === 204) return null;

  let datos = null;
  try {
    datos = await respuesta.json();
  } catch {
    // Respuesta sin JSON (no debería ocurrir en esta API).
  }

  if (!respuesta.ok) {
    const mensaje = datos?.error || `Error inesperado del servidor (${respuesta.status})`;
    throw new ErrorApi(respuesta.status, datos?.codigo, mensaje);
  }
  return datos;
}

// --- Servidor ---------------------------------------------------------------
export const salud = () => peticion('GET', '/salud');

// --- Cuenta y sesión --------------------------------------------------------
export const registrar = ({ email, nombre, contrasena }) => peticion('POST', '/usuarios', { email, nombre, contrasena });
export const confirmarCuenta = (token) => peticion('POST', '/usuarios/confirmacion', { token });
export const iniciarSesion = ({ email, contrasena }) => peticion('POST', '/sesion', { email, contrasena });
export const sesionActual = () => peticion('GET', '/sesion');
export const cerrarSesion = () => peticion('DELETE', '/sesion');

// --- Inicio de sesión externo (OAuth) ---------------------------------------
// El inicio con un proveedor es una navegación de página completa (hay que ir
// a la web del proveedor y volver), no una petición fetch: la interfaz solo
// necesita saber qué proveedores hay y a qué dirección llevar al navegador.
export const proveedoresOAuth = () => peticion('GET', '/oauth/proveedores');
export const urlInicioOAuth = (proveedor) => `/api/oauth/${encodeURIComponent(proveedor)}`;

// --- Partidas de Hundir la Flota (Hito 5) ------------------------------------
// Todas devuelven la vista de la partida para este jugador: el servidor decide
// el resultado de cada jugada y nunca envía la flota del rival hasta el final.
const rutaPartida = (id) => `/partidas/${encodeURIComponent(id)}`;
export const crearPartidaContraMaquina = () => peticion('POST', '/partidas');
export const partidaActual = () => peticion('GET', '/partidas/actual');
export const obtenerPartida = (id) => peticion('GET', rutaPartida(id));
export const colocarBarco = (id, { barco, casilla, orientacion }) =>
  peticion('POST', `${rutaPartida(id)}/barcos`, { barco, casilla, orientacion });
export const retirarBarco = (id, barco) => peticion('DELETE', `${rutaPartida(id)}/barcos/${encodeURIComponent(barco)}`);
export const colocarFlotaAleatoria = (id) => peticion('POST', `${rutaPartida(id)}/flota-aleatoria`);
export const disparar = (id, casilla) => peticion('POST', `${rutaPartida(id)}/disparos`, { casilla });
export const abandonarPartida = (id) => peticion('POST', `${rutaPartida(id)}/abandono`);

// --- Usuarios ---------------------------------------------------------------
export const listarUsuarios = () => peticion('GET', '/usuarios');
export const estaActivo = (id) => peticion('GET', `/usuarios/${encodeURIComponent(id)}/activo`);
export const eliminarUsuario = (id) => peticion('DELETE', `/usuarios/${encodeURIComponent(id)}`);
