// Pruebas del servicio de partidas entre dos jugadores (Hito 7, RF-22 y
// RF-23). Mismo motor que contra la máquina: solo cambia quién hace el otro
// turno. Repositorios en memoria y azar fijo: sin HTTP ni base de datos.

const { describe, it, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const { crearServicioPartidas } = require('../../server/logic/partidaService');
const { crearServicioUsuarios } = require('../../server/logic/usuarioService');
const { crearRepositorioUsuariosMemoria } = require('../../server/data/usuarioRepositorioMemoria');
const { crearRepositorioPartidasMemoria } = require('../../server/data/partidaRepositorioMemoria');
const { CODIGOS } = require('../../server/logic/errores');
const { azarFijo } = require('./motor/ayuda');

const rechazaCon = (codigo, texto = '') => (err) =>
  err.name === 'ErrorDominio' && err.codigo === codigo && err.message.includes(texto);
const TODAS = 'ABCDEFGHIJ'.split('').flatMap((f) => Array.from({ length: 10 }, (_, i) => `${f}${i + 1}`));

describe('Servicio de partidas entre jugadores (RF-22, RF-23)', () => {
  let servicio;
  let repositorio;
  let usuarios;
  let ana;
  let luis;
  let eva;
  let avisos; // avisos enviados por el servicio: [idPartida, evento]
  const tokens = new Map();

  async function usuarioActivo(email) {
    await usuarios.registrarUsuario({ email, contrasena: 'contrasena-segura' });
    return usuarios.confirmarCuenta(tokens.get(email));
  }

  // Casillas de la flota de un jugador (0 o 1), leídas del repositorio.
  async function flotaDe(idPartida, jugador) {
    const guardada = await repositorio.buscarPorId(idPartida);
    return guardada.juego.jugadores[jugador].flota.flatMap((b) => b.casillas);
  }

  async function aguaContra(idPartida, jugador) {
    const ocupadas = new Set(await flotaDe(idPartida, jugador));
    const disparadas = new Set((await repositorio.buscarPorId(idPartida)).juego.jugadores[jugador].disparosRecibidos.map((d) => d.casilla));
    return TODAS.find((c) => !ocupadas.has(c) && !disparadas.has(c));
  }

  // Ana crea, Luis se une y los dos colocan su flota al azar: en juego.
  async function partidaEnJuego() {
    const { partida } = await servicio.crearAbierta(ana.id);
    await servicio.unirse(luis.id, partida.id);
    await servicio.colocarFlotaAleatoria(ana.id, partida.id);
    return servicio.colocarFlotaAleatoria(luis.id, partida.id);
  }

  beforeEach(async () => {
    usuarios = crearServicioUsuarios({
      repositorio: crearRepositorioUsuariosMemoria(),
      notificador: { async enviarConfirmacion({ email, token }) { tokens.set(email, token); } },
    });
    repositorio = crearRepositorioPartidasMemoria();
    let segundos = 0;
    const reloj = () => new Date(Date.UTC(2026, 10, 15) + 1000 * segundos++);
    avisos = [];
    const avisador = { avisar: (idPartida, evento) => avisos.push([idPartida, evento]) };
    servicio = crearServicioPartidas({ repositorio, servicioUsuarios: usuarios, azar: azarFijo(3), reloj, avisador });
    ana = await usuarioActivo('ana@ejemplo.com');
    luis = await usuarioActivo('luis@ejemplo.com');
    eva = await usuarioActivo('eva@ejemplo.com');
  });

  describe('crear y unirse (RF-22)', () => {
    it('crea una partida abierta esperando rival; repetir devuelve la misma', async () => {
      const { partida, nueva } = await servicio.crearAbierta(ana.id);
      assert.equal(nueva, true);
      assert.equal(partida.modo, 'jugadores');
      assert.equal(partida.oponente, 'usuario');
      assert.equal(partida.esperandoRival, true);
      assert.equal(partida.soyCreador, true);
      assert.equal(partida.estado, 'colocando');
      const otra = await servicio.crearAbierta(ana.id);
      assert.equal(otra.nueva, false);
      assert.equal(otra.partida.id, partida.id);
    });

    it('un usuario no puede tener dos partidas en curso a la vez', async () => {
      await servicio.crearContraMaquina(ana.id);
      await assert.rejects(servicio.crearAbierta(ana.id), rechazaCon(CODIGOS.ESTADO_INVALIDO, 'contra la máquina'));
      await servicio.crearAbierta(luis.id);
      await assert.rejects(servicio.crearContraMaquina(luis.id), rechazaCon(CODIGOS.ESTADO_INVALIDO, 'contra otro jugador'));
    });

    it('la lista de abiertas muestra las de otros con el nombre del creador, sin email', async () => {
      const { partida } = await servicio.crearAbierta(ana.id);
      await servicio.crearContraMaquina(eva.id); // contra la máquina: no aparece
      assert.deepEqual(await servicio.listarAbiertas(ana.id), [], 'la propia no aparece');
      const lista = await servicio.listarAbiertas(luis.id);
      assert.deepEqual(lista.map((p) => [p.id, p.creador]), [[partida.id, 'ana']]);
      assert.ok(!JSON.stringify(lista).includes('@'));
    });

    it('al unirse, cada jugador ve el nombre del otro y la partida deja de estar abierta', async () => {
      const { partida } = await servicio.crearAbierta(ana.id);
      const vistaLuis = await servicio.unirse(luis.id, partida.id);
      assert.equal(vistaLuis.nombreRival, 'ana');
      assert.equal(vistaLuis.esperandoRival, false);
      assert.equal(vistaLuis.soyCreador, false);
      const vistaAna = await servicio.obtener(ana.id, partida.id);
      assert.equal(vistaAna.nombreRival, 'luis');
      assert.equal(vistaAna.esperandoRival, false);
      assert.deepEqual(await servicio.listarAbiertas(eva.id), []);
    });

    it('nadie se une a su propia partida, ni a una con dos jugadores, ni teniendo otra en curso', async () => {
      const { partida } = await servicio.crearAbierta(ana.id);
      await assert.rejects(servicio.unirse(ana.id, partida.id), rechazaCon(CODIGOS.ESTADO_INVALIDO, 'propia'));
      await servicio.crearContraMaquina(eva.id);
      await assert.rejects(servicio.unirse(eva.id, partida.id), rechazaCon(CODIGOS.ESTADO_INVALIDO, 'Ya tienes una partida'));
      await servicio.unirse(luis.id, partida.id);
      const otro = await usuarioActivo('otro@ejemplo.com');
      await assert.rejects(servicio.unirse(otro.id, partida.id), rechazaCon(CODIGOS.ESTADO_INVALIDO, 'dos jugadores'));
      await assert.rejects(servicio.unirse(otro.id, 'no-existe'), rechazaCon(CODIGOS.PARTIDA_NO_ENCONTRADA));
      const contraMaquina = (await servicio.partidaEnCurso(eva.id)).id;
      await assert.rejects(servicio.unirse(otro.id, contraMaquina), rechazaCon(CODIGOS.PARTIDA_NO_ENCONTRADA));
    });

    it('de dos usuarios que se unen a la vez, solo uno lo consigue', async () => {
      const { partida } = await servicio.crearAbierta(ana.id);
      const resultados = await Promise.allSettled([servicio.unirse(luis.id, partida.id), servicio.unirse(eva.id, partida.id)]);
      assert.equal(resultados.filter((r) => r.status === 'fulfilled').length, 1);
      assert.ok(resultados.some((r) => r.status === 'rejected' && r.reason.codigo === CODIGOS.ESTADO_INVALIDO));
    });

    it('el creador cancela mientras nadie se haya unido; la partida no cuenta en el historial', async () => {
      const { partida } = await servicio.crearAbierta(ana.id);
      await assert.rejects(servicio.cancelar(luis.id, partida.id), rechazaCon(CODIGOS.PROHIBIDO));
      await servicio.cancelar(ana.id, partida.id);
      assert.equal(await servicio.partidaEnCurso(ana.id), null);
      assert.deepEqual(await servicio.listarAbiertas(luis.id), []);
      assert.deepEqual(await servicio.historial(ana.id), []);
      await assert.rejects(servicio.unirse(luis.id, partida.id), rechazaCon(CODIGOS.ESTADO_INVALIDO));

      const segunda = (await servicio.crearAbierta(ana.id)).partida;
      await servicio.unirse(luis.id, segunda.id);
      await assert.rejects(servicio.cancelar(ana.id, segunda.id), rechazaCon(CODIGOS.ESTADO_INVALIDO, 'nadie se haya unido'));
    });

    it('sin rival no se puede abandonar: hay que cancelar', async () => {
      const { partida } = await servicio.crearAbierta(ana.id);
      await assert.rejects(servicio.abandonar(ana.id, partida.id), rechazaCon(CODIGOS.ESTADO_INVALIDO, 'cancela'));
    });
  });

  describe('turnos entre jugadores (RF-23)', () => {
    it('la partida empieza cuando los dos han colocado su flota; empieza el creador', async () => {
      const { partida } = await servicio.crearAbierta(ana.id);
      await servicio.colocarFlotaAleatoria(ana.id, partida.id); // puede colocar mientras espera
      await servicio.unirse(luis.id, partida.id);
      assert.equal((await servicio.obtener(ana.id, partida.id)).estado, 'colocando');
      const vista = await servicio.colocarFlotaAleatoria(luis.id, partida.id);
      assert.equal(vista.estado, 'en_juego');
      assert.equal(vista.esMiTurno, false);
      assert.equal((await servicio.obtener(ana.id, partida.id)).esMiTurno, true);
    });

    it('se rechaza la jugada fuera de turno y la de quien no juega la partida', async () => {
      const { id } = await partidaEnJuego();
      await assert.rejects(servicio.disparar(luis.id, id, 'A1'), rechazaCon(CODIGOS.ESTADO_INVALIDO, 'No es tu turno'));
      await assert.rejects(servicio.disparar(eva.id, id, 'A1'), rechazaCon(CODIGOS.PROHIBIDO));
      await assert.rejects(servicio.obtener(eva.id, id), rechazaCon(CODIGOS.PROHIBIDO));
    });

    it('tras un agua el turno pasa al rival, y no juega ninguna máquina', async () => {
      const { id } = await partidaEnJuego();
      const r = await servicio.disparar(ana.id, id, await aguaContra(id, 1));
      assert.equal(r.disparo.resultado, 'agua');
      assert.deepEqual(r.disparosRival, []);
      assert.equal(r.partida.esMiTurno, false);
      const deLuis = await servicio.obtener(luis.id, id);
      assert.equal(deLuis.esMiTurno, true);
      assert.equal(deLuis.propio.disparosRecibidos.length, 1, 'Luis ve el disparo recibido');
      assert.equal(deLuis.rival.disparos.length, 0);
      assert.equal((await servicio.obtener(ana.id, id)).rival.disparos.length, 1);
    });

    it('ningún jugador recibe la flota del otro mientras dura la partida', async () => {
      const { id } = await partidaEnJuego();
      for (const [usuario, rival] of [[ana, 1], [luis, 0]]) {
        const texto = JSON.stringify((await servicio.obtener(usuario.id, id)).rival);
        for (const casilla of await flotaDe(id, rival)) assert.ok(!texto.includes(`"${casilla}"`), casilla);
      }
    });

    it('al hundir la flota rival, cada uno ve su resultado y cuenta en el historial de los dos', async () => {
      const { id } = await partidaEnJuego();
      let r;
      for (const casilla of await flotaDe(id, 1)) r = await servicio.disparar(ana.id, id, casilla);
      assert.equal(r.partida.resultado, 'victoria');
      assert.equal((await servicio.obtener(luis.id, id)).resultado, 'derrota');
      const [deAna] = await servicio.historial(ana.id);
      const [deLuis] = await servicio.historial(luis.id);
      assert.equal(deAna.oponente, 'usuario');
      assert.equal(deAna.idOponente, luis.id);
      assert.equal(deLuis.resultado, 'derrota');
      assert.deepEqual((await servicio.clasificacion(eva.id)).map((f) => f.nombre), ['ana', 'luis']);
    });

    it('abandonar con rival da la victoria al otro jugador', async () => {
      const { id } = await partidaEnJuego();
      await servicio.abandonar(luis.id, id);
      assert.equal((await servicio.obtener(ana.id, id)).resultado, 'victoria');
      assert.equal(await servicio.partidaEnCurso(ana.id), null);
    });
  });

  describe('avisos de tiempo real (RF-24, RF-26)', () => {
    const tipos = () => avisos.map(([, evento]) => evento.tipo);

    it('avisa al unirse el rival y cuando cada jugador termina de colocar su flota', async () => {
      const { partida } = await servicio.crearAbierta(ana.id);
      await servicio.unirse(luis.id, partida.id);
      await servicio.colocarBarco(ana.id, partida.id, { barco: 'destructor', casilla: 'J9', orientacion: 'horizontal' });
      await servicio.retirarBarco(ana.id, partida.id, 'destructor');
      await servicio.colocarFlotaAleatoria(ana.id, partida.id);
      await servicio.colocarFlotaAleatoria(luis.id, partida.id);
      assert.deepEqual(tipos(), ['rival-unido', 'actualizada', 'actualizada', 'flota-colocada', 'flota-colocada']);
      assert.ok(avisos.every(([id, evento]) => id === partida.id && evento.partida === partida.id));
      assert.deepEqual(avisos.map(([, e]) => e.jugador), [1, 0, 0, 0, 1]);
    });

    it('avisa de cada disparo con su resultado y del fin de la partida, sin ninguna flota', async () => {
      const { id } = await partidaEnJuego();
      avisos = [];
      await servicio.disparar(ana.id, id, await aguaContra(id, 1));
      const [, primero] = avisos[0];
      assert.equal(primero.tipo, 'disparo');
      assert.equal(primero.jugador, 0);
      assert.equal(primero.disparo.resultado, 'agua');

      let ultimo;
      for (const casilla of await flotaDe(id, 0)) ultimo = await servicio.disparar(luis.id, id, casilla);
      assert.equal(ultimo.partida.resultado, 'victoria');
      assert.equal(tipos().at(-1), 'fin');
      assert.equal(avisos.at(-1)[1].jugador, 1);
      assert.ok(!JSON.stringify(avisos).includes('flota'), 'ningún aviso lleva una flota');
    });

    it('RF-26: si un jugador abandona, el rival recibe el aviso de abandono', async () => {
      const { id } = await partidaEnJuego();
      avisos = [];
      await servicio.abandonar(luis.id, id);
      assert.deepEqual(avisos, [[id, { partida: id, tipo: 'abandono', jugador: 1 }]]);
    });

    it('avisa al cancelar y al anular, y nunca en partidas contra la máquina', async () => {
      const { partida } = await servicio.crearAbierta(ana.id);
      await servicio.cancelar(ana.id, partida.id);
      const contraMaquina = (await servicio.crearContraMaquina(luis.id)).partida;
      await servicio.colocarFlotaAleatoria(luis.id, contraMaquina.id);
      assert.deepEqual(tipos(), ['cancelada']);

      const admin = await usuarios.asegurarAdministrador({ email: 'admin@ejemplo.com', contrasena: 'clave-del-admin' });
      const otra = (await servicio.crearAbierta(eva.id)).partida;
      await servicio.anular(admin.id, otra.id);
      assert.equal(tipos().at(-1), 'anulada');
    });

    it('un avisador que falla no deshace la jugada', async () => {
      const roto = crearServicioPartidas({
        repositorio, servicioUsuarios: usuarios, azar: azarFijo(3), avisador: { avisar() { throw new Error('caído'); } },
      });
      const { partida } = await roto.crearAbierta(ana.id);
      const vista = await roto.unirse(luis.id, partida.id);
      assert.equal(vista.nombreRival, 'ana');
    });

    it('solo los dos jugadores pueden seguir la partida', async () => {
      const { id } = await partidaEnJuego();
      assert.equal(await servicio.puedeSeguir(ana.id, id), true);
      assert.equal(await servicio.puedeSeguir(luis.id, id), true);
      await assert.rejects(servicio.puedeSeguir(eva.id, id), rechazaCon(CODIGOS.PROHIBIDO));
      await assert.rejects(servicio.puedeSeguir(undefined, id), rechazaCon(CODIGOS.NO_AUTENTICADO));
      await assert.rejects(servicio.puedeSeguir(ana.id, 'no-existe'), rechazaCon(CODIGOS.PARTIDA_NO_ENCONTRADA));
    });
  });
});
