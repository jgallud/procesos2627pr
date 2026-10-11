// El repositorio de sesiones en memoria debe cumplir el contrato común.

const { crearRepositorioSesionesMemoria } = require('../../server/data/sesionRepositorioMemoria');
const { probarContratoSesiones } = require('../contratos/repositorioSesiones');

probarContratoSesiones('memoria', { crear: () => crearRepositorioSesionesMemoria() });
