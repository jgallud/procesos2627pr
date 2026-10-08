// Pruebas unitarias del hash de contraseñas.

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { hashear, verificar } = require('../../server/logic/contrasenas');

describe('Hash de contraseñas', () => {
  it('no guarda la contraseña en claro', async () => {
    const hash = await hashear('secreto-123');
    assert.ok(!hash.includes('secreto-123'));
    assert.match(hash, /^scrypt\$\d+\$\d+\$\d+\$[^$]+\$[^$]+$/);
  });

  it('verifica la contraseña correcta y rechaza una incorrecta', async () => {
    const hash = await hashear('secreto-123');
    assert.equal(await verificar('secreto-123', hash), true);
    assert.equal(await verificar('secreto-124', hash), false);
  });

  it('usa una sal distinta en cada hash', async () => {
    const a = await hashear('misma-clave');
    const b = await hashear('misma-clave');
    assert.notEqual(a, b);
    assert.equal(await verificar('misma-clave', a), true);
    assert.equal(await verificar('misma-clave', b), true);
  });

  it('rechaza un hash mal formado o ausente sin lanzar errores', async () => {
    assert.equal(await verificar('x', 'no-es-un-hash'), false);
    assert.equal(await verificar('x', undefined), false);
  });

  it('no admite contraseñas vacías', async () => {
    await assert.rejects(hashear(''), TypeError);
  });
});
