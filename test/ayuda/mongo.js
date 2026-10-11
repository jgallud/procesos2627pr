// Utilidad de pruebas para MongoDB.
//
// Las pruebas con base de datos solo se ejecutan si existe MONGODB_URI_TEST
// (en el CI la aporta un contenedor de MongoDB; ver .github/workflows/ci.yml).
// Sin ella se marcan como omitidas, así `npm test` funciona en cualquier
// equipo sin base de datos.
//
// Cada ejecución usa una base de datos propia con nombre aleatorio que se
// borra al terminar, para no tocar nunca datos reales.

const { randomBytes } = require('node:crypto');
const { conectarMongo } = require('../../server/data/conexionMongo');

const uriPruebas = process.env.MONGODB_URI_TEST || '';
const omitirSinMongo = uriPruebas ? false : 'MONGODB_URI_TEST no definida: pruebas con MongoDB omitidas';

function nombreBasePruebas() {
  return `pruebas_${randomBytes(6).toString('hex')}`;
}

async function conectarPruebas(nombreBase = nombreBasePruebas()) {
  return conectarMongo({ uri: uriPruebas, nombreBase, opcionesCliente: { serverSelectionTimeoutMS: 5000 } });
}

module.exports = { uriPruebas, omitirSinMongo, nombreBasePruebas, conectarPruebas };
