// CAPA DE LÓGICA — hash seguro de contraseñas.
//
// Se usa scrypt (incluido en node:crypto), una función de derivación de
// claves diseñada para contraseñas: es lenta y consume memoria a propósito,
// lo que encarece los ataques por fuerza bruta. Cada contraseña lleva su
// propia sal aleatoria, así que dos contraseñas iguales dan hashes distintos.
//
// Formato almacenado (todo lo necesario para verificar más adelante, aunque
// cambien los parámetros por defecto):
//   scrypt$<N>$<r>$<p>$<sal base64>$<hash base64>
//
// Nunca se guarda ni se registra la contraseña en claro.

const { scrypt, randomBytes, timingSafeEqual } = require('node:crypto');
const { promisify } = require('node:util');

const scryptAsync = promisify(scrypt);

const PARAMETROS = Object.freeze({ N: 2 ** 15, r: 8, p: 1 });
const LONGITUD_SAL = 16;
const LONGITUD_HASH = 64;

// scrypt necesita 128 * N * r bytes; se deja margen sobre el máximo por defecto (32 MB).
function memoriaMaxima({ N, r }) {
  return 128 * N * r * 2;
}

async function hashear(contrasena) {
  if (typeof contrasena !== 'string' || contrasena.length === 0) {
    throw new TypeError('La contraseña debe ser un texto no vacío');
  }
  const { N, r, p } = PARAMETROS;
  const sal = randomBytes(LONGITUD_SAL);
  const hash = await scryptAsync(contrasena, sal, LONGITUD_HASH, { N, r, p, maxmem: memoriaMaxima(PARAMETROS) });
  return ['scrypt', N, r, p, sal.toString('base64'), hash.toString('base64')].join('$');
}

// Devuelve true si la contraseña corresponde al hash almacenado.
// Compara en tiempo constante para no filtrar información por el tiempo de respuesta.
async function verificar(contrasena, almacenado) {
  if (typeof contrasena !== 'string' || typeof almacenado !== 'string') return false;
  const partes = almacenado.split('$');
  if (partes.length !== 6 || partes[0] !== 'scrypt') return false;

  const [, n, r, p, salB64, hashB64] = partes;
  const parametros = { N: Number(n), r: Number(r), p: Number(p) };
  const esperado = Buffer.from(hashB64, 'base64');
  const calculado = await scryptAsync(contrasena, Buffer.from(salB64, 'base64'), esperado.length, {
    ...parametros,
    maxmem: memoriaMaxima(parametros),
  });
  return calculado.length === esperado.length && timingSafeEqual(calculado, esperado);
}

module.exports = { hashear, verificar };
