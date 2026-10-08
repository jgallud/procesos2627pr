// CAPA API — sesión del usuario mediante cookie.
//
// Sustituye a la cabecera provisional X-Usuario-Id del Hito 1. Al iniciar
// sesión el servidor envía una cookie con un identificador aleatorio; el
// navegador la devuelve sola en cada petición (mismo origen), así la sesión
// se mantiene al recargar la página. Las rutas y la capa lógica no cambian:
// siguen leyendo req.idSolicitante.
//
// Atributos de la cookie:
//   HttpOnly        el JavaScript de la página no puede leerla (mitiga XSS)
//   SameSite=Lax    no se envía en peticiones POST/DELETE desde otros sitios (mitiga CSRF)
//   Secure          solo por HTTPS (en producción)
//   Max-Age         persiste entre recargas y reinicios del navegador hasta caducar
//
//   POST   /api/sesion   iniciar sesión {email, contrasena} -> 200 usuario + cookie
//   GET    /api/sesion   usuario de la sesión actual        -> 200 | 401
//   DELETE /api/sesion   cerrar sesión                      -> 204 (borra la cookie)

const express = require('express');

const NOMBRE_COOKIE = 'sesion';

function leerCookie(req, nombre) {
  const cabecera = req.headers.cookie;
  if (!cabecera) return undefined;
  for (const parte of cabecera.split(';')) {
    const igual = parte.indexOf('=');
    if (igual < 0) continue;
    if (parte.slice(0, igual).trim() === nombre) {
      try {
        return decodeURIComponent(parte.slice(igual + 1).trim());
      } catch {
        return undefined;
      }
    }
  }
  return undefined;
}

function crearGestorCookie({ cookieSegura }) {
  const atributos = (maxAgeSegundos) =>
    ['Path=/', 'HttpOnly', 'SameSite=Lax', `Max-Age=${maxAgeSegundos}`, ...(cookieSegura ? ['Secure'] : [])].join('; ');

  return {
    poner(res, idSesion, duracionMs) {
      res.append('Set-Cookie', `${NOMBRE_COOKIE}=${encodeURIComponent(idSesion)}; ${atributos(Math.floor(duracionMs / 1000))}`);
    },
    borrar(res) {
      res.append('Set-Cookie', `${NOMBRE_COOKIE}=; ${atributos(0)}`);
    },
  };
}

// Middleware: identifica al solicitante a partir de la cookie de sesión.
// No rechaza nada por sí mismo: si no hay sesión válida deja
// req.idSolicitante sin definir y la capa lógica responde "no autenticado"
// en las operaciones que lo requieren.
function crearIdentificadorSesion({ servicioSesiones, cookie }) {
  return async (req, res, next) => {
    const idSesion = leerCookie(req, NOMBRE_COOKIE);
    req.idSesion = idSesion;
    req.idSolicitante = await servicioSesiones.resolver(idSesion);
    // Cookie con una sesión inexistente o caducada: se pide al navegador que la borre.
    if (idSesion && !req.idSolicitante) {
      req.idSesion = undefined;
      cookie.borrar(res);
    }
    next();
  };
}

function crearRouterSesion({ servicioUsuarios, servicioSesiones, cookie }) {
  const router = express.Router();

  router.post('/', async (req, res) => {
    const { email, contrasena } = req.body ?? {};
    const usuario = await servicioUsuarios.iniciarSesion({ email, contrasena });
    // Si ya había una sesión en este navegador se cierra: siempre se emite
    // un identificador nuevo tras autenticarse (evita la fijación de sesión).
    if (req.idSesion) await servicioSesiones.cerrar(req.idSesion);
    const sesion = await servicioSesiones.abrir(usuario.id);
    cookie.poner(res, sesion.id, servicioSesiones.duracionMs);
    res.json(usuario);
  });

  router.get('/', async (req, res) => {
    res.json(await servicioUsuarios.usuarioDeSesion(req.idSolicitante));
  });

  router.delete('/', async (req, res) => {
    if (req.idSesion) await servicioSesiones.cerrar(req.idSesion);
    cookie.borrar(res);
    res.status(204).end();
  });

  return router;
}

module.exports = { crearIdentificadorSesion, crearRouterSesion, crearGestorCookie, leerCookie, NOMBRE_COOKIE };
