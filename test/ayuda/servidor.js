// Utilidad de pruebas: arranca una app Express en un puerto libre y devuelve
// una función para hacer peticiones HTTP reales contra ella.
//
// fetch de Node no guarda cookies como un navegador, así que la cookie de
// sesión se pasa a mano con la opción `cookie` y las recibidas se devuelven
// en `cookies` (cabeceras Set-Cookie).

async function arrancar(app) {
  const servidor = await new Promise((resolve) => {
    const s = app.listen(0, () => resolve(s));
  });
  const { port } = servidor.address();
  const base = `http://127.0.0.1:${port}`;

  async function peticion(metodo, ruta, { cuerpo, cabeceras = {}, cookie } = {}) {
    const opciones = { method: metodo, headers: { ...cabeceras } };
    if (cookie) opciones.headers.Cookie = cookie;
    if (cuerpo !== undefined) {
      opciones.headers['Content-Type'] = 'application/json';
      opciones.body = typeof cuerpo === 'string' ? cuerpo : JSON.stringify(cuerpo);
    }
    const respuesta = await fetch(base + ruta, opciones);
    const texto = await respuesta.text();
    let datos = null;
    try { datos = texto ? JSON.parse(texto) : null; } catch { datos = texto; }
    return { estado: respuesta.status, datos, cabeceras: respuesta.headers, cookies: respuesta.headers.getSetCookie() };
  }

  const cerrar = () => new Promise((resolve) => servidor.close(resolve));

  return { peticion, cerrar };
}

// De una lista de cabeceras Set-Cookie, devuelve "nombre=valor" de la cookie
// indicada (lo que el navegador enviaría después en la cabecera Cookie).
function cookieDe(cookies, nombre = 'sesion') {
  const linea = cookies.find((c) => c.startsWith(`${nombre}=`));
  return linea ? linea.split(';')[0] : undefined;
}

module.exports = { arrancar, cookieDe };
