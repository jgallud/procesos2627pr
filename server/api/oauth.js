// CAPA API — inicio de sesión con un proveedor externo (OAuth), decisión D-19.
//
//   GET /api/oauth/proveedores           proveedores configurados -> 200 {proveedores}
//   GET /api/oauth/:proveedor            redirige al proveedor (302) con un state
//   GET /api/oauth/:proveedor/retorno    vuelta desde el proveedor: comprueba el
//                                        state, obtiene el usuario, abre sesión y
//                                        redirige a / (o a /?error_oauth=<código>)
//
// Esta capa solo traduce HTTP: el proveedor (server/oauth/) habla con Google
// y la capa lógica decide si el usuario puede entrar (iniciarSesionOAuth).
//
// El state es un valor aleatorio que se guarda en una cookie HttpOnly antes de
// ir al proveedor y debe volver igual: así nadie puede colar en el navegador
// de otra persona un retorno que no ha iniciado ella (CSRF).

const express = require('express');
const { randomBytes, timingSafeEqual } = require('node:crypto');
const { leerCookie } = require('./sesion');

const COOKIE_STATE = 'oauth_state';
const DURACION_STATE_S = 10 * 60;

function mismoTexto(a, b) {
  const ba = Buffer.from(String(a ?? ''));
  const bb = Buffer.from(String(b ?? ''));
  return ba.length > 0 && ba.length === bb.length && timingSafeEqual(ba, bb);
}

function crearRouterOAuth({ proveedores = {}, servicioUsuarios, servicioSesiones, cookie, cookieSegura = false, logger }) {
  const router = express.Router();

  const atributosState = (maxAge) =>
    ['Path=/api/oauth', 'HttpOnly', 'SameSite=Lax', `Max-Age=${maxAge}`, ...(cookieSegura ? ['Secure'] : [])].join('; ');

  // Vuelve a la página principal indicando por qué no se pudo entrar; la
  // interfaz traduce el código a un mensaje.
  const volverConError = (res, codigo) => res.redirect(302, `/?error_oauth=${encodeURIComponent(codigo)}`);

  router.get('/proveedores', (req, res) => {
    res.json({ proveedores: Object.keys(proveedores) });
  });

  router.get('/:proveedor', (req, res) => {
    const proveedor = proveedores[req.params.proveedor];
    if (!proveedor) return res.status(404).json({ error: 'Proveedor de inicio de sesión no disponible' });

    const state = randomBytes(32).toString('base64url');
    res.append('Set-Cookie', `${COOKIE_STATE}=${state}; ${atributosState(DURACION_STATE_S)}`);
    return res.redirect(302, proveedor.urlAutorizacion(state));
  });

  router.get('/:proveedor/retorno', async (req, res) => {
    const proveedor = proveedores[req.params.proveedor];
    const stateGuardado = leerCookie(req, COOKIE_STATE);
    res.append('Set-Cookie', `${COOKIE_STATE}=; ${atributosState(0)}`);

    if (!proveedor) return volverConError(res, 'OAUTH_FALLIDO');
    if (req.query.error) return volverConError(res, 'OAUTH_CANCELADO');
    if (!mismoTexto(req.query.state, stateGuardado) || typeof req.query.code !== 'string') {
      logger.warn('OAuth rechazado: state ausente o distinto', { proveedor: req.params.proveedor });
      return volverConError(res, 'OAUTH_FALLIDO');
    }

    let usuario;
    try {
      const datos = await proveedor.obtenerUsuario(req.query.code);
      usuario = await servicioUsuarios.iniciarSesionOAuth(datos);
    } catch (err) {
      if (err.name === 'ErrorDominio') return volverConError(res, err.codigo);
      logger.error('Fallo en el inicio de sesión con OAuth', { proveedor: req.params.proveedor, error: err.message });
      return volverConError(res, 'OAUTH_FALLIDO');
    }

    // Igual que en el inicio de sesión local: identificador de sesión nuevo.
    if (req.idSesion) await servicioSesiones.cerrar(req.idSesion);
    const sesion = await servicioSesiones.abrir(usuario.id);
    cookie.poner(res, sesion.id, servicioSesiones.duracionMs);
    return res.redirect(302, '/');
  });

  return router;
}

module.exports = { crearRouterOAuth, COOKIE_STATE };
