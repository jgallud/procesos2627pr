// El repositorio de partidas en memoria debe cumplir el contrato común.

const { crearRepositorioPartidasMemoria } = require('../../server/data/partidaRepositorioMemoria');
const { probarContratoPartidas } = require('../contratos/repositorioPartidas');

probarContratoPartidas('memoria', { crear: () => crearRepositorioPartidasMemoria() });
