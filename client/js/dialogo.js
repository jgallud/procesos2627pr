// FRONTEND — CAPA DE PRESENTACIÓN: ventana de confirmación propia (MJ-16).
//
// Sustituye a window.confirm, cuyo aspecto depende del navegador y no encaja
// con la aplicación. Usa el elemento <dialog> del navegador, que ya resuelve
// lo difícil: es modal (no se puede tocar la página de detrás), lleva el foco
// dentro y se cierra con Escape (equivale a «Cancelar»).
//
//   const ok = await confirmar({
//     titulo: '¿Abandonar la partida?',
//     mensaje: 'Contará como derrota.',
//     aceptar: 'Abandonar', cancelar: 'Seguir jugando', peligro: true,
//   });

const $ = (selector) => document.querySelector(selector);

export function confirmar({ titulo, mensaje = '', aceptar = 'Aceptar', cancelar = 'Cancelar', peligro = false }) {
  const dialogo = $('#dialogo-confirmar');
  $('#dialogo-titulo').textContent = titulo;
  $('#dialogo-mensaje').textContent = mensaje;
  $('#dialogo-mensaje').hidden = !mensaje;
  const botonAceptar = $('#dialogo-aceptar');
  const botonCancelar = $('#dialogo-cancelar');
  botonAceptar.textContent = aceptar;
  botonAceptar.className = peligro ? 'boton-peligro-lleno' : 'boton-principal';
  botonCancelar.textContent = cancelar;

  return new Promise((resolve) => {
    // El formulario del diálogo usa method="dialog": cada botón cierra la
    // ventana con su `value` como returnValue. Escape la cierra con ''.
    dialogo.addEventListener('close', () => resolve(dialogo.returnValue === 'aceptar'), { once: true });
    dialogo.returnValue = '';
    dialogo.showModal();
    // En las acciones que no se pueden deshacer, el foco empieza en «Cancelar».
    (peligro ? botonCancelar : botonAceptar).focus();
  });
}
