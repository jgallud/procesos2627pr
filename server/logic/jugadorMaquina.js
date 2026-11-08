// CAPA LÓGICA — jugador máquina de Hundir la Flota (RF-14).
//
// Decide su colocación y su siguiente disparo a partir de SU tablero de
// disparos (los disparos que ha hecho y su resultado), nunca de la flota del
// rival: jugarTurno solo le pasa la vista que da el motor (vistaPara), igual
// que la que recibe un jugador humano (RNF-10).
// Recibe una fuente de azar inyectable (función que devuelve [0, 1), como
// Math.random) para que sus pruebas sean reproducibles (RNF-11).
//
// Estrategia (D-28):
//   - Caza: dispara al azar a una casilla que aún puede tener barco.
//   - Remate: tras un tocado, dispara alrededor hasta hundir el barco; con
//     dos o más tocados alineados, sigue esa línea.
//   - Descarte: como los barcos no se tocan (D-25), las casillas vecinas de
//     un barco hundido y las diagonales de un tocado no pueden tener barco.

const motor = require('./motor');

const ORTOGONALES = [[-1, 0], [1, 0], [0, -1], [0, 1]];
const DIAGONALES = [[-1, -1], [-1, 1], [1, -1], [1, 1]];

function aPos(casilla) {
  return { fila: motor.FILAS.indexOf(casilla[0]), columna: Number(casilla.slice(1)) - 1 };
}

function aCas({ fila, columna }) {
  if (fila < 0 || fila >= motor.TAMANO || columna < 0 || columna >= motor.TAMANO) return null;
  return `${motor.FILAS[fila]}${columna + 1}`;
}

function desplazar(casilla, [df, dc]) {
  const { fila, columna } = aPos(casilla);
  return aCas({ fila: fila + df, columna: columna + dc });
}

function elegirAlAzar(lista, azar) {
  return lista[Math.min(lista.length - 1, Math.floor(azar() * lista.length))];
}

// Agrupa los aciertos (tocado o hundido) en barcos: casillas acertadas
// unidas por un lado. Como los barcos no se tocan, cada grupo es un barco.
function barcosAcertados(disparos) {
  const aciertos = new Map(disparos.filter((d) => d.resultado !== motor.RESULTADOS.AGUA).map((d) => [d.casilla, d]));
  const vistos = new Set();
  const grupos = [];
  for (const inicio of aciertos.keys()) {
    if (vistos.has(inicio)) continue;
    const grupo = [];
    const pendientes = [inicio];
    vistos.add(inicio);
    while (pendientes.length) {
      const casilla = pendientes.pop();
      grupo.push(casilla);
      for (const paso of ORTOGONALES) {
        const vecina = desplazar(casilla, paso);
        if (vecina && aciertos.has(vecina) && !vistos.has(vecina)) {
          vistos.add(vecina);
          pendientes.push(vecina);
        }
      }
    }
    const hundido = grupo.some((c) => aciertos.get(c).resultado === motor.RESULTADOS.HUNDIDO);
    grupos.push({ casillas: grupo, hundido });
  }
  return grupos;
}

// Casillas a las que no merece la pena disparar porque, por la regla de no
// tocarse, seguro que son agua.
function casillasDescartadas(grupos) {
  const descartadas = new Set();
  for (const { casillas, hundido } of grupos) {
    for (const casilla of casillas) {
      const pasos = hundido ? [...ORTOGONALES, ...DIAGONALES] : DIAGONALES;
      for (const paso of pasos) {
        const vecina = desplazar(casilla, paso);
        if (vecina) descartadas.add(vecina);
      }
    }
  }
  return descartadas;
}

// Casillas candidatas para rematar un barco tocado y aún no hundido.
function candidatasDeRemate(grupo) {
  if (grupo.casillas.length === 1) {
    return ORTOGONALES.map((paso) => desplazar(grupo.casillas[0], paso));
  }
  // Dos o más tocados: están alineados; se prueba por los dos extremos.
  const posiciones = grupo.casillas.map(aPos);
  const horizontal = posiciones.every((p) => p.fila === posiciones[0].fila);
  const clave = horizontal ? 'columna' : 'fila';
  const valores = posiciones.map((p) => p[clave]);
  const base = posiciones[0];
  const extremo = (valor) => aCas(horizontal ? { fila: base.fila, columna: valor } : { fila: valor, columna: base.columna });
  return [extremo(Math.min(...valores) - 1), extremo(Math.max(...valores) + 1)];
}

// RF-14: elige la casilla del siguiente disparo a partir de los disparos ya
// hechos ([{ casilla, resultado, barco? }]). Nunca repite casilla.
function elegirDisparo(disparos, azar = Math.random) {
  const disparadas = new Set(disparos.map((d) => d.casilla));
  const libres = motor.todasLasCasillas().filter((c) => !disparadas.has(c));
  if (libres.length === 0) throw new Error('No quedan casillas a las que disparar');

  const grupos = barcosAcertados(disparos);
  const descartadas = casillasDescartadas(grupos);
  const util = (c) => c && !disparadas.has(c) && !descartadas.has(c);

  // Remate: primero los barcos tocados y no hundidos.
  for (const grupo of grupos.filter((g) => !g.hundido)) {
    const candidatas = candidatasDeRemate(grupo).filter(util);
    if (candidatas.length) return elegirAlAzar(candidatas, azar);
  }
  // Caza: cualquier casilla libre que aún pueda tener barco.
  const posibles = libres.filter(util);
  return elegirAlAzar(posibles.length ? posibles : libres, azar);
}

// Colocación de la flota de la máquina, al azar y cumpliendo las reglas.
function elegirColocacion(azar = Math.random) {
  return motor.generarFlotaAleatoria(azar);
}

// Juega el turno completo de la máquina: dispara mientras acierte (quien
// acierta repite, D-25) y la partida no termine. Devuelve la partida nueva y
// los disparos hechos, en orden, para que el jugador los vea (RF-14).
function jugarTurno(partida, jugador, azar = Math.random) {
  let actual = partida;
  const hechos = [];
  do {
    const { rival } = motor.vistaPara(actual, jugador); // solo su tablero de disparos
    const casilla = elegirDisparo(rival.disparos, azar);
    const { partida: nueva, disparo } = motor.disparar(actual, jugador, casilla);
    actual = nueva;
    hechos.push(disparo);
  } while (actual.estado === motor.ESTADOS.EN_JUEGO && actual.turno === jugador);
  return { partida: actual, disparos: hechos };
}

module.exports = { elegirDisparo, elegirColocacion, jugarTurno };
