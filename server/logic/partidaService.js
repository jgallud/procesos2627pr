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
// Dos modos (D-36). Contra la máquina (Hito 5): el usuario es el jugador 0
// (empieza él, D-25) y la máquina el jugador 1. Entre jugadores (Hito 7): el
// creador es el jugador 0 y empieza; quien se une es el jugador 1. El motor
// es el mismo: solo cambia quién hace el otro turno.
// Un usuario tiene como mucho una partida en curso, de cualquier modo.

const motor = require('./motor');
const jugadorMaquina = require('./jugadorMaquina');
const { historialDe, estadisticasDe, clasificacionDe } = require('./estadisticas');
const { ROLES } = require('./usuarioService');
const { ErrorDominio, CODIGOS } = require('./errores');
const { loggerSilencioso } = require('../logger');

const MODOS = Object.freeze({ MAQUINA: 'maquina', JUGADORES: 'jugadores' });

// Avisos de tiempo real (Hito 7, RF-24, D-23). El servicio no sabe cómo se
// entregan: recibe un avisador con avisar(idPartida, evento), que implementa
// el módulo de tiempo real de la capa API y conecta server/index.js. Por
// defecto no hace nada (pruebas y partidas contra la máquina).
const AVISOS = Object.freeze({
  RIVAL_UNIDO: 'rival-unido',
  FLOTA_COLOCADA: 'flota-colocada',
  ACTUALIZADA: 'actualizada',
  DISPARO: 'disparo',
  FIN: 'fin',
  ABANDONO: 'abandono',
  CANCELADA: 'cancelada',
  ANULADA: 'anulada',
});
// MJ-14: además, avisarVestibulo(evento) avisa a quien está viendo la lista
// de partidas abiertas de que ha cambiado (sin decir cómo: la pide por REST).
const avisadorNulo = Object.freeze({ avisar() {}, avisarVestibulo() {} });
const AVISO_ABIERTAS = Object.freeze({ tipo: 'abiertas' });
const JUGADOR_MAQUINA = 1;
// MJ-03: dificultad de la máquina. Las partidas creadas antes de MJ-03 no la
// guardan y siguen jugando con la estrategia de entonces (difícil).
const DIFICULTAD_POR_DEFECTO = jugadorMaquina.NIVELES.NORMAL;
const dificultadDe = (partida) => partida.dificultad ?? jugadorMaquina.NIVELES.DIFICIL;

function crearServicioPartidas({
  repositorio,
  servicioUsuarios,
  logger = loggerSilencioso,
  reloj = () => new Date(),
  azar = Math.random,
  avisador = avisadorNulo,
}) {
  if (!repositorio) throw new Error('crearServicioPartidas necesita un repositorio');
  if (!servicioUsuarios) throw new Error('crearServicioPartidas necesita el servicio de usuarios');

  // Solo juegan usuarios con sesión y activos (RF-11): lo decide el servicio
  // de usuarios, que lanza NO_AUTENTICADO si no.
  const solicitante = (idSolicitante) => servicioUsuarios.usuarioDeSesion(idSolicitante);

  // RF-18: cada jugador consulta sus partidas; el administrador, las de
  // cualquier usuario. Devuelve el id del usuario cuyas partidas se piden.
  async function usuarioConsultado(idSolicitante, idUsuario) {
    const usuario = await solicitante(idSolicitante);
    if (!idUsuario || idUsuario === usuario.id) return usuario.id;
    if (usuario.rol !== ROLES.ADMINISTRADOR) {
      logger.warn('Acceso denegado al historial de otro usuario', { solicitante: usuario.id, objetivo: idUsuario });
      throw new ErrorDominio(CODIGOS.PROHIBIDO, 'Solo puedes consultar tus propias partidas');
    }
    await servicioUsuarios.estaActivo(idSolicitante, idUsuario); // USUARIO_NO_ENCONTRADO si no existe
    return idUsuario;
  }

  // La vista de un jugador. En una partida entre jugadores incluye el nombre
  // del rival (nunca su email) y si aún se espera a que alguien se una.
  async function vista(partida, jugador) {
    const contraMaquina = partida.modo === MODOS.MAQUINA;
    const idRival = partida.jugadores[1 - jugador];
    return {
      id: partida.id,
      modo: partida.modo,
      oponente: contraMaquina ? 'maquina' : 'usuario',
      dificultad: contraMaquina ? dificultadDe(partida) : null,
      nombreRival: contraMaquina ? null : await servicioUsuarios.nombrePublico(idRival),
      esperandoRival: !contraMaquina && partida.jugadores[1] === null,
      soyCreador: jugador === 0,
      creadaEn: partida.creadaEn,
      anulada: Boolean(partida.anulada),
      cancelada: Boolean(partida.cancelada),
      ...motor.vistaPara(partida.juego, jugador),
    };
  }

  // RF-22: un usuario no puede tener dos partidas en curso a la vez.
  function exigirSinPartidaEnCurso(existente) {
    if (existente) {
      const contra = existente.modo === MODOS.MAQUINA ? 'contra la máquina' : 'contra otro jugador';
      throw new ErrorDominio(CODIGOS.ESTADO_INVALIDO, `Ya tienes una partida en curso ${contra}: termínala o abandónala antes`);
    }
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

  // Para jugar: además, una partida anulada por el administrador ya no
  // admite jugadas, aunque su juego se quedara a medias (RF-21).
  async function cargarParaJugar(idSolicitante, idPartida) {
    const cargada = await cargar(idSolicitante, idPartida);
    if (cargada.partida.anulada) {
      throw new ErrorDominio(CODIGOS.PARTIDA_ANULADA, 'El administrador ha anulado esta partida');
    }
    return cargada;
  }

  // RF-21: la gestión de partidas es solo para el administrador. Como en el
  // Sprint 1, el rol se comprueba aquí, en el servidor.
  async function exigirAdministrador(idSolicitante) {
    const usuario = await solicitante(idSolicitante);
    if (usuario.rol !== ROLES.ADMINISTRADOR) {
      logger.warn('Gestión de partidas denegada: se requiere administrador', { solicitante: usuario.id });
      throw new ErrorDominio(CODIGOS.PROHIBIDO, 'Solo un administrador puede gestionar las partidas');
    }
    return usuario;
  }

  // Avisa a quien sigue la partida (RF-24). Solo en partidas entre jugadores:
  // contra la máquina no hay nadie más esperando. Un fallo al avisar no
  // deshace la jugada, que ya está guardada: el cliente la verá al
  // reconectarse (RF-25). El evento nunca lleva la flota de nadie (RNF-10).
  function avisar(partida, evento) {
    if (partida.modo !== MODOS.JUGADORES) return;
    try {
      avisador.avisar(partida.id, { partida: partida.id, ...evento });
    } catch (err) {
      logger.error('No se pudo enviar el aviso', { partida: partida.id, tipo: evento.tipo, error: err.message });
    }
  }

  // MJ-14: la lista de partidas abiertas ha cambiado (una nueva, una que se
  // llena, se cancela o se anula). Como avisar, un fallo no deshace nada.
  function avisarVestibulo() {
    try {
      avisador.avisarVestibulo?.(AVISO_ABIERTAS);
    } catch (err) {
      logger.error('No se pudo avisar del cambio en las partidas abiertas', { error: err.message });
    }
  }

  // Qué aviso corresponde a un cambio de juego hecho por `jugador`.
  function eventoDe(antes, despues, jugador, disparo) {
    if (despues.estado === motor.ESTADOS.TERMINADA && antes.estado !== motor.ESTADOS.TERMINADA) {
      const tipo = despues.motivoFin === motor.MOTIVOS_FIN.ABANDONO ? AVISOS.ABANDONO : AVISOS.FIN;
      return { tipo, jugador, ...(disparo ? { disparo } : {}) };
    }
    if (disparo) return { tipo: AVISOS.DISPARO, jugador, disparo };
    const completa = (juego) => motor.barcosPendientesDe(juego, jugador).length === 0;
    if (!completa(antes) && completa(despues)) return { tipo: AVISOS.FLOTA_COLOCADA, jugador };
    return { tipo: AVISOS.ACTUALIZADA, jugador };
  }

  // Guarda el nuevo estado del juego. Si la partida termina, deja de estar
  // en curso y se registra el resultado.
  async function guardar(partida, juego) {
    const terminada = juego.estado === motor.ESTADOS.TERMINADA;
    const ahora = reloj().toISOString();
    const recienTerminada = terminada && partida.juego.estado !== motor.ESTADOS.TERMINADA;
    const guardada = await repositorio.actualizar(partida.id, {
      juego,
      enCurso: !terminada,
      actualizadaEn: ahora,
      ...(recienTerminada ? { terminadaEn: ahora } : {}),
    });
    if (recienTerminada) {
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
    const { partida, jugador } = await cargarParaJugar(idSolicitante, idPartida);
    const juego = aplicar(partida.juego, jugador);
    const guardada = await guardar(partida, juego);
    avisar(partida, eventoDe(partida.juego, juego, jugador));
    return vista(guardada, jugador);
  }

  return {
    // RF-11: crea una partida contra la máquina, que coloca su flota al azar
    // cumpliendo las reglas. Si el usuario ya tiene una en curso contra la
    // máquina, devuelve esa. Devuelve { partida, nueva }.
    async crearContraMaquina(idSolicitante, { dificultad = DIFICULTAD_POR_DEFECTO } = {}) {
      const usuario = await solicitante(idSolicitante);
      if (!Object.values(jugadorMaquina.NIVELES).includes(dificultad)) {
        throw new ErrorDominio(CODIGOS.DATOS_INVALIDOS, 'La dificultad debe ser fácil, normal o difícil');
      }
      const existente = await repositorio.buscarEnCursoDe(usuario.id);
      if (existente && existente.modo === MODOS.MAQUINA) {
        return { partida: await vista(existente, existente.jugadores.indexOf(usuario.id)), nueva: false };
      }
      exigirSinPartidaEnCurso(existente);

      const juego = motor.colocarFlotaAleatoria(motor.crearPartida(), JUGADOR_MAQUINA, azar);
      const ahora = reloj().toISOString();
      const partida = await repositorio.crear({
        modo: MODOS.MAQUINA,
        dificultad,
        jugadores: [usuario.id, null],
        enCurso: true,
        creadaEn: ahora,
        actualizadaEn: ahora,
        juego,
      });
      logger.info('Partida creada', { partida: partida.id, modo: partida.modo, jugador: usuario.id });
      return { partida: await vista(partida, 0), nueva: true };
    },

    // RF-22: crea una partida abierta para jugar contra otro usuario. El
    // creador es el jugador 0 y puede ir colocando su flota mientras espera.
    // Si ya tiene una partida abierta esperando rival, devuelve esa.
    async crearAbierta(idSolicitante) {
      const usuario = await solicitante(idSolicitante);
      const existente = await repositorio.buscarEnCursoDe(usuario.id);
      if (existente && existente.modo === MODOS.JUGADORES && existente.jugadores[1] === null) {
        return { partida: await vista(existente, 0), nueva: false };
      }
      exigirSinPartidaEnCurso(existente);
      const ahora = reloj().toISOString();
      const partida = await repositorio.crear({
        modo: MODOS.JUGADORES,
        jugadores: [usuario.id, null],
        enCurso: true,
        creadaEn: ahora,
        actualizadaEn: ahora,
        juego: motor.crearPartida(),
      });
      logger.info('Partida creada', { partida: partida.id, modo: partida.modo, jugador: usuario.id });
      avisarVestibulo();
      return { partida: await vista(partida, 0), nueva: true };
    },

    // RF-22: partidas abiertas a las que el solicitante se puede unir: entre
    // jugadores, en curso, con la plaza libre y creadas por otro usuario.
    async listarAbiertas(idSolicitante) {
      const usuario = await solicitante(idSolicitante);
      const abiertas = (await repositorio.listarEnCurso())
        .filter((p) => p.modo === MODOS.JUGADORES && p.jugadores[1] === null && p.jugadores[0] !== usuario.id);
      return Promise.all(abiertas.map(async (p) => ({
        id: p.id,
        creador: await servicioUsuarios.nombrePublico(p.jugadores[0]),
        creadaEn: p.creadaEn,
      })));
    },

    // RF-22: unirse a una partida abierta. No a la propia, ni a una que ya
    // tiene dos jugadores, ni teniendo otra partida en curso. La plaza se
    // ocupa con una sola operación del repositorio, para que de dos uniones
    // simultáneas solo una lo consiga.
    async unirse(idSolicitante, idPartida) {
      const usuario = await solicitante(idSolicitante);
      const partida = idPartida ? await repositorio.buscarPorId(idPartida) : null;
      if (!partida || partida.modo !== MODOS.JUGADORES) {
        throw new ErrorDominio(CODIGOS.PARTIDA_NO_ENCONTRADA, 'La partida no existe');
      }
      if (partida.jugadores[0] === usuario.id) {
        throw new ErrorDominio(CODIGOS.ESTADO_INVALIDO, 'No puedes unirte a tu propia partida');
      }
      if (!partida.enCurso || partida.jugadores[1] !== null) {
        throw new ErrorDominio(CODIGOS.ESTADO_INVALIDO, 'La partida ya no está abierta: tiene dos jugadores o se ha cancelado');
      }
      exigirSinPartidaEnCurso(await repositorio.buscarEnCursoDe(usuario.id));
      const ocupada = await repositorio.ocuparPlaza(partida.id, usuario.id, { actualizadaEn: reloj().toISOString() });
      if (!ocupada) {
        throw new ErrorDominio(CODIGOS.ESTADO_INVALIDO, 'La partida ya no está abierta: tiene dos jugadores o se ha cancelado');
      }
      logger.info('Jugador unido a la partida', { partida: partida.id, jugador: usuario.id });
      avisar(ocupada, { tipo: AVISOS.RIVAL_UNIDO, jugador: 1 });
      avisarVestibulo();
      return vista(ocupada, 1);
    },

    // RF-22: el creador cancela su partida mientras nadie se haya unido. No
    // cuenta en el historial ni en las estadísticas (no está terminada).
    async cancelar(idSolicitante, idPartida) {
      const { partida, jugador } = await cargar(idSolicitante, idPartida);
      if (partida.modo !== MODOS.JUGADORES || jugador !== 0) {
        throw new ErrorDominio(CODIGOS.PROHIBIDO, 'Solo quien crea una partida entre jugadores puede cancelarla');
      }
      if (!partida.enCurso || partida.jugadores[1] !== null) {
        throw new ErrorDominio(CODIGOS.ESTADO_INVALIDO, 'Solo se puede cancelar mientras nadie se haya unido');
      }
      const ahora = reloj().toISOString();
      await repositorio.actualizar(partida.id, { enCurso: false, cancelada: true, actualizadaEn: ahora });
      logger.info('Partida cancelada', { partida: partida.id, por: partida.jugadores[0] });
      avisar(partida, { tipo: AVISOS.CANCELADA, jugador: 0 });
      avisarVestibulo();
    },

    // Partida en curso del usuario, para retomarla al cargar la página.
    async partidaEnCurso(idSolicitante) {
      const usuario = await solicitante(idSolicitante);
      const partida = await repositorio.buscarEnCursoDe(usuario.id);
      return partida ? vista(partida, partida.jugadores.indexOf(usuario.id)) : null;
    },

    // RF-24: ¿puede el solicitante seguir esta partida en tiempo real? Solo
    // quien juega en ella. Lo pregunta el módulo de tiempo real al abrir la
    // conexión: él no decide quién puede seguir una partida.
    async puedeSeguir(idSolicitante, idPartida) {
      await cargar(idSolicitante, idPartida);
      return true;
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
      const { partida, jugador } = await cargarParaJugar(idSolicitante, idPartida);
      const resultado = motor.disparar(partida.juego, jugador, casilla);
      let juego = resultado.partida;
      let disparosRival = [];

      const turnoDeLaMaquina = partida.modo === MODOS.MAQUINA
        && juego.estado === motor.ESTADOS.EN_JUEGO
        && juego.turno === JUGADOR_MAQUINA;
      if (turnoDeLaMaquina) {
        const turno = jugadorMaquina.jugarTurno(juego, JUGADOR_MAQUINA, azar, dificultadDe(partida));
        juego = turno.partida;
        disparosRival = turno.disparos;
      }

      const guardada = await guardar(partida, juego);
      avisar(partida, eventoDe(partida.juego, juego, jugador, resultado.disparo));
      return { disparo: resultado.disparo, disparosRival, partida: await vista(guardada, jugador) };
    },

    // RF-15: abandonar cuenta como derrota. En una partida entre jugadores
    // a la que aún no se ha unido nadie no hay a quién dar la victoria: se
    // cancela (RF-22).
    async abandonar(idSolicitante, idPartida) {
      const { partida } = await cargarParaJugar(idSolicitante, idPartida);
      if (partida.modo === MODOS.JUGADORES && partida.jugadores[1] === null) {
        throw new ErrorDominio(CODIGOS.ESTADO_INVALIDO, 'Nadie se ha unido todavía: cancela la partida en lugar de abandonarla');
      }
      return jugada(idSolicitante, idPartida, (juego, jugador) => motor.abandonar(juego, jugador));
    },

    // RF-18: partidas terminadas de un usuario (las propias, o las de
    // cualquiera si lo pide el administrador): fecha, rival, resultado,
    // disparos y porcentaje de acierto.
    async historial(idSolicitante, idUsuario) {
      const id = await usuarioConsultado(idSolicitante, idUsuario);
      return historialDe(await repositorio.listarTerminadas({ idUsuario: id }), id);
    },

    // RF-19: estadísticas calculadas aquí, en la lógica, a partir de las
    // partidas guardadas.
    async estadisticas(idSolicitante, idUsuario) {
      const id = await usuarioConsultado(idSolicitante, idUsuario);
      return estadisticasDe(historialDe(await repositorio.listarTerminadas({ idUsuario: id }), id));
    },

    // RF-21: partidas en curso de todos los jugadores, para el administrador.
    // No incluye las flotas: para gestionar una partida basta con saber
    // quién juega, en qué estado está y cuándo se jugó por última vez.
    async listarEnCurso(idSolicitante) {
      await exigirAdministrador(idSolicitante);
      const emails = new Map((await servicioUsuarios.listarUsuarios(idSolicitante)).map((u) => [u.id, u.email]));
      const partidas = await repositorio.listarEnCurso();
      return partidas.map((p) => ({
        id: p.id,
        modo: p.modo,
        jugadores: p.jugadores.map((id) => {
          if (id !== null) return emails.get(id) ?? id;
          return p.modo === MODOS.MAQUINA ? 'maquina' : 'esperando rival';
        }),
        estado: p.juego.estado,
        disparos: p.juego.jugadores.reduce((total, j) => total + (j.disparosRecibidos?.length ?? 0), 0),
        creadaEn: p.creadaEn,
        actualizadaEn: p.actualizadaEn,
      }));
    },

    // RF-21: anula una partida en curso (por ejemplo, una abandonada sin
    // terminar). Deja de estar en curso, no admite más jugadas y no cuenta
    // en el historial ni en las estadísticas. El juego se guarda tal cual.
    async anular(idSolicitante, idPartida) {
      const admin = await exigirAdministrador(idSolicitante);
      const partida = idPartida ? await repositorio.buscarPorId(idPartida) : null;
      if (!partida) throw new ErrorDominio(CODIGOS.PARTIDA_NO_ENCONTRADA, 'La partida no existe');
      if (!partida.enCurso) {
        throw new ErrorDominio(CODIGOS.ESTADO_INVALIDO, 'Solo se pueden anular partidas en curso');
      }
      const ahora = reloj().toISOString();
      await repositorio.actualizar(partida.id, {
        enCurso: false, anulada: true, anuladaEn: ahora, anuladaPor: admin.id, actualizadaEn: ahora,
      });
      logger.info('Partida anulada', { partida: partida.id, por: admin.id });
      avisar(partida, { tipo: AVISOS.ANULADA });
      if (partida.modo === MODOS.JUGADORES && partida.jugadores[1] === null) avisarVestibulo();
    },

    // RF-20: clasificación de los jugadores activos con alguna partida
    // terminada. Marca la fila de quien la consulta (`esSolicitante`).
    async clasificacion(idSolicitante) {
      const usuario = await solicitante(idSolicitante);
      const jugadores = await servicioUsuarios.listarJugadores(idSolicitante);
      const filas = clasificacionDe(await repositorio.listarTerminadas(), jugadores);
      return filas.map((fila) => ({ ...fila, esSolicitante: fila.id === usuario.id }));
    },
  };
}

module.exports = { crearServicioPartidas, MODOS, AVISOS };
