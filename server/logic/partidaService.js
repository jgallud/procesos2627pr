// CAPA DE LÓGICA DE NEGOCIO — servicio de partidas de Hundir la Flota.
//
// Orquesta una jugada: carga la partida, comprueba quién la hace, la aplica
// con el MOTOR DEL JUEGO (server/logic/motor/), hace jugar a la máquina si le
// toca (server/logic/jugadorMaquina.js) y guarda el resultado. No contiene
// reglas del juego: todas están en el motor (D-22, RNF-09). Tampoco conoce
// HTTP ni cómo se guardan las partidas: recibe un repositorio que cumple el
// contrato de server/data/partidaRepositorioMemoria.js.
//
// Lo que devuelve es siempre la VISTA de un jugador (motor.vistaPara): su
// tablero completo y, del rival, solo el resultado de sus disparos. La flota
// del rival no sale de aquí hasta que la partida termina (RNF-10).
//
// En el Hito 5 solo hay partidas contra la máquina: el usuario es el
// jugador 0 (empieza él, D-25) y la máquina el jugador 1.

const motor = require('./motor');
const jugadorMaquina = require('./jugadorMaquina');
const { ErrorDominio, CODIGOS } = require('./errores');
const { loggerSilencioso } = require('../logger');

const MODOS = Object.freeze({ MAQUINA: 'maquina' });
const JUGADOR_MAQUINA = 1;

function crearServicioPartidas({
  repositorio,
  servicioUsuarios,
  logger = loggerSilencioso,
  reloj = () => new Date(),
  azar = Math.random,
}) {
  if (!repositorio) throw new Error('crearServicioPartidas necesita un repositorio');
  if (!servicioUsuarios) throw new Error('crearServicioPartidas necesita el servicio de usuarios');

  // Solo juegan usuarios con sesión y activos (RF-11): lo decide el servicio
  // de usuarios, que lanza NO_AUTENTICADO si no.
  const solicitante = (idSolicitante) => servicioUsuarios.usuarioDeSesion(idSolicitante);

  function vista(partida, jugador) {
    return {
      id: partida.id,
      modo: partida.modo,
      oponente: partida.modo === MODOS.MAQUINA ? 'maquina' : null,
      creadaEn: partida.creadaEn,
      ...motor.vistaPara(partida.juego, jugador),
    };
  }

  // Carga una partida y comprueba que el solicitante juega en ella.
  async function cargar(idSolicitante, idPartida) {
    const usuario = await solicitante(idSolicitante);
    const partida = idPartida ? await repositorio.buscarPorId(idPartida) : null;
    if (!partida) throw new ErrorDominio(CODIGOS.PARTIDA_NO_ENCONTRADA, 'La partida no existe');
    const jugador = partida.jugadores.indexOf(usuario.id);
    if (jugador < 0) {
      logger.warn('Acceso denegado a una partida', { partida: partida.id, solicitante: usuario.id });
      throw new ErrorDominio(CODIGOS.PROHIBIDO, 'No juegas en esta partida');
    }
    return { partida, jugador };
  }

  // Guarda el nuevo estado del juego. Si la partida termina, deja de estar
  // en curso y se registra el resultado.
  async function guardar(partida, juego) {
    const terminada = juego.estado === motor.ESTADOS.TERMINADA;
    const guardada = await repositorio.actualizar(partida.id, {
      juego,
      enCurso: !terminada,
      actualizadaEn: reloj().toISOString(),
    });
    if (terminada && partida.juego.estado !== motor.ESTADOS.TERMINADA) {
      logger.info('Partida terminada', {
        partida: partida.id,
        ganador: guardada.jugadores[juego.ganador] ?? 'maquina',
        motivo: juego.motivoFin,
      });
    }
    return guardada;
  }

  // Aplica una jugada que solo cambia el juego (colocar, retirar, abandonar)
  // y devuelve la vista del jugador.
  async function jugada(idSolicitante, idPartida, aplicar) {
    const { partida, jugador } = await cargar(idSolicitante, idPartida);
    const juego = aplicar(partida.juego, jugador);
    return vista(await guardar(partida, juego), jugador);
  }

  return {
    // RF-11: crea una partida contra la máquina, que coloca su flota al azar
    // cumpliendo las reglas. Si el usuario ya tiene una en curso contra la
    // máquina, devuelve esa. Devuelve { partida, nueva }.
    async crearContraMaquina(idSolicitante) {
      const usuario = await solicitante(idSolicitante);
      const existente = await repositorio.buscarEnCursoDe(usuario.id);
      if (existente && existente.modo === MODOS.MAQUINA) {
        return { partida: vista(existente, existente.jugadores.indexOf(usuario.id)), nueva: false };
      }

      const juego = motor.colocarFlotaAleatoria(motor.crearPartida(), JUGADOR_MAQUINA, azar);
      const ahora = reloj().toISOString();
      const partida = await repositorio.crear({
        modo: MODOS.MAQUINA,
        jugadores: [usuario.id, null],
        enCurso: true,
        creadaEn: ahora,
        actualizadaEn: ahora,
        juego,
      });
      logger.info('Partida creada', { partida: partida.id, modo: partida.modo, jugador: usuario.id });
      return { partida: vista(partida, 0), nueva: true };
    },

    // Partida en curso del usuario, para retomarla al cargar la página.
    async partidaEnCurso(idSolicitante) {
      const usuario = await solicitante(idSolicitante);
      const partida = await repositorio.buscarEnCursoDe(usuario.id);
      return partida ? vista(partida, partida.jugadores.indexOf(usuario.id)) : null;
    },

    // RF-16: la vista de la partida para quien la consulta.
    async obtener(idSolicitante, idPartida) {
      const { partida, jugador } = await cargar(idSolicitante, idPartida);
      return vista(partida, jugador);
    },

    // RF-12: colocar o retirar un barco, o colocar toda la flota al azar.
    // Las reglas (dentro del tablero, sin solaparse ni tocarse) las aplica el
    // motor; cuando las dos flotas están completas, la partida empieza.
    colocarBarco(idSolicitante, idPartida, { barco, casilla, orientacion } = {}) {
      return jugada(idSolicitante, idPartida, (juego, jugador) =>
        motor.colocarBarco(juego, jugador, { barco, casilla, orientacion }));
    },

    retirarBarco(idSolicitante, idPartida, barco) {
      return jugada(idSolicitante, idPartida, (juego, jugador) => motor.retirarBarco(juego, jugador, barco));
    },

    colocarFlotaAleatoria(idSolicitante, idPartida) {
      return jugada(idSolicitante, idPartida, (juego, jugador) => motor.colocarFlotaAleatoria(juego, jugador, azar));
    },

    // RF-13 y RF-14: el jugador dispara y, si el turno pasa a la máquina
    // (tras un agua), la máquina juega hasta fallar o ganar. Devuelve
    // { disparo, disparosRival, partida }.
    async disparar(idSolicitante, idPartida, casilla) {
      const { partida, jugador } = await cargar(idSolicitante, idPartida);
      const resultado = motor.disparar(partida.juego, jugador, casilla);
      let juego = resultado.partida;
      let disparosRival = [];

      const turnoDeLaMaquina = partida.modo === MODOS.MAQUINA
        && juego.estado === motor.ESTADOS.EN_JUEGO
        && juego.turno === JUGADOR_MAQUINA;
      if (turnoDeLaMaquina) {
        const turno = jugadorMaquina.jugarTurno(juego, JUGADOR_MAQUINA, azar);
        juego = turno.partida;
        disparosRival = turno.disparos;
      }

      const guardada = await guardar(partida, juego);
      return { disparo: resultado.disparo, disparosRival, partida: vista(guardada, jugador) };
    },

    // RF-15: abandonar cuenta como derrota.
    abandonar(idSolicitante, idPartida) {
      return jugada(idSolicitante, idPartida, (juego, jugador) => motor.abandonar(juego, jugador));
    },
  };
}

module.exports = { crearServicioPartidas, MODOS };
