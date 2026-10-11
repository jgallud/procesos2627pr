// El repositorio en memoria debe cumplir el contrato común de usuarios.

const { crearRepositorioUsuariosMemoria } = require('../../server/data/usuarioRepositorioMemoria');
const { probarContratoUsuarios } = require('../contratos/repositorioUsuarios');

probarContratoUsuarios('memoria', { crear: () => crearRepositorioUsuariosMemoria() });
