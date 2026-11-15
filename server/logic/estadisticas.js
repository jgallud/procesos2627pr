// CAPA DE LÓGICA DE NEGOCIO — historial y estadísticas de Hundir la Flota
// (RF-18 y RF-19).
//
// Funciones puras sobre las partidas guardadas (el formato del repositorio de
// partidas): no conocen HTTP ni la base de datos. El servicio de partidas las
// usa con lo que le devuelve el repositorio.
//
// Solo cuentan las partidas terminadas (por flota hundida o por abandono) y
// no anuladas: una partida anulada por el administrador no cuenta en las
// estadísticas (RF-21).

const RESULTADO_TERMINADA = 'terminada';

function cuenta(partida) {
  return partida.juego?.estado === RESULTADO_TERMINADA && !partida.anulada;
}

// Porcentaje con un decimal, o null si no hay nada que dividir.
function porcentaje(parte, total) {
  return total > 0 ? Math.round((parte / total) * 1000) / 10 : null;
}

// Disparos que ha hecho el jugador: los que ha recibido su rival.
function disparosDe(partida, jugador) {
  return partida.juego.jugadores[1 - jugador].disparosRecibidos ?? [];
}

// RF-18: una fila del historial, vista desde el usuario indicado.
function resumenDe(partida, idUsuario) {
  const jugador = partida.jugadores.indexOf(idUsuario);
  if (jugador < 0) throw new Error('El usuario no juega en esta partida');
  const rival = 1 - jugador;
  const disparos = disparosDe(partida, jugador);
  const aciertos = disparos.filter((d) => d.resultado !== 'agua').length;
  return {
    id: partida.id,
    fecha: partida.terminadaEn ?? partida.actualizadaEn,
    modo: partida.modo,
    oponente: partida.modo === 'jugadores' ? 'usuario' : 'maquina',
    // MJ-03: las partidas contra la máquina anteriores a la dificultad se jugaron en difícil.
    dificultad: partida.modo === 'jugadores' ? null : partida.dificultad ?? 'dificil',
    idOponente: partida.jugadores[rival],
    resultado: partida.juego.ganador === jugador ? 'victoria' : 'derrota',
    motivoFin: partida.juego.motivoFin,
    disparos: disparos.length,
    aciertos,
    porcentajeAcierto: porcentaje(aciertos, disparos.length),
  };
}

// RF-18: historial de un usuario, de la partida más reciente a la más antigua.
function historialDe(partidas, idUsuario) {
  return partidas
    .filter((p) => cuenta(p) && p.jugadores.includes(idUsuario))
    .map((p) => resumenDe(p, idUsuario))
    .sort((a, b) => String(b.fecha).localeCompare(String(a.fecha)));
}

// RF-19: estadísticas a partir del historial. El porcentaje de acierto es el
// de todos los disparos juntos, no la media de los de cada partida (una
// partida de 5 disparos no pesa igual que una de 60).
function estadisticasDe(historial) {
  const ganadas = historial.filter((h) => h.resultado === 'victoria').length;
  const disparos = historial.reduce((total, h) => total + h.disparos, 0);
  const aciertos = historial.reduce((total, h) => total + h.aciertos, 0);
  return {
    jugadas: historial.length,
    ganadas,
    perdidas: historial.length - ganadas,
    porcentajeVictorias: porcentaje(ganadas, historial.length),
    disparos,
    aciertos,
    porcentajeAcierto: porcentaje(aciertos, disparos),
  };
}

// RF-20: clasificación. Recibe las partidas terminadas y los jugadores que
// pueden aparecer ({ id, nombre }: solo los activos, lo decide el servicio de
// usuarios). Aparecen los que tienen al menos una partida que cuente,
// ordenados por victorias y, a igualdad, por porcentaje de acierto (sin
// disparos, al final); después por menos partidas jugadas y por nombre, para
// que el orden sea siempre el mismo.
function clasificacionDe(partidas, jugadores) {
  const filas = jugadores
    .map(({ id, nombre }) => ({ id, nombre, ...estadisticasDe(historialDe(partidas, id)) }))
    .filter((fila) => fila.jugadas > 0);
  const acierto = (fila) => fila.porcentajeAcierto ?? -1;
  filas.sort((a, b) => b.ganadas - a.ganadas
    || acierto(b) - acierto(a)
    || a.jugadas - b.jugadas
    || a.nombre.localeCompare(b.nombre, 'es'));
  return filas.map((fila, i) => ({ posicion: i + 1, ...fila }));
}

module.exports = { cuenta, resumenDe, historialDe, estadisticasDe, clasificacionDe, porcentaje };
