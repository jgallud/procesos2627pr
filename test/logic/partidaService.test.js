// Pruebas del servicio de partidas contra la máquina (Hito 5). Usan el motor y
// el jugador máquina reales, repositorios en memoria y una fuente de azar
// fija, así que son reproducibles y no necesitan HTTP ni base de datos.

const { describe, it, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const { crearServicioPartidas } = require('../../server/logic/partidaService');
const { crearServicioUsuarios } = require('../../server/logic/usuarioService');
const { crearRepositorioUsuariosMemoria } = require('../../server/data/usuarioRepositorioMemoria');
const { crearRepositorioPartidasMemoria } = require('../../server/data/partidaRepositorioMemoria');
const { CODIGOS } = require('../../server/logic/errores');
const { FLOTA_FIJA, azarFijo } = require('./motor/ayuda');

const rechazaCon = (codigo) => (err) => err.name === 'ErrorDominio' && err.codigo === codigo;

describe('Servicio de partidas contra la máquina', () => {
  let servicio;
  let repositorio;
  let usuarios;
  let ana;
  let luis;

  const ultimoToken = new Map();
  async function usuarioActivo(email) {
    await usuarios.registrarUsuario({ email, contrasena: 'contrasena-segura' });
    return usuarios.confirmarCuenta(ultimoToken.get(email));
  }

  // Casillas de la flota de la máquina, leídas directamente del repositorio
  // (la vista del jugador no las incluye: es justo lo que se comprueba).
  async function flotaDeLaMaquina(idPartida) {
    const guardada = await repositorio.buscarPorId(idPartida);
    return guardada.juego.jugadores[1].flota.flatMap((b) => b.casillas);
  }

  async function agua(idPartida) {
    const ocupadas = new Set(await flotaDeLaMaquina(idPartida));
    return ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J']
      .flatMap((f) => Array.from({ length: 10 }, (_, i) => `${f}${i + 1}`))
      .find((c) => !ocupadas.has(c));
  }

  async function partidaEnJuego(idUsuario) {
    const { partida } = await servicio.crearContraMaquina(idUsuario);
    return servicio.colocarFlotaAleatoria(idUsuario, partida.id);
  }

  beforeEach(async () => {
    usuarios = crearServicioUsuarios({
      repositorio: crearRepositorioUsuariosMemoria(),
      notificador: { async enviarConfirmacion({ email, token }) { ultimoToken.set(email, token); } },
    });
    repositorio = crearRepositorioPartidasMemoria();
    // Reloj que avanza un segundo en cada lectura: dos partidas nunca
    // terminan en el mismo instante, así el orden del historial es fijo.
    let segundos = 0;
    const reloj = () => new Date(Date.UTC(2026, 10, 1) + 1000 * segundos++);
    servicio = crearServicioPartidas({ repositorio, servicioUsuarios: usuarios, azar: azarFijo(7), reloj });
    ana = await usuarioActivo('ana@ejemplo.com');
    luis = await usuarioActivo('luis@ejemplo.com');
  });

  describe('crearContraMaquina', () => {
    it('crea una partida con la flota de la máquina colocada y sin mostrarla', async () => {
      const { partida, nueva } = await servicio.crearContraMaquina(ana.id);
      assert.equal(nueva, true);
      assert.equal(partida.modo, 'maquina');
      assert.equal(partida.oponente, 'maquina');
      assert.equal(partida.estado, 'colocando');
      assert.deepEqual(partida.propio.flota, []);
      assert.equal(partida.rival.flotaColocada, true);
      assert.equal(partida.rival.flota, null);
    });

    it('la vista no contiene ninguna casilla de la flota de la máquina', async () => {
      const { partida } = await servicio.crearContraMaquina(ana.id);
      const texto = JSON.stringify(partida);
      for (const casilla of await flotaDeLaMaquina(partida.id)) {
        assert.ok(!texto.includes(`"${casilla}"`), `la vista no debe incluir ${casilla}`);
      }
    });

    it('si ya hay una partida en curso contra la máquina, devuelve esa', async () => {
      const primera = await servicio.crearContraMaquina(ana.id);
      const segunda = await servicio.crearContraMaquina(ana.id);
      assert.equal(segunda.nueva, false);
      assert.equal(segunda.partida.id, primera.partida.id);
      assert.equal((await servicio.partidaEnCurso(ana.id)).id, primera.partida.id);
    });

    it('sin sesión no se puede crear una partida', async () => {
      await assert.rejects(servicio.crearContraMaquina(undefined), rechazaCon(CODIGOS.NO_AUTENTICADO));
    });
  });

  describe('acceso a una partida', () => {
    it('otro usuario no puede consultarla ni jugar en ella', async () => {
      const { partida } = await servicio.crearContraMaquina(ana.id);
      await assert.rejects(servicio.obtener(luis.id, partida.id), rechazaCon(CODIGOS.PROHIBIDO));
      await assert.rejects(servicio.colocarFlotaAleatoria(luis.id, partida.id), rechazaCon(CODIGOS.PROHIBIDO));
    });

    it('una partida inexistente da PARTIDA_NO_ENCONTRADA', async () => {
      await assert.rejects(servicio.obtener(ana.id, 'no-existe'), rechazaCon(CODIGOS.PARTIDA_NO_ENCONTRADA));
    });
  });

  describe('colocación', () => {
    it('al completar la flota la partida empieza y es el turno del jugador', async () => {
      const { partida } = await servicio.crearContraMaquina(ana.id);
      let vista;
      for (const barco of FLOTA_FIJA) vista = await servicio.colocarBarco(ana.id, partida.id, barco);
      assert.equal(vista.estado, 'en_juego');
      assert.equal(vista.esMiTurno, true);
      assert.equal(vista.propio.flota.length, 5);
    });

    it('un barco inválido se rechaza y la partida guardada no cambia', async () => {
      const { partida } = await servicio.crearContraMaquina(ana.id);
      await servicio.colocarBarco(ana.id, partida.id, FLOTA_FIJA[0]); // A1-A5
      await assert.rejects(
        servicio.colocarBarco(ana.id, partida.id, { barco: 'destructor', casilla: 'B1', orientacion: 'horizontal' }),
        (err) => err.name === 'ErrorDominio',
      );
      assert.equal((await servicio.obtener(ana.id, partida.id)).propio.flota.length, 1);
    });

    it('se puede retirar un barco mientras se coloca la flota', async () => {
      const { partida } = await servicio.crearContraMaquina(ana.id);
      await servicio.colocarBarco(ana.id, partida.id, FLOTA_FIJA[0]);
      const vista = await servicio.retirarBarco(ana.id, partida.id, 'portaaviones');
      assert.equal(vista.propio.flota.length, 0);
    });
  });

  describe('disparos', () => {
    it('tras un agua juega la máquina, y el turno vuelve al jugador si la partida sigue', async () => {
      const vista = await partidaEnJuego(ana.id);
      const r = await servicio.disparar(ana.id, vista.id, await agua(vista.id));
      assert.equal(r.disparo.resultado, 'agua');
      assert.ok(r.disparosRival.length >= 1, 'la máquina dispara al menos una vez');
      assert.equal(r.partida.propio.disparosRecibidos.length, r.disparosRival.length);
      if (r.partida.estado === 'en_juego') assert.equal(r.partida.esMiTurno, true);
    });

    it('tras un acierto el jugador repite y la máquina no dispara', async () => {
      const vista = await partidaEnJuego(ana.id);
      const [casilla] = await flotaDeLaMaquina(vista.id);
      const r = await servicio.disparar(ana.id, vista.id, casilla);
      assert.notEqual(r.disparo.resultado, 'agua');
      assert.deepEqual(r.disparosRival, []);
      assert.equal(r.partida.esMiTurno, true);
    });

    it('un disparo repetido se rechaza sin consumir el turno', async () => {
      const vista = await partidaEnJuego(ana.id);
      const [casilla] = await flotaDeLaMaquina(vista.id);
      await servicio.disparar(ana.id, vista.id, casilla);
      await assert.rejects(servicio.disparar(ana.id, vista.id, casilla), rechazaCon(CODIGOS.DATOS_INVALIDOS));
      assert.equal((await servicio.obtener(ana.id, vista.id)).esMiTurno, true);
    });

    it('al hundir toda la flota de la máquina, el jugador gana y la partida deja de estar en curso', async () => {
      const vista = await partidaEnJuego(ana.id);
      let r;
      for (const casilla of await flotaDeLaMaquina(vista.id)) r = await servicio.disparar(ana.id, vista.id, casilla);
      assert.equal(r.partida.estado, 'terminada');
      assert.equal(r.partida.resultado, 'victoria');
      assert.equal(r.partida.rival.flota.length, 5, 'al terminar se muestra la flota rival');
      assert.equal(await servicio.partidaEnCurso(ana.id), null);
      assert.equal((await servicio.crearContraMaquina(ana.id)).nueva, true);
    });
  });

  describe('abandono', () => {
    it('abandonar cuenta como derrota y la partida ya no admite jugadas', async () => {
      const vista = await partidaEnJuego(ana.id);
      const fin = await servicio.abandonar(ana.id, vista.id);
      assert.equal(fin.estado, 'terminada');
      assert.equal(fin.resultado, 'derrota');
      assert.equal(fin.motivoFin, 'abandono');
      await assert.rejects(servicio.disparar(ana.id, vista.id, 'A1'), rechazaCon(CODIGOS.ESTADO_INVALIDO));
    });
  });

  describe('historial y estadísticas (RF-18, RF-19)', () => {
    // Gana una partida disparando primero a un agua (juega la máquina) y
    // después a toda la flota de la máquina.
    async function ganar(idUsuario) {
      const vista = await partidaEnJuego(idUsuario);
      await servicio.disparar(idUsuario, vista.id, await agua(vista.id));
      for (const casilla of await flotaDeLaMaquina(vista.id)) {
        const actual = await servicio.obtener(idUsuario, vista.id);
        if (actual.estado === 'terminada') break;
        await servicio.disparar(idUsuario, vista.id, casilla);
      }
      return vista.id;
    }

    async function abandonar(idUsuario) {
      const vista = await partidaEnJuego(idUsuario);
      await servicio.abandonar(idUsuario, vista.id);
      return vista.id;
    }

    it('sin partidas terminadas, el historial está vacío y las estadísticas a cero', async () => {
      await partidaEnJuego(ana.id); // en curso: no cuenta
      assert.deepEqual(await servicio.historial(ana.id), []);
      assert.deepEqual(await servicio.estadisticas(ana.id), {
        jugadas: 0, ganadas: 0, perdidas: 0, porcentajeVictorias: null, disparos: 0, aciertos: 0, porcentajeAcierto: null,
      });
    });

    it('el historial muestra fecha, rival, resultado, disparos y acierto, la más reciente primero', async () => {
      const ganada = await ganar(ana.id);
      const abandonada = await abandonar(ana.id);
      const historial = await servicio.historial(ana.id);
      assert.deepEqual(historial.map((h) => h.id), [abandonada, ganada]);
      const [derrota, victoria] = historial;
      assert.equal(victoria.oponente, 'maquina');
      assert.equal(victoria.resultado, 'victoria');
      assert.equal(victoria.disparos, 18); // un agua y las 17 casillas de la flota
      assert.equal(victoria.aciertos, 17);
      assert.equal(victoria.porcentajeAcierto, 94.4);
      assert.ok(victoria.fecha);
      assert.equal(derrota.resultado, 'derrota');
      assert.equal(derrota.motivoFin, 'abandono');
      assert.equal(derrota.porcentajeAcierto, null, 'sin disparos no hay porcentaje');
    });

    it('las estadísticas se calculan a partir de las partidas guardadas', async () => {
      await ganar(ana.id);
      await abandonar(ana.id);
      await abandonar(ana.id);
      assert.deepEqual(await servicio.estadisticas(ana.id), {
        jugadas: 3, ganadas: 1, perdidas: 2, porcentajeVictorias: 33.3, disparos: 18, aciertos: 17, porcentajeAcierto: 94.4,
      });
    });

    it('cada jugador ve solo sus partidas', async () => {
      await ganar(ana.id);
      assert.deepEqual(await servicio.historial(luis.id), []);
      await assert.rejects(servicio.historial(luis.id, ana.id), rechazaCon(CODIGOS.PROHIBIDO));
      await assert.rejects(servicio.estadisticas(luis.id, ana.id), rechazaCon(CODIGOS.PROHIBIDO));
    });

    it('el administrador consulta el historial y las estadísticas de cualquier usuario', async () => {
      const admin = await usuarios.asegurarAdministrador({ email: 'admin@ejemplo.com', contrasena: 'clave-del-admin' });
      await ganar(ana.id);
      assert.equal((await servicio.historial(admin.id, ana.id)).length, 1);
      assert.equal((await servicio.estadisticas(admin.id, ana.id)).ganadas, 1);
      await assert.rejects(servicio.historial(admin.id, 'no-existe'), rechazaCon(CODIGOS.USUARIO_NO_ENCONTRADO));
    });

    it('sin sesión no hay historial ni estadísticas', async () => {
      await assert.rejects(servicio.historial(undefined), rechazaCon(CODIGOS.NO_AUTENTICADO));
      await assert.rejects(servicio.estadisticas(undefined), rechazaCon(CODIGOS.NO_AUTENTICADO));
    });

    it('la clasificación incluye a los jugadores activos con partidas y marca al solicitante (RF-20)', async () => {
      await ganar(luis.id);
      await abandonar(ana.id);
      const tabla = await servicio.clasificacion(ana.id);
      assert.deepEqual(tabla.map((f) => [f.posicion, f.nombre, f.ganadas, f.esSolicitante]), [
        [1, 'luis', 1, false],
        [2, 'ana', 0, true],
      ]);
      assert.ok(tabla.every((f) => !('email' in f)));

      await usuarios.eliminarUsuario(luis.id, luis.id); // un usuario eliminado deja de aparecer
      assert.deepEqual((await servicio.clasificacion(ana.id)).map((f) => f.nombre), ['ana']);
      await assert.rejects(servicio.clasificacion(undefined), rechazaCon(CODIGOS.NO_AUTENTICADO));
    });
  });

  describe('gestión de partidas del administrador (RF-21)', () => {
    let admin;
    beforeEach(async () => {
      admin = await usuarios.asegurarAdministrador({ email: 'admin@ejemplo.com', contrasena: 'clave-del-admin' });
    });

    it('el administrador ve las partidas en curso de todos, sin las flotas', async () => {
      const deAna = await partidaEnJuego(ana.id);
      const deLuis = (await servicio.crearContraMaquina(luis.id)).partida;
      const terminada = await partidaEnJuego(admin.id);
      await servicio.abandonar(admin.id, terminada.id);

      const lista = await servicio.listarEnCurso(admin.id);
      assert.deepEqual(lista.map((p) => p.id).sort(), [deAna.id, deLuis.id].sort());
      const fila = lista.find((p) => p.id === deAna.id);
      assert.deepEqual(fila.jugadores, ['ana@ejemplo.com', 'maquina']);
      assert.equal(fila.estado, 'en_juego');
      assert.ok(!JSON.stringify(lista).includes('flota'));
    });

    it('un usuario normal no puede ver ni anular partidas de otros', async () => {
      const deAna = await partidaEnJuego(ana.id);
      await assert.rejects(servicio.listarEnCurso(luis.id), rechazaCon(CODIGOS.PROHIBIDO));
      await assert.rejects(servicio.anular(luis.id, deAna.id), rechazaCon(CODIGOS.PROHIBIDO));
      await assert.rejects(servicio.anular(ana.id, deAna.id), rechazaCon(CODIGOS.PROHIBIDO));
    });

    it('una partida anulada deja de estar en curso y no admite más jugadas', async () => {
      const deAna = await partidaEnJuego(ana.id);
      await servicio.anular(admin.id, deAna.id);
      assert.equal(await servicio.partidaEnCurso(ana.id), null);
      assert.equal((await servicio.obtener(ana.id, deAna.id)).anulada, true);
      await assert.rejects(servicio.disparar(ana.id, deAna.id, 'A1'), rechazaCon(CODIGOS.PARTIDA_ANULADA));
      await assert.rejects(servicio.abandonar(ana.id, deAna.id), rechazaCon(CODIGOS.PARTIDA_ANULADA));
      assert.deepEqual(await servicio.listarEnCurso(admin.id), []);
      assert.equal((await servicio.crearContraMaquina(ana.id)).nueva, true, 'puede empezar otra');
    });

    it('una partida anulada no cuenta en el historial ni en las estadísticas', async () => {
      const deAna = await partidaEnJuego(ana.id);
      await servicio.anular(admin.id, deAna.id);
      assert.deepEqual(await servicio.historial(ana.id), []);
      assert.equal((await servicio.estadisticas(ana.id)).jugadas, 0);
    });

    it('solo se anulan partidas que existen y siguen en curso', async () => {
      const deAna = await partidaEnJuego(ana.id);
      await servicio.abandonar(ana.id, deAna.id);
      await assert.rejects(servicio.anular(admin.id, deAna.id), rechazaCon(CODIGOS.ESTADO_INVALIDO));
      await assert.rejects(servicio.anular(admin.id, 'no-existe'), rechazaCon(CODIGOS.PARTIDA_NO_ENCONTRADA));
      assert.equal((await servicio.historial(ana.id)).length, 1, 'la partida terminada sigue contando');
    });
  });
});
