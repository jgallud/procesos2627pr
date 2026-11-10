// CAPA API — endpoints REST de las partidas de Hundir la Flota (Hito 5).
//
// Solo traduce HTTP <-> llamadas al servicio de partidas: lee parámetros,
// llama al servicio y devuelve JSON. No contiene reglas del juego (están en
// el motor, server/logic/motor/) ni decide quién puede jugar (lo decide el
// servicio). Lo que devuelve es siempre la vista del jugador, sin la flota
// del rival mientras dura la partida (RNF-10).
//
//   POST   /api/partidas                       crear contra la máquina  -> 201 (200 si ya había una en curso)
//   GET    /api/partidas/actual                partida en curso         -> 200 vista | null
//   GET    /api/partidas/:id                   vista de la partida      -> 200
//   POST   /api/partidas/:id/barcos            colocar un barco         -> 200 vista
//   DELETE /api/partidas/:id/barcos/:barco     retirar un barco         -> 200 vista
//   POST   /api/partidas/:id/flota-aleatoria   colocar toda la flota    -> 200 vista
//   POST   /api/partidas/:id/disparos          disparar {casilla}       -> 200 {disparo, disparosRival, partida}
//   POST   /api/partidas/:id/abandono          abandonar                -> 200 vista
//
// El solicitante (req.idSolicitante) lo fija el middleware de sesión.

const express = require('express');

function crearRouterPartidas({ servicioPartidas }) {
  const router = express.Router();

  router.post('/', async (req, res) => {
    const { partida, nueva } = await servicioPartidas.crearContraMaquina(req.idSolicitante);
    res.status(nueva ? 201 : 200).json(partida);
  });

  // Antes que '/:id', para que «actual» no se tome como un identificador.
  router.get('/actual', async (req, res) => {
    res.json(await servicioPartidas.partidaEnCurso(req.idSolicitante));
  });

  router.get('/:id', async (req, res) => {
    res.json(await servicioPartidas.obtener(req.idSolicitante, req.params.id));
  });

  router.post('/:id/barcos', async (req, res) => {
    const { barco, casilla, orientacion } = req.body ?? {};
    res.json(await servicioPartidas.colocarBarco(req.idSolicitante, req.params.id, { barco, casilla, orientacion }));
  });

  router.delete('/:id/barcos/:barco', async (req, res) => {
    res.json(await servicioPartidas.retirarBarco(req.idSolicitante, req.params.id, req.params.barco));
  });

  router.post('/:id/flota-aleatoria', async (req, res) => {
    res.json(await servicioPartidas.colocarFlotaAleatoria(req.idSolicitante, req.params.id));
  });

  router.post('/:id/disparos', async (req, res) => {
    res.json(await servicioPartidas.disparar(req.idSolicitante, req.params.id, req.body?.casilla));
  });

  router.post('/:id/abandono', async (req, res) => {
    res.json(await servicioPartidas.abandonar(req.idSolicitante, req.params.id));
  });

  return router;
}

module.exports = { crearRouterPartidas };
