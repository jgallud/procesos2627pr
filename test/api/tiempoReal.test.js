// Pruebas de integración del tiempo real (Hito 7, RF-24 a RF-26): servidor
// HTTP real con el WebSocket enganchado, clientes WebSocket de la librería
// ws con la cookie de sesión y jugadas enviadas por la API REST.

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const { WebSocket } = require('ws');
const { montar, CLAVE } = require('../ayuda/montaje');
const { cookieDe } = require('../ayuda/servidor');
const { crearTiempoReal, CIERRE_REINICIO } = require('../../server/api/tiempoReal');
const { azarFijo } = require('../logic/motor/ayuda');

describe('Tiempo real: /api/tiempo-real', () => {
  let ctx;
  let tiempoReal;
  let servidor;
  let base;
  let cookies;
  const abiertos = [];

  async function pedir(metodo, ruta, cookie, cuerpo) {
    const opciones = { method: metodo, headers: { Cookie: cookie ?? '' } };
    if (cuerpo !== undefined) {
      opciones.headers['Content-Type'] = 'application/json';
      opciones.body = JSON.stringify(cuerpo);
    }
    const r = await fetch(`http://${base}${ruta}`, opciones);
    const texto = await r.text();
    return { estado: r.status, datos: texto ? JSON.parse(texto) : null };
  }

  async function conSesion(email) {
    await ctx.usuarioActivo(email);
    const r = await fetch(`http://${base}/api/sesion`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, contrasena: CLAVE }),
    });
    return cookieDe(r.headers.getSetCookie());
  }

  // Abre una conexión y espera a que se acepte (mensaje «conectado») o se
  // rechace (devuelve el código HTTP). Guarda los avisos que van llegando.
  function conectar(idPartida, { cookie, origen } = {}) {
    return new Promise((resolve) => {
      const headers = {};
      if (cookie) headers.Cookie = cookie;
      if (origen) headers.Origin = origen;
      const ws = new WebSocket(`ws://${base}/api/tiempo-real?partida=${encodeURIComponent(idPartida)}`, { headers });
      abiertos.push(ws);
      ws.avisos = [];
      ws.on('unexpected-response', (req, res) => resolve({ rechazo: res.statusCode }));
      ws.on('error', () => {});
      ws.on('message', (datos) => {
        const aviso = JSON.parse(datos);
        if (aviso.tipo === 'conectado') resolve({ ws });
        else ws.avisos.push(aviso);
      });
    });
  }

  // Espera hasta que la conexión haya recibido n avisos.
  async function esperarAvisos(ws, n) {
    for (let i = 0; i < 100 && ws.avisos.length < n; i += 1) await new Promise((r) => { setTimeout(r, 10); });
    return ws.avisos;
  }

  async function partidaConDosJugadores() {
    const creada = await pedir('POST', '/api/partidas', cookies.ana, { modo: 'jugadores' });
    return creada.datos.id;
  }

  beforeEach(async () => {
    tiempoReal = crearTiempoReal();
    ctx = montar({ azar: azarFijo(5), avisador: tiempoReal });
    servidor = await new Promise((resolve) => { const s = ctx.app.listen(0, () => resolve(s)); });
    tiempoReal.conectar({ servidorHttp: servidor, servicioSesiones: ctx.servicioSesiones, servicioPartidas: ctx.servicioPartidas });
    base = `127.0.0.1:${servidor.address().port}`;
    cookies = { ana: await conSesion('ana@ejemplo.com'), luis: await conSesion('luis@ejemplo.com'), eva: await conSesion('eva@ejemplo.com') };
  });

  afterEach(async () => {
    for (const ws of abiertos.splice(0)) ws.terminate();
    await tiempoReal.cerrar();
    await new Promise((resolve) => { servidor.close(resolve); });
  });

  it('sin sesión válida la conexión se rechaza con 401', async () => {
    const id = await partidaConDosJugadores();
    assert.deepEqual(await conectar(id), { rechazo: 401 });
    assert.deepEqual(await conectar(id, { cookie: 'sesion=inventada' }), { rechazo: 401 });
  });

  it('solo los jugadores pueden seguir la partida: 403 para otro usuario y 404 si no existe', async () => {
    const id = await partidaConDosJugadores();
    assert.deepEqual(await conectar(id, { cookie: cookies.eva }), { rechazo: 403 });
    assert.deepEqual(await conectar('no-existe', { cookie: cookies.ana }), { rechazo: 404 });
  });

  it('se rechaza una conexión abierta desde otra web (otro origen)', async () => {
    const id = await partidaConDosJugadores();
    assert.deepEqual(await conectar(id, { cookie: cookies.ana, origen: 'https://otra-web.example' }), { rechazo: 403 });
    assert.ok((await conectar(id, { cookie: cookies.ana, origen: `http://${base}` })).ws);
  });

  it('el creador recibe al instante que el rival se une, que coloca su flota y cada disparo', async () => {
    const id = await partidaConDosJugadores();
    const { ws } = await conectar(id, { cookie: cookies.ana });
    await pedir('POST', `/api/partidas/${id}/union`, cookies.luis);
    await pedir('POST', `/api/partidas/${id}/flota-aleatoria`, cookies.ana);
    await pedir('POST', `/api/partidas/${id}/flota-aleatoria`, cookies.luis);
    assert.deepEqual((await esperarAvisos(ws, 3)).map((a) => a.tipo), ['rival-unido', 'flota-colocada', 'flota-colocada']);

    const { ws: deLuis } = await conectar(id, { cookie: cookies.luis });
    await pedir('POST', `/api/partidas/${id}/disparos`, cookies.ana, { casilla: 'A1' });
    const [disparo] = await esperarAvisos(deLuis, 1);
    assert.equal(disparo.tipo, 'disparo');
    assert.equal(disparo.disparo.casilla, 'A1');
    assert.ok(!JSON.stringify(deLuis.avisos).includes('flota'), 'ningún aviso lleva una flota');
  });

  it('RF-26: al abandonar, el rival recibe el aviso al instante', async () => {
    const id = await partidaConDosJugadores();
    await pedir('POST', `/api/partidas/${id}/union`, cookies.luis);
    const { ws } = await conectar(id, { cookie: cookies.ana });
    await pedir('POST', `/api/partidas/${id}/abandono`, cookies.luis);
    const [aviso] = await esperarAvisos(ws, 1);
    assert.deepEqual(aviso, { partida: id, tipo: 'abandono', jugador: 1 });
    assert.equal((await pedir('GET', `/api/partidas/${id}`, cookies.ana)).datos.resultado, 'victoria');
  });

  it('los avisos de una partida no llegan a quien sigue otra', async () => {
    const id = await partidaConDosJugadores();
    const otra = (await pedir('POST', '/api/partidas', cookies.eva, { modo: 'jugadores' })).datos.id;
    const { ws } = await conectar(otra, { cookie: cookies.eva });
    await pedir('POST', `/api/partidas/${id}/union`, cookies.luis);
    await new Promise((r) => { setTimeout(r, 50); });
    assert.deepEqual(ws.avisos, []);
  });

  it('RF-25: al parar el servidor, las conexiones se cierran con el código de reinicio', async () => {
    const id = await partidaConDosJugadores();
    const { ws } = await conectar(id, { cookie: cookies.ana });
    const cierre = new Promise((resolve) => { ws.on('close', (codigo) => resolve(codigo)); });
    await tiempoReal.cerrar();
    assert.equal(await cierre, CIERRE_REINICIO);
  });
});
