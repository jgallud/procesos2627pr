// CAPA API — endpoints REST de usuarios.
//
// Solo traduce HTTP <-> llamadas a la capa lógica: lee parámetros, llama al
// servicio y devuelve JSON. No contiene reglas de negocio (quién puede hacer
// qué lo decide el servicio). Express 5 pasa al manejador de errores
// cualquier promesa rechazada, por eso no hay try/catch.
//
//   POST   /api/usuarios               alta de usuario            -> 201
//   POST   /api/usuarios/confirmacion  confirmar cuenta {token}   -> 200
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
