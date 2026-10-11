# Proyecto de Procesos de Ingeniería del Software

Procesos de Ingeniería del Software — curso 2026-2027.
Escuela Superior de Ingeniería Informática de Albacete
Universidad de Castilla-La Mancha
Aplicación SaaS con arquitectura en capas y gestión de usuarios.

- **URL pública:** _(se añadirá tras el primer despliegue)_
- **Integración continua:** pestaña *Actions* → workflow **CI**
- **Despliegue continuo:** Cloud Run conectado al repositorio (activador de Cloud Build sobre `main`)

## Tecnologías

| Tecnología | Justificación |
|------------|---------------|
| Node.js 22 | Un único lenguaje (JavaScript) en cliente y servidor, con runner de pruebas y carga de `.env` integrados. |
| Express 5 | Framework HTTP mínimo y muy extendido; permite que el mismo servidor sirva la API y el frontend (mismo origen). |
| HTML + CSS + JavaScript sin framework (módulos ES) | El frontend es pequeño; sin framework se ve claramente la separación entre interfaz (`interfaz.js`) y cliente de comunicación (`api.js`). |
| `scrypt` de `node:crypto` | Función de hash para contraseñas (lenta, con sal y coste de memoria, recomendada por OWASP) incluida en Node: sin dependencias nativas. |
| Sesiones en servidor con cookie `HttpOnly` | Cerrar sesión invalida de verdad el estado (se borra en el servidor) y el JavaScript de la página no puede leer el identificador; el almacén de sesiones es un repositorio más y, desde el Hito 3, vive en MongoDB. |
| `node:test` | Runner de pruebas incluido en Node: pruebas automatizadas sin dependencias adicionales. |
| GitHub Actions | CI integrado en el propio repositorio, se ejecuta en cada PR y en cada cambio en `main`. |
| Google Cloud Run + Cloud Build | Contenedores con capa gratuita (créditos de educación), escalado a cero y URL pública HTTPS; la integración con GitHub despliega cada cambio en `main` sin claves que custodiar. |
| MongoDB Atlas + driver oficial `mongodb` (Hito 3) | Cluster M0 gratuito y permanente; el modelo de documentos encaja con los objetos de usuario en JavaScript. Se usa el driver oficial sin ODM (Mongoose): los repositorios ya definen el contrato y la validación está en la capa lógica, así que un esquema adicional duplicaría reglas. |

## Arquitectura en capas

```
 Cliente (navegador)            client/
   Capa de presentación         client/js/interfaz.js   (DOM, formularios, mensajes)
        │  llamadas a funciones
   Capa de comunicación         client/js/api.js        (único módulo con fetch)
        │  HTTP/JSON, mismo origen, cookie de sesión
        ▼
 Capa API                       server/app.js, server/api/
        │  llamadas a funciones (sin HTTP)
        ▼
 Capa de lógica de negocio      server/logic/
        │  contrato del repositorio (async)
        ▼
 Capa de acceso a datos         server/data/       MongoDB (producción) o memoria (desarrollo/pruebas)
```

- **Frontera interfaz ↔ comunicación (cliente):** `client/js/interfaz.js` solo
  importa funciones de `client/js/api.js`; no contiene `fetch` ni URLs de la API.

- **Frontera API ↔ lógica:** `server/api/usuariosRouter.js` y `server/api/sesion.js`
  llaman a `servicioUsuarios` y `servicioSesiones`.
  La API no contiene reglas de negocio y la lógica no conoce HTTP: lanza
  `ErrorDominio` con un código y `server/api/errores.js` lo traduce a un estado HTTP.
- **Frontera lógica ↔ datos:** los servicios de `server/logic/` reciben
  repositorios que cumplen los contratos descritos en `server/data/usuarioRepositorioMemoria.js`
  y `server/data/sesionRepositorioMemoria.js`. Hay dos implementaciones de cada
  contrato (memoria y MongoDB) y las dos superan la misma batería de pruebas
  (`test/contratos/`).
- **Composición:** `server/index.js` crea repositorios → servicios → app. Si
  existe `MONGODB_URI` usa los repositorios de MongoDB; si no, los de memoria
  (en producción, sin `MONGODB_URI` el servidor no arranca). El paso a MongoDB
  en el Hito 3 no modificó ningún archivo de `server/logic/` ni de `server/api/`.

```
server/
  index.js                      Punto de entrada y composición de capas
  app.js                        App Express: API bajo /api + frontend estático
  config.js                     Lectura de variables de entorno
  logger.js                     Registro de actividad (JSON a stdout)
  api/                          CAPA API
    usuariosRouter.js           Endpoints REST de usuarios
    sesion.js                   Cookie de sesión y endpoints /api/sesion
    errores.js                  ErrorDominio → código HTTP
  logic/                        CAPA LÓGICA
    usuarioService.js           Reglas de gestión de usuarios (registro, login, roles…)
    sesionService.js            Ciclo de vida de las sesiones
    contrasenas.js              Hash de contraseñas (scrypt)
    errores.js                  Errores de dominio
  data/                         CAPA DE DATOS
    conexionMongo.js            Conexión, índices y cierre ordenado
    usuarioRepositorioMongo.js  Usuarios en MongoDB (producción)
    sesionRepositorioMongo.js   Sesiones en MongoDB (producción)
    usuarioRepositorioMemoria.js  Usuarios en memoria (desarrollo y pruebas)
    sesionRepositorioMemoria.js   Sesiones en memoria (desarrollo y pruebas)
  notificacion/
    notificadorLog.js           Enlace de confirmación al log (provisional, Hito 4: correo)
client/                         Frontend
  index.html, css/
  js/interfaz.js                Capa de presentación
  js/api.js                     Capa de comunicación con el servidor
test/                           Pruebas automatizadas (node:test)
  logic/  data/  api/  notificacion/  ayuda/
  contratos/                    Pruebas comunes a todas las implementaciones de repositorio
docs/                           Documentación de despliegue
.github/workflows/              Integración continua (CI)
```

## Modelo de usuario y reglas

- `rol`: `usuario` o `administrador`.
- `estado`: `pendiente` (no ha confirmado el correo), `activo` o `eliminado`.
- Un usuario está **activo** si ha confirmado su cuenta (o entró por OAuth) y no ha sido eliminado.
- La eliminación es lógica: el usuario sigue en el listado con estado `eliminado` y no puede volver a operar.
- Listar usuarios y consultar si un usuario está activo: solo administrador.
- Eliminar: el administrador a cualquiera; un usuario normal solo a sí mismo.
- Todas estas comprobaciones se hacen en la capa lógica del servidor.

## Persistencia (MongoDB)

Base de datos `MONGODB_DB` (por defecto `procesos2627pr`) con dos colecciones:

| Colección | Documento | Índices |
|-----------|-----------|---------|
| `usuarios` | `{ _id, email, nombre, rol, estado, origen, creadoEn, eliminadoEn?, hashContrasena?, hashTokenConfirmacion? }` | `email` único |
| `sesiones` | `{ _id, idUsuario, creadaEn, expiraEn, caducidad }` | `idUsuario`; TTL sobre `caducidad` |

- El `_id` de cada usuario es un UUID generado por el repositorio; fuera de la
  capa de datos solo existe como `id`, igual que con la implementación en memoria.
- El índice único de `email` garantiza en la propia base de datos que no hay
  dos cuentas con el mismo correo, incluso ante dos altas simultáneas.
- Las sesiones también se guardan en la base de datos: un nuevo despliegue o un
  reinicio no cierra la sesión de nadie y Cloud Run puede usar varias instancias.
  El índice TTL hace que MongoDB borre solo las sesiones caducadas.
- Los índices se crean al arrancar (`createIndex` es idempotente).
- Al recibir `SIGTERM` (Cloud Run apaga la instancia) el servidor deja de
  aceptar peticiones, termina las que hay en curso y cierra la conexión.

## Registro, sesión y contraseñas

- **Registro local:** email, nombre (opcional) y contraseña (mínimo 8 caracteres).
  La cuenta queda `pendiente` y no puede iniciar sesión hasta confirmarla.
- **Contraseñas:** se guardan con `scrypt` (sal aleatoria por usuario, parámetros
  dentro del propio hash) y se comparan en tiempo constante. Nunca se guardan,
  devuelven ni registran en claro.
- **Confirmación:** al registrarse se genera un token de un solo uso (del que solo
  se guarda su SHA-256). El enlace es `APP_URL/?confirmar=<token>`; al abrirlo,
  la interfaz llama a `POST /api/usuarios/confirmacion`.
  > **Hito 2 (provisional):** aún no se envía correo; el enlace se escribe en el
  > log del servidor (terminal en local, Cloud Logging en Cloud Run). En el Hito 4
  > se sustituye el notificador por uno que envía el correo, sin tocar la lógica.
- **Inicio de sesión:** si las credenciales son correctas, el servidor crea una
  sesión con un identificador aleatorio de 256 bits y lo envía en la cookie
  `sesion` (`HttpOnly`, `SameSite=Lax`, `Max-Age`, y `Secure` en producción).
  Un email inexistente y una contraseña incorrecta dan el mismo error.
- **Mantenimiento entre recargas:** al cargar la página, la interfaz pide
  `GET /api/sesion`; el navegador envía la cookie automáticamente.
- **Cierre de sesión:** `DELETE /api/sesion` borra la sesión del almacén del
  servidor y la cookie; reutilizar la cookie antigua da `401`.
- **Rutas protegidas:** el middleware de sesión fija `req.idSolicitante` y la capa
  lógica rechaza con `401` si no hay sesión válida (o el usuario ya no está activo)
  y con `403` si falta el rol de administrador. Al eliminar una cuenta se cierran
  todas sus sesiones.

## API

| Método | Ruta | Quién | Respuesta |
|--------|------|-------|-----------|
| `GET` | `/api/salud` | cualquiera | `200 {estado:"ok"}` |
| `POST` | `/api/sesion` | cualquiera (`{email, contrasena}`) | `200` usuario + cookie de sesión |
| `GET` | `/api/sesion` | con sesión | `200` usuario de la sesión |
| `DELETE` | `/api/sesion` | cualquiera | `204` sesión cerrada |
| `POST` | `/api/usuarios` | cualquiera (`{email, nombre?, contrasena}`) | `201` usuario creado (`pendiente`) |
| `POST` | `/api/usuarios/confirmacion` | cualquiera (`{token}`) | `200` usuario `activo` |
| `GET` | `/api/usuarios` | administrador | `200` lista de usuarios |
| `GET` | `/api/usuarios/:id/activo` | administrador | `200 {id, activo}` |
| `DELETE` | `/api/usuarios/:id` | administrador o el propio usuario | `204` |

Errores: `400` datos o token inválidos, `401` sin sesión válida o credenciales
incorrectas, `403` sin permiso o cuenta pendiente/eliminada, `404` no existe,
`409` email duplicado. Siempre en JSON: `{error, codigo}`.

El solicitante se identifica por la cookie de sesión (en el Hito 1 era una
cabecera provisional `X-Usuario-Id`, que ya no se acepta). El cambio no afectó
a las rutas de usuarios ni a la capa lógica: ambas siguen usando `req.idSolicitante`.

## Administrador inicial

Al arrancar, el servidor crea (o promueve, si ya existe) una cuenta de
administrador activa con el email de `ADMIN_EMAIL` y la contraseña de
`ADMIN_PASSWORD` (si cambia la variable, cambia la contraseña en el siguiente
arranque). Se eligió así porque no requiere tocar la base de datos a mano, es
idempotente y ni el email ni la contraseña del administrador están en el código.
Para entrar como administrador basta con iniciar sesión con esas credenciales. Las credenciales de prueba para la
revisión se envían con la entrega, no en el repositorio.

## Ejecutar en local

Requisitos: Node.js 22 o superior.

```bash
npm install
cp .env.example .env     # y ajusta los valores
npm run dev              # http://localhost:3000 (recarga al guardar)
# o bien
npm start
```

Para probar el registro en local: crea una cuenta desde la interfaz y copia el
enlace de confirmación que aparece en la terminal (`"enlace":"http://localhost:3000/?confirmar=…"`).

## Ejecutar las pruebas

```bash
npm test
```

Ejecuta con `node:test` todas las pruebas de `test/`: unitarias de la capa
lógica (`test/logic`: usuarios, sesiones y hash de contraseñas), de los contratos
de los repositorios (`test/data`, con la batería común de `test/contratos`) y de
integración de la API con peticiones HTTP reales y cookie de sesión (`test/api`).

Las pruebas de la capa lógica usan siempre los repositorios en memoria: son
rápidas y no necesitan base de datos. Las pruebas de los repositorios de MongoDB
y la de persistencia tras un reinicio (`test/api/persistencia.test.js`) solo se
ejecutan si se define `MONGODB_URI_TEST`; si no, aparecen como omitidas
(*skipped*). Cada ejecución crea una base de datos temporal `pruebas_<aleatorio>`
y la borra al terminar. En el CI, GitHub Actions levanta un contenedor de MongoDB
y define `MONGODB_URI_TEST=mongodb://localhost:27017`, sin usar Atlas ni secretos.

```bash
# con un MongoDB local (por ejemplo, docker run -p 27017:27017 mongo:8)
MONGODB_URI_TEST=mongodb://localhost:27017 npm test
```

## Variables de entorno

Ver `.env.example` (solo nombres, sin valores reales):

| Variable | Descripción |
|----------|-------------|
| `PORT` | Puerto HTTP (Cloud Run lo fija automáticamente). |
| `NODE_ENV` | `development`, `production` o `test`. |
| `MONGODB_URI` | Cadena de conexión de MongoDB Atlas (secreto: incluye usuario y contraseña). Obligatoria en producción; sin ella, en desarrollo los datos se guardan en memoria. |
| `MONGODB_DB` | Nombre de la base de datos (por defecto `procesos2627pr`). |
| `LOG_LEVEL` | `debug`, `info`, `warn`, `error` o `silent`. |
| `ADMIN_EMAIL` | Email del administrador inicial. |
| `ADMIN_PASSWORD` | Contraseña del administrador inicial (secreto, mínimo 8 caracteres). |
| `APP_URL` | URL pública de la aplicación, para el enlace de confirmación (por defecto `http://localhost:PORT`). |
| `SESION_HORAS` | Duración de la sesión en horas (por defecto 168, una semana). |

## Flujo de trabajo (GitHub Flow)

1. Crear una rama por cambio: `git switch -c feature/<descripcion>`.
2. Programar y ejecutar `npm test` en local.
3. `git push -u origin feature/<descripcion>` y abrir un pull request contra `main`.
4. Esperar el CI en verde e integrar el PR (*Create a merge commit*).
5. El cambio en `main` dispara el activador de Cloud Build, que construye la imagen con el `Dockerfile` y la despliega en Cloud Run.

Al cerrar cada hito se etiqueta el último commit de `main` (`hito-1`, `hito-2`…).

## Despliegue

Ver [docs/despliegue-cloud-run.md](docs/despliegue-cloud-run.md).
