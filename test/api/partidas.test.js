// Pruebas de integración de la API de partidas (Hito 5): peticiones HTTP
// reales contra la app con repositorios en memoria y una fuente de azar fija.
// Comprueban la traducción HTTP <-> servicio: códigos de estado, sesión,
// errores en JSON y que ninguna respuesta incluye la flota de la máquina.

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const { arrancar, cookieDe } = require('../ayuda/servidor');
const { montar, CLAVE } = require('../ayuda/montaje');
const { azarFijo } = require('../logic/motor/ayuda');

describe('API /api/partidas', () => {
  let servidor;
  let ctx;
  let cookieAna;
  let cookieLuis;

  async function conSesion(email) {
    await ctx.usuarioActivo(email);
    const r = await servidor.peticion('POST', '/api/sesion', { cuerpo: { email, contrasena: CLAVE } });
    assert.equal(r.estado, 200);
    return cookieDe(r.cookies);
  }

  const pedir = (metodo, ruta, cookie, cuerpo) => servidor.peticion(metodo, ruta, { cookie, cuerpo });

  async function flotaDeLaMaquina(idPartida) {
    const guardada = await ctx.repositorioPartidas.buscarPorId(idPartida);
    return guardada.juego.jugadores[1].flota.flatMap((b) => b.casillas);
  }

  async function partidaEnJuego() {
    const creada = await pedir('POST', '/api/partidas', cookieAna);
    const r = await pedir('POST', `/api/partidas/${creada.datos.id}/flota-aleatoria`, cookieAna);
    assert.equal(r.estado, 200);
    assert.equal(r.datos.estado, 'en_juego');
    return r.datos;
  }

  beforeEach(async () => {
    ctx = montar({ azar: azarFijo(11) });
    servidor = await arrancar(ctx.app);
    cookieAna = await conSesion('ana@ejemplo.com');
    cookieLuis = await conSesion('luis@ejemplo.com');
  });

  afterEach(async () => { await servidor.cerrar(); });

  describe('POST /api/partidas', () => {
    it('201 con la partida nueva contra la máquina, sin su flota', async () => {
      const r = await pedir('POST', '/api/partidas', cookieAna);
      assert.equal(r.estado, 201);
      assert.equal(r.datos.oponente, 'maquina');
      assert.equal(r.datos.estado, 'colocando');
      assert.equal(r.datos.rival.flota, null);
      const texto = JSON.stringify(r.datos);
      for (const casilla of await flotaDeLaMaquina(r.datos.id)) assert.ok(!texto.includes(`"${casilla}"`));
    });

    it('200 con la misma partida si ya había una en curso', async () => {
      const primera = await pedir('POST', '/api/partidas', cookieAna);
      const segunda = await pedir('POST', '/api/partidas', cookieAna);
      assert.equal(segunda.estado, 200);
      assert.equal(segunda.datos.id, primera.datos.id);
    });

    it('401 sin sesión', async () => {
      const r = await pedir('POST', '/api/partidas');
      assert.equal(r.estado, 401);
      assert.equal(r.datos.codigo, 'NO_AUTENTICADO');
    });
  });

  describe('GET /api/partidas/actual y /:id', () => {
    it('devuelve null si no hay partida en curso, y la partida si la hay', async () => {
      assert.equal((await pedir('GET', '/api/partidas/actual', cookieAna)).datos, null);
      const creada = await pedir('POST', '/api/partidas', cookieAna);
      const actual = await pedir('GET', '/api/partidas/actual', cookieAna);
      assert.equal(actual.estado, 200);
      assert.equal(actual.datos.id, creada.datos.id);
    });

    it('403 si la partida es de otro usuario y 404 si no existe', async () => {
      const creada = await pedir('POST', '/api/partidas', cookieAna);
      const ajena = await pedir('GET', `/api/partidas/${creada.datos.id}`, cookieLuis);
      assert.equal(ajena.estado, 403);
      assert.equal(ajena.datos.codigo, 'PROHIBIDO');
      const inexistente = await pedir('GET', '/api/partidas/no-existe', cookieAna);
      assert.equal(inexistente.estado, 404);
      assert.equal(inexistente.datos.codigo, 'PARTIDA_NO_ENCONTRADA');
    });
  });

  describe('colocación', () => {
    it('coloca y retira un barco; rechaza con 400 un barco fuera del tablero', async () => {
      const { datos: p } = await pedir('POST', '/api/partidas', cookieAna);
      const puesto = await pedir('POST', `/api/partidas/${p.id}/barcos`, cookieAna,
        { barco: 'destructor', casilla: 'A1', orientacion: 'horizontal' });
      assert.equal(puesto.estado, 200);
      assert.equal(puesto.datos.propio.flota.length, 1);

      const fuera = await pedir('POST', `/api/partidas/${p.id}/barcos`, cookieAna,
        { barco: 'portaaviones', casilla: 'J8', orientacion: 'horizontal' });
      assert.equal(fuera.estado, 400);
      assert.ok(fuera.datos.error);

      const quitado = await pedir('DELETE', `/api/partidas/${p.id}/barcos/destructor`, cookieAna);
      assert.equal(quitado.estado, 200);
      assert.equal(quitado.datos.propio.flota.length, 0);
    });
  });

  describe('POST /api/partidas/:id/disparos', () => {
    it('devuelve el resultado del disparo, los de la máquina y la vista', async () => {
      const p = await partidaEnJuego();
      const [casilla] = await flotaDeLaMaquina(p.id);
      const r = await pedir('POST', `/api/partidas/${p.id}/disparos`, cookieAna, { casilla });
      assert.equal(r.estado, 200);
      assert.notEqual(r.datos.disparo.resultado, 'agua');
      assert.deepEqual(r.datos.disparosRival, []);
      assert.equal(r.datos.partida.esMiTurno, true);
    });

    it('409 al disparar con la partida aún sin empezar, y 400 a una casilla repetida', async () => {
      const { datos: p } = await pedir('POST', '/api/partidas', cookieAna);
      const antes = await pedir('POST', `/api/partidas/${p.id}/disparos`, cookieAna, { casilla: 'A1' });
      assert.equal(antes.estado, 409);

      const enJuego = await partidaEnJuego();
      const [casilla] = await flotaDeLaMaquina(enJuego.id);
      await pedir('POST', `/api/partidas/${enJuego.id}/disparos`, cookieAna, { casilla });
      const repetido = await pedir('POST', `/api/partidas/${enJuego.id}/disparos`, cookieAna, { casilla });
      assert.equal(repetido.estado, 400);
    });
  });

  describe('POST /api/partidas/:id/abandono', () => {
    it('termina la partida con derrota y muestra la flota de la máquina', async () => {
      const p = await partidaEnJuego();
      const r = await pedir('POST', `/api/partidas/${p.id}/abandono`, cookieAna);
      assert.equal(r.estado, 200);
      assert.equal(r.datos.estado, 'terminada');
      assert.equal(r.datos.resultado, 'derrota');
      assert.equal(r.datos.rival.flota.length, 5);
      assert.equal((await pedir('GET', '/api/partidas/actual', cookieAna)).datos, null);
    });
  });
});
