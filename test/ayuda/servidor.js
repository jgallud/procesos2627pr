// Utilidad de pruebas: arranca una app Express en un puerto libre y devuelve
// una función para hacer peticiones HTTP reales contra ella.

async function arrancar(app) {
  const servidor = await new Promise((resolve) => {
    const s = app.listen(0, () => resolve(s));
  });
  const { port } = servidor.address();
  const base = `http://127.0.0.1:${port}`;

  async function peticion(metodo, ruta, { cuerpo, cabeceras = {} } = {}) {
    const opciones = { method: metodo, headers: { ...cabeceras } };
    if (cuerpo !== undefined) {
      opciones.headers['Content-Type'] = 'application/json';
      opciones.body = typeof cuerpo === 'string' ? cuerpo : JSON.stringify(cuerpo);
    }
    const respuesta = await fetch(base + ruta, opciones);
    const texto = await respuesta.text();
    let datos = null;
    try { datos = texto ? JSON.parse(texto) : null; } catch { datos = texto; }
    return { estado: respuesta.status, datos, cabeceras: respuesta.headers };
  }

  const cerrar = () => new Promise((resolve) => servidor.close(resolve));

  return { peticion, cerrar };
}

module.exports = { arrancar };
