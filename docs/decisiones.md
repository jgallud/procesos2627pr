---
type: Decisiones
title: Decisiones de diseño
description: Decisiones de diseño del proyecto, en orden cronológico, con su motivo y su estado.
timestamp: 2026-11-08
---

# Decisiones de diseño

Una sección por decisión, en orden cronológico. Una decisión sustituida no se borra: se marca y se enlaza con la que la reemplaza. Para añadir una nueva, usa el siguiente número libre.

## Hito 1

### D-01 Node.js y Express, con el servidor sirviendo el frontend
- **Qué:** Node.js 22 y Express 5; el mismo servidor sirve la API y el frontend (mismo origen).
- **Por qué:** «Un único lenguaje (JavaScript) en cliente y servidor» y «permite que el mismo servidor sirva la API y el frontend» (README, Tecnologías). El mismo origen permite usar la cookie de sesión sin CORS (`server/app.js`).
- **Estado:** vigente. Evidencia: `4940e9b`.

### D-02 Frontend sin framework
- **Qué:** HTML, CSS y JavaScript con módulos ES, sin framework.
- **Por qué:** «El frontend es pequeño; sin framework se ve claramente la separación entre interfaz (`interfaz.js`) y cliente de comunicación (`api.js`)» (README).
- **Estado:** vigente. Evidencia: `bed6929` (interfaz y capa de comunicación separadas).

### D-03 Pruebas con node:test
- **Qué:** runner de pruebas incluido en Node.
- **Por qué:** «pruebas automatizadas sin dependencias adicionales» (README).
- **Estado:** vigente. Evidencia: `fcbb620`.

### D-04 Despliegue continuo desde GitHub Actions
- **Qué:** un workflow `deploy.yml` construía y desplegaba en Cloud Run.
- **Por qué:** TODO(alumno): ¿por qué empezaste con un workflow de despliegue en GitHub Actions, y por qué al fallar la autenticación optaste por cambiar a Cloud Build en vez de corregirla?
- **Estado:** sustituida por [D-08](#d-08-despliegue-continuo-con-cloud-build). Evidencia: creada en `b0197da`; su primera ejecución en `main` falló al autenticarse en Google Cloud; `deploy.yml` eliminado en `d7e5c32` (PR #4).

### D-05 Contratos de repositorio con dos implementaciones
- **Qué:** la lógica recibe repositorios con un contrato asíncrono. Hay una implementación en memoria (desarrollo y pruebas) y otra en MongoDB (producción), y ambas pasan las mismas pruebas de `test/contratos/`.
- **Por qué:** sustituir la memoria por la base de datos sin modificar la lógica, como pide la especificación para el Hito 3; «El paso a MongoDB en el Hito 3 no modificó ningún archivo de `server/logic/` ni de `server/api/`» (README).
- **Estado:** vigente. Evidencia: `c10684b` (contrato asíncrono), `c35aab8` (MongoDB), `028e4e1` (pruebas de contrato comunes).

### D-06 Identificación provisional con la cabecera X-Usuario-Id
- **Qué:** en el Hito 1 el solicitante se identificaba con una cabecera `X-Usuario-Id`.
- **Por qué:** TODO(alumno): ¿por qué una cabecera provisional en vez de esperar a tener sesión?
- **Estado:** sustituida por [D-10](#d-10-sesiones-en-servidor-con-cookie-httponly). Evidencia: `d7ef7ed`. Una prueba comprueba que ya no se acepta (`test/api/usuarios.test.js`).

### D-07 Administrador inicial por variables de entorno
- **Qué:** al arrancar, el servidor crea o promueve una cuenta de administrador con `ADMIN_EMAIL` y `ADMIN_PASSWORD` (`asegurarAdministrador`).
- **Por qué:** «no requiere tocar la base de datos a mano, es idempotente y ni el email ni la contraseña del administrador están en el código» (README, Administrador inicial).
- **Estado:** vigente. Evidencia: `73dd9bc`.

### D-08 Despliegue continuo con Cloud Build
- **Qué:** un activador de Cloud Build conectado al repositorio construye la imagen con el `Dockerfile` y despliega en Cloud Run cada cambio en `main`. El CI sigue en GitHub Actions, de forma independiente.
- **Por qué:** «la integración con GitHub despliega cada cambio en `main` sin claves que custodiar» (README); «No hay … claves de cuenta de servicio en GitHub» (`docs/despliegue-cloud-run.md`).
- **Estado:** vigente. Sustituye a [D-04](#d-04-despliegue-continuo-desde-github-actions). Evidencia: `d7e5c32` (PR #4), `c114569` (PR #5).

## Hito 2

### D-09 Hash de contraseñas con scrypt
- **Qué:** `scrypt` de `node:crypto`, con sal aleatoria y comparación en tiempo constante.
- **Por qué:** «lenta, con sal y coste de memoria, recomendada por OWASP» e «incluida en Node: sin dependencias nativas» (README).
- **Estado:** vigente. Evidencia: `50c903a`, `server/logic/contrasenas.js`.

### D-10 Sesiones en servidor con cookie HttpOnly
- **Qué:** la sesión se guarda en el servidor y el navegador solo tiene un identificador aleatorio de 256 bits en una cookie `HttpOnly`, `SameSite=Lax` y `Secure` en producción.
- **Por qué:** «Cerrar sesión invalida de verdad el estado» y «el JavaScript de la página no puede leer el identificador» (README).
- **Estado:** vigente. Sustituye a [D-06](#d-06-identificación-provisional-con-la-cabecera-x-usuario-id). Evidencia: `5eb46c5`.

### D-11 Notificador de confirmación desacoplado
- **Qué:** la lógica recibe un notificador con `enviarConfirmacion`. Mientras no haya correo, `notificadorLog.js` escribe el enlace en el log.
- **Por qué:** cambiar el log por un correo «sin cambiar la capa lógica: solo cambia el objeto que se crea en `server/index.js`» (comentario de `server/notificacion/notificadorLog.js`).
- **Estado:** vigente; la implementación por correo está pendiente ([RF-02](requisitos.md)). Evidencia: `caeab10`.

### D-12 Token de confirmación con SHA-256
- **Qué:** el token tiene la forma `id.secreto`; solo se guarda el SHA-256 del secreto y es de un solo uso.
- **Por qué:** con 256 bits aleatorios no hace falta una función lenta, y el `id` permite localizar al usuario sin añadir búsquedas al repositorio (comentario de `generarTokenConfirmacion` en `server/logic/usuarioService.js`).
- **Estado:** vigente. Evidencia: `caeab10`.

## Hito 3

### D-13 MongoDB Atlas con el driver oficial, sin ODM
- **Qué:** cluster M0 de Atlas y el paquete `mongodb`, sin Mongoose.
- **Por qué:** cluster «gratuito y permanente»; «los repositorios ya definen el contrato y la validación está en la capa lógica, así que un esquema adicional duplicaría reglas» (README).
- **Estado:** vigente. Evidencia: `c35aab8`.

### D-14 Sesiones en MongoDB con índice TTL
- **Qué:** la colección `sesiones` guarda las sesiones y un índice TTL borra las caducadas.
- **Por qué:** «un nuevo despliegue o un reinicio no cierra la sesión de nadie y Cloud Run puede usar varias instancias» (README, Persistencia).
- **Estado:** vigente. Evidencia: `c35aab8`, `test/data/repositoriosMongo.test.js`.

## Sprint 2 · Hito 4

### D-15 Correo de confirmación con Brevo
- **Qué:** la confirmación de cuenta se envía por correo con el API transaccional de Brevo (`POST https://api.brevo.com/v3/smtp/email`), desde un notificador nuevo que cumple el mismo contrato que `notificadorLog.js` ([D-11](#d-11-notificador-de-confirmación-desacoplado)). La clave de API es un secreto.
- **Alternativas consideradas:** Resend (sin un dominio verificado solo envía a la dirección del propio titular de la cuenta, así que la revisión entre pares no podría registrarse); SMTP autenticado de Gmail (sin servicio nuevo, pero con peor entrega y límites diarios bajos). Brevo ofrece en su plan gratuito 300 correos al día por API, con su logo en cada correo.
- **Por qué:** TODO(alumno): ¿por qué Brevo frente a las alternativas?
- **Consecuencias:** sin `BREVO_API_KEY`, el servidor sigue usando el notificador del log (desarrollo y pruebas, o producción mientras no se configure el secreto), y lo avisa al arrancar. Si Brevo rechaza un envío, el registro responde con error 500 y la cuenta queda pendiente sin forma de pedir otro enlace: el reenvío queda fuera de esta decisión.
- **Estado:** vigente.

### D-16 APP_URL obligatoria en producción
- **Qué:** en producción el servidor no arranca si falta `APP_URL` o si no empieza por `https://` (`validarConfig` en `server/config.js`). En desarrollo sigue valiendo `http://localhost:PORT` por defecto.
- **Por qué:** sin `APP_URL` en Cloud Run, los correos de confirmación llevaban un enlace a `http://localhost:8080` (detectado el 2026-10-26). Es el mismo criterio que con `MONGODB_URI`: mejor no arrancar que funcionar mal sin que nadie lo note. No se usa la cabecera `Host` de la petición para construir la URL, porque la controla el cliente y permitiría enviar enlaces a otro sitio.
- **Estado:** vigente. Evidencia: `test/config.test.js`.

### D-17 Inicio de sesión externo con Google
- **Qué:** el proveedor OAuth es Google (OpenID Connect), con los ámbitos `openid email profile`.
- **Alternativas consideradas:** GitHub (configuración más sencilla; todos los alumnos tienen cuenta).
- **Por qué:** TODO(alumno): ¿por qué Google?
- **Consecuencias:** el botón sigue la [guía de marca de Google](https://developers.google.com/identity/branding-guidelines): tema claro, logotipo oficial sin modificar (de `signin-assets.zip`) y el texto «Iniciar sesión con Google».
- **Estado:** vigente.

### D-18 Correo de OAuth que ya tiene cuenta local
- **Qué:** si alguien entra con Google usando un correo que ya tiene cuenta local (con contraseña), no se le deja entrar con Google: se le pide que inicie sesión con su contraseña. Las cuentas no se vinculan.
- **Alternativas consideradas:** vincular la cuenta de Google a la cuenta local existente (más cómodo, pero obliga a confiar en la verificación del correo del proveedor y a diseñar cómo se unen las dos formas de entrar).
- **Por qué:** TODO(alumno): ¿por qué rechazar en vez de vincular?
- **Consecuencias:** una cuenta es local u OAuth según su `origen`, y no cambia. Una cuenta OAuth no tiene contraseña: el inicio de sesión local la rechaza con el error genérico de credenciales. Si Google no confirma que el correo está verificado (`email_verified`), tampoco se entra.
- **Estado:** vigente.

### D-19 Flujo OAuth implementado a mano
- **Qué:** flujo *authorization code* sin librerías: `GET /api/oauth/google` redirige a Google con un `state` aleatorio guardado en una cookie `HttpOnly` de 10 minutos; `GET /api/oauth/google/retorno` comprueba el `state`, cambia el código por un token y pide los datos del usuario a Google. La comunicación con Google está en un módulo inyectado (`server/oauth/proveedorGoogle.js`), igual que el notificador de Brevo; la lógica solo recibe correo, nombre y si el correo está verificado.
- **Alternativas consideradas:** Passport.js (menos código propio, pero añade dependencias y su propio manejo de sesiones, distinto de las sesiones en MongoDB de [D-10](#d-10-sesiones-en-servidor-con-cookie-httponly)).
- **Por qué:** TODO(alumno): ¿por qué a mano? (el resto del proyecto resuelve sesiones y hash sin librerías externas).
- **Estado:** vigente.

### D-20 MongoDB 8 en el CI con el kernel 7.0 de GitHub
- **Qué:** el contenedor `mongo:8` del CI arranca con la variable `GLIBC_TUNABLES=glibc.pthread.rseq=1` (`.github/workflows/ci.yml`).
- **Contexto:** desde el 18 de octubre de 2026 los runners `ubuntu-latest` de GitHub usan el kernel de Linux 7.0, y MongoDB 8 se niega a arrancar porque detecta mal ese kernel ([actions/runner-images#15005](https://github.com/actions/runner-images/issues/15005)). El CI falló el 2026-10-29 sin llegar a ejecutar las pruebas.
- **Alternativas consideradas:** fijar `runs-on: ubuntu-22.04` (esa imagen se retirará); usar `mongo:7.0` o `mongo:9.0` (el CI dejaría de probar la misma versión mayor que Atlas).
- **Por qué:** mantiene en el CI la misma versión mayor de MongoDB que en producción con un cambio de una línea. TODO(alumno): confirmar o elegir otra alternativa.
- **Consecuencias:** cuando MongoDB publique una versión 8 que detecte bien el kernel (según la incidencia, 8.0.35), se puede quitar la variable.
- **Estado:** vigente.

## Sprint 2 · Hundir la Flota

### D-21 Etiqueta base como punto de partida
- **Qué:** la etiqueta `base` marca el último commit de `main` con el Sprint 1 completo, incluido el Hito 4 (`5b0ac4c`). Hundir la Flota se desarrolla en este repositorio, sobre `main`, con el flujo de siempre. Una aplicación futura distinta parte de `base`: como repositorio nuevo (clonar, `git reset --hard base` y cambiar el remoto) si se va a desplegar, o como rama si solo es una prueba.
- **Alternativas consideradas:** un repositorio por aplicación desde ya, con la base preparada para enchufar módulos (más trabajo ahora para un beneficio que solo aparece con varias aplicaciones); una rama larga por aplicación en este repositorio (choca con GitHub Flow, donde las ramas se integran en `main`, y con el despliegue, que solo publica `main`).
- **Por qué:** TODO(alumno): ¿por qué una etiqueta en vez de preparar ya varias aplicaciones?
- **Consecuencias:** `base` no se mueve nunca. Las mejoras que se hagan en la gestión de usuarios durante el Sprint 2 no llegan a `base`; si se quieren en una aplicación futura, habrá que traerlas a mano.
- **Estado:** vigente.

### D-22 Motor del juego en la capa lógica
- **Qué:** todas las reglas del juego (colocación, disparos, turnos, hundido, fin de partida) están en un motor de funciones puras en `server/logic/`. Un servicio de partidas carga la partida, aplica la jugada con el motor y la guarda; el jugador máquina también está en la lógica, con una fuente de azar inyectable. La API, el WebSocket y el cliente no contienen reglas. El servidor es la única autoridad: el cliente nunca recibe la flota del rival mientras dura la partida.
- **Alternativas consideradas:** repartir la validación entre cliente y servidor (respuesta más inmediata, pero reglas duplicadas y posibilidad de hacer trampas desde el navegador).
- **Por qué:** que las reglas se prueben sin HTTP, sin base de datos y sin navegador, y que nadie pueda hacer trampas desde el cliente (especificación del Sprint 2, RNF-09 y RNF-10).
- **Estado:** vigente.

### D-23 WebSocket solo para avisos y avisador inyectado
- **Qué:** las jugadas se envían siempre por la API REST; el WebSocket solo lleva avisos del servidor al cliente (disparo, rival unido, fin de partida, abandono). Los avisos los emite el servicio de partidas a través de un avisador inyectado (`avisar(idPartida, evento)`), que implementa el módulo de tiempo real de la capa API y conecta `server/index.js`, como el notificador de correo ([D-11](#d-11-notificador-de-confirmación-desacoplado)). En el cliente y en el servidor, REST y WebSocket son módulos distintos de la misma capa.
- **Alternativas consideradas:** enviar también las jugadas por el WebSocket (algo menos de latencia, pero un segundo protocolo de errores y una reconexión más difícil); emitir los avisos desde las rutas REST (no cubre las jugadas de la máquina ni el fin de turno por tiempo).
- **Por qué:** una sola forma de enviar jugadas, con la validación y los mensajes de error que ya existen, y una reconexión que se reduce a pedir el estado por REST y volver a escuchar.
- **Estado:** vigente.

### D-24 Una sola instancia de Cloud Run con WebSocket
- **Qué:** con el Hito 7, el servicio de Cloud Run pasa a tener como máximo una instancia. El estado de las partidas está en MongoDB; las conexiones WebSocket solo viven en memoria y se recuperan al reconectar.
- **Alternativas consideradas:** afinidad de sesión (no garantiza que los dos jugadores caigan en la misma instancia); un canal de avisos entre instancias (funciona con cualquier número de instancias, pero añade otra pieza a la arquitectura).
- **Por qué:** con varias instancias, el aviso de una jugada puede producirse en una instancia distinta de la que tiene abierta la conexión del rival. Una instancia basta para la carga prevista y no añade piezas (RNF-12).
- **Consecuencias:** las conexiones se cortan en cada despliegue y al llegar al tiempo máximo de petición de Cloud Run; el cliente debe reconectarse (RF-25).
- **Estado:** vigente desde el Hito 7.

### D-25 Reglas del juego fijadas por la especificación
- **Qué:** los barcos no pueden tocarse, ni en diagonal; quien acierta repite turno; empieza quien crea la partida (contra la máquina, el jugador).
- **Por qué:** las fija la especificación del Sprint 2.
- **Estado:** vigente.

### D-26 Estado de la partida como objeto plano y motor inmutable
- **Qué:** el estado de una partida es un objeto plano (`estado`, `turno`, `ganador`, `motivoFin` y, por jugador, `flota` y `disparosRecibidos`), y cada función del motor devuelve un estado nuevo sin modificar el recibido. Los jugadores se identifican como 0 (quien crea la partida) y 1; el servicio de partidas traducirá usuarios y máquina a esos índices. Las casillas se escriben de A1 a J10, con la fila en letra y la columna en número. Los errores reutilizan los códigos `DATOS_INVALIDOS` y `ESTADO_INVALIDO`, que la API ya traduce a 400 y 409. Antes de empezar, un barco colocado se puede retirar para corregir la colocación.
- **Alternativas consideradas:** clases con métodos que cambian el estado (más cercano a la orientación a objetos, pero hay que reconstruir los objetos al leerlos de MongoDB); códigos de error propios del juego (más precisos, pero obligan a tocar la tabla de la API sin cambiar la respuesta).
- **Por qué:** TODO(alumno): ¿por qué objeto plano e inmutable? (pista: guardarlo en MongoDB en el Hito 6 sin conversiones y comparar estados en las pruebas).
- **Estado:** vigente. Evidencia: `server/logic/motor/estado.js`; `test/logic/motor/`.

### D-27 Repositorio público
- **Qué:** el repositorio `jgallud/procesos2627pr` pasa a ser público el 2026-11-08.
- **Por qué:** GitHub bloqueó la ejecución de Actions en la cuenta por un problema de facturación, y sin CI no se puede integrar ningún PR (PRO-02). Los repositorios públicos no consumen minutos de Actions y, además, permiten activar la protección de `main` en GitHub gratuito (apartado 7 de la especificación).
- **Alternativas consideradas:** resolver la facturación y seguir en privado; esperar al siguiente ciclo de facturación.
- **Consecuencias:** cualquiera puede leer el código y su historial. No hay secretos en el repositorio: `.env` nunca se ha subido y los secretos de producción están en Secret Manager ([RNF-02](requisitos.md)). Queda pendiente activar la protección de `main`.
- **Estado:** vigente.

