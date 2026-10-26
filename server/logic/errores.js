// Errores de dominio de la capa lógica. La capa lógica no sabe nada de HTTP:
// solo indica QUÉ ha fallado mediante un código; la capa API decide cómo
// traducirlo a una respuesta (código de estado, mensaje).

const CODIGOS = Object.freeze({
  DATOS_INVALIDOS: 'DATOS_INVALIDOS',
  EMAIL_DUPLICADO: 'EMAIL_DUPLICADO',
  USUARIO_NO_ENCONTRADO: 'USUARIO_NO_ENCONTRADO',
  NO_AUTENTICADO: 'NO_AUTENTICADO',
  PROHIBIDO: 'PROHIBIDO',
  ESTADO_INVALIDO: 'ESTADO_INVALIDO',
  CREDENCIALES_INVALIDAS: 'CREDENCIALES_INVALIDAS',
  CUENTA_PENDIENTE: 'CUENTA_PENDIENTE',
  CUENTA_ELIMINADA: 'CUENTA_ELIMINADA',
  TOKEN_INVALIDO: 'TOKEN_INVALIDO',
  CUENTA_LOCAL: 'CUENTA_LOCAL',
  EMAIL_NO_VERIFICADO: 'EMAIL_NO_VERIFICADO',
});

class ErrorDominio extends Error {
  constructor(codigo, mensaje) {
    super(mensaje);
    this.name = 'ErrorDominio';
    this.codigo = codigo;
  }
}

module.exports = { ErrorDominio, CODIGOS };
