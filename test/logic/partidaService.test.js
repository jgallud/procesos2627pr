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
    servicio = crearServicioPartidas({ repositorio, servicioUsuarios: usuarios, azar: azarFijo(7) });
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
});
