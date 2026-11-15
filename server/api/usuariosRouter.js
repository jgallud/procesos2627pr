// CAPA API — endpoints REST de usuarios.
//
// Solo traduce HTTP <-> llamadas a la capa lógica: lee parámetros, llama al
// servicio y devuelve JSON. No contiene reglas de negocio (quién puede hacer
// qué lo decide el servicio). Express 5 pasa al manejador de errores
// cualquier promesa rechazada, por eso no hay try/catch.
//
//   POST   /api/usuarios               alta de usuario            -> 201
//   POST   /api/usuarios/confirmacion  confirmar cuenta {token}   -> 200
//   POST   /api/usuarios/restablecimiento/solicitud  {email}      -> 202 (MJ-12; igual exista o no)
//   POST   /api/usuarios/restablecimiento  {token, contrasena}    -> 200 (MJ-12; cierra sus sesiones)
//   GET    /api/usuarios               listado (administrador)    -> 200
//   GET    /api/usuarios/:id/activo    ¿está activo? (admin)      -> 200
//   DELETE /api/usuarios/:id           eliminar (admin o uno mismo) -> 204
//
// El solicitante (req.idSolicitante) lo fija el middleware de sesión.

const express = require('express');

function crearRouterUsuarios({ servicioUsuarios, servicioSesiones, cookie }) {
  const router = express.Router();

  router.post('/', async (req, res) => {
    const { email, nombre, contrasena } = req.body ?? {};
    const usuario = await servicioUsuarios.registrarUsuario({ email, nombre, contrasena });
    res.status(201).json(usuario);
  });

  router.post('/confirmacion', async (req, res) => {
    const usuario = await servicioUsuarios.confirmarCuenta(req.body?.token);
    res.json(usuario);
  });

  // MJ-12: la respuesta es la misma tanto si el email tiene cuenta como si
  // no, para no revelar qué emails están registrados.
  router.post('/restablecimiento/solicitud', async (req, res) => {
    await servicioUsuarios.solicitarRestablecimiento({ email: req.body?.email });
    res.status(202).json({ mensaje: 'Si el email corresponde a una cuenta, recibirás un enlace para cambiar la contraseña' });
  });

  router.post('/restablecimiento', async (req, res) => {
    const { token, contrasena } = req.body ?? {};
    const usuario = await servicioUsuarios.restablecerContrasena({ token, contrasena });
    // Con la contraseña cambiada, se cierran todas las sesiones abiertas: si
    // alguien la conocía, deja de tener acceso.
    await servicioSesiones.cerrarTodas(usuario.id);
    res.json(usuario);
  });

  router.get('/', async (req, res) => {
    const usuarios = await servicioUsuarios.listarUsuarios(req.idSolicitante);
    res.json(usuarios);
  });

  router.get('/:id/activo', async (req, res) => {
    const activo = await servicioUsuarios.estaActivo(req.idSolicitante, req.params.id);
    res.json({ id: req.params.id, activo });
  });

  router.delete('/:id', async (req, res) => {
    await servicioUsuarios.eliminarUsuario(req.idSolicitante, req.params.id);
    // El usuario eliminado pierde todas sus sesiones abiertas; si se ha
    // eliminado a sí mismo, además se borra la cookie de este navegador.
    await servicioSesiones.cerrarTodas(req.params.id);
    if (req.params.id === req.idSolicitante) cookie.borrar(res);
    res.status(204).end();
  });

  return router;
}

module.exports = { crearRouterUsuarios };
