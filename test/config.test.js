// Pruebas de la configuración: en producción, APP_URL es obligatoria y debe
// ser HTTPS, para que el enlace de confirmación nunca apunte a localhost.

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { leerConfig, validarConfig } = require('../server/config');

describe('Configuración', () => {
  it('en desarrollo, sin APP_URL, el enlace usa localhost con el puerto', () => {
    const config = leerConfig({ PORT: '4000' });
    assert.equal(config.urlBase, 'http://localhost:4000');
    assert.doesNotThrow(() => validarConfig(config));
  });

  it('en producción, sin APP_URL, no se puede arrancar', () => {
    const config = leerConfig({ NODE_ENV: 'production', PORT: '8080' });
    assert.throws(() => validarConfig(config), /APP_URL es obligatoria en producción/);
  });

  it('en producción, APP_URL debe ser HTTPS', () => {
    const config = leerConfig({ NODE_ENV: 'production', APP_URL: 'http://ejemplo.com' });
    assert.throws(() => validarConfig(config), /https:\/\//);
  });

  it('en producción, con APP_URL HTTPS, la configuración es válida y se usa esa URL', () => {
    const config = leerConfig({ NODE_ENV: 'production', APP_URL: 'https://app.ejemplo.com' });
    assert.doesNotThrow(() => validarConfig(config));
    assert.equal(config.urlBase, 'https://app.ejemplo.com');
  });
});
