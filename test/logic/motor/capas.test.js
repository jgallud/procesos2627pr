// RNF-09: el motor del juego está en la capa lógica y no depende de HTTP,
// WebSocket, base de datos ni interfaz. Se comprueba leyendo sus require().

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const CARPETA_MOTOR = path.join(__dirname, '..', '..', '..', 'server', 'logic', 'motor');

describe('Motor: separación de capas (RNF-09)', () => {
  it('solo importa módulos del propio motor y los errores de la lógica', () => {
    const archivos = fs.readdirSync(CARPETA_MOTOR).filter((f) => f.endsWith('.js'));
    assert.ok(archivos.length > 0);
    for (const archivo of archivos) {
      const codigo = fs.readFileSync(path.join(CARPETA_MOTOR, archivo), 'utf8');
      const importados = [...codigo.matchAll(/require\(\s*['"]([^'"]+)['"]\s*\)/g)].map((m) => m[1]);
      for (const modulo of importados) {
        assert.ok(
          modulo.startsWith('./') || modulo === '../errores',
          `${archivo} importa «${modulo}», que no es del motor`,
        );
      }
    }
  });
});
