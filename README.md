# procesos2627pr

Procesos de Ingeniería del Software — curso 2026-2027.
Aplicación SaaS con arquitectura en capas y gestión de usuarios.

- **URL pública:** _(se añadirá tras el primer despliegue)_
- **Integración continua:** pestaña *Actions* → workflow **CI**
- **Despliegue continuo:** pestaña *Actions* → workflow **Despliegue**

## Tecnologías

| Tecnología | Justificación |
|------------|---------------|
| Node.js 22 | Un único lenguaje (JavaScript) en cliente y servidor, con runner de pruebas y carga de `.env` integrados. |
| Express 5 | Framework HTTP mínimo y muy extendido; permite que el mismo servidor sirva la API y el frontend (mismo origen). |
| HTML + CSS + JavaScript sin framework | El frontend es pequeño; sin framework se ve claramente la separación entre interfaz y cliente de comunicación. |
| `node:test` | Runner de pruebas incluido en Node: pruebas automatizadas sin dependencias adicionales. |
| GitHub Actions | CI integrado en el propio repositorio, se ejecuta en cada PR y en cada cambio en `main`. |
| Google Cloud Run | Contenedores con capa gratuita, escalado a cero y URL pública HTTPS; se despliega desde GitHub Actions. |
| MongoDB Atlas (Hito 3) | Cluster M0 gratuito y permanente; el modelo de documentos encaja con los objetos de usuario en JavaScript. |

## Arquitectura en capas

```
 Cliente (navegador)            client/            interfaz servida por el backend
        │  HTTP/JSON, mismo origen
        ▼
 Capa API                       server/app.js, server/api/
        │  llamadas a funciones (sin HTTP)
        ▼
 Capa de lógica de negocio      server/logic/
        │  contrato del repositorio (async)
        ▼
 Capa de acceso a datos         server/data/       memoria (Hito 1) → MongoDB (Hito 3)
```

- **Frontera API ↔ lógica:** `server/api/usuariosRouter.js` llama a `servicioUsuarios`.
  La API no contiene reglas de negocio y la lógica no conoce HTTP: lanza
  `ErrorDominio` con un código y `server/api/errores.js` lo traduce a un estado HTTP.
- **Frontera lógica ↔ datos:** `server/logic/usuarioService.js` recibe un
  `repositorio` que cumple el contrato descrito en `server/data/usuarioRepositorioMemoria.js`.
- **Composición:** `server/index.js` crea repositorio → servicio → app. Sustituir
  la base de datos solo cambia qué repositorio se crea ahí.

```
server/
  index.js                      Punto de entrada y composición de capas
  app.js                        App Express: API bajo /api + frontend estático
  config.js                     Lectura de variables de entorno
  logger.js                     Registro de actividad (JSON a stdout)
  api/                          CAPA API
    usuariosRouter.js           Endpoints REST de usuarios
    errores.js                  ErrorDominio → código HTTP
    solicitante.js              Identificación del solicitante (provisional)
  logic/                        CAPA LÓGICA
    usuarioService.js           Reglas de gestión de usuarios
    errores.js                  Errores de dominio
  data/                         CAPA DE DATOS
    usuarioRepositorioMemoria.js
client/                         Frontend
test/                           Pruebas automatizadas (node:test)
  logic/  data/  api/
docs/                           Documentación de despliegue
.github/workflows/              CI y despliegue continuo
```

## Modelo de usuario y reglas

- `rol`: `usuario` o `administrador`.
- `estado`: `pendiente` (no ha confirmado el correo), `activo` o `eliminado`.
- Un usuario está **activo** si ha confirmado su cuenta (o entró por OAuth) y no ha sido eliminado.
- La eliminación es lógica: el usuario sigue en el listado con estado `eliminado` y no puede volver a operar.
- Listar usuarios y consultar si un usuario está activo: solo administrador.
- Eliminar: el administrador a cualquiera; un usuario normal solo a sí mismo.
- Todas estas comprobaciones se hacen en la capa lógica del servidor.

## API

| Método | Ruta | Quién | Respuesta |
|--------|------|-------|-----------|
| `GET` | `/api/salud` | cualquiera | `200 {estado:"ok"}` |
| `POST` | `/api/usuarios` | cualquiera | `201` usuario creado (`pendiente`) |
| `GET` | `/api/usuarios` | administrador | `200` lista de usuarios |
| `GET` | `/api/usuarios/:id/activo` | administrador | `200 {id, activo}` |
| `DELETE` | `/api/usuarios/:id` | administrador o el propio usuario | `204` |

Errores: `400` datos inválidos, `401` sin sesión válida, `403` sin permiso,
`404` no existe, `409` email duplicado. Siempre en JSON: `{error, codigo}`.

> **Hito 1 (provisional):** todavía no hay sesiones. El solicitante se indica con
> la cabecera `X-Usuario-Id` y la lógica verifica que existe, está activo y tiene
> el rol necesario. En el Hito 2 se sustituye por la sesión sin cambiar rutas ni lógica.

## Administrador inicial

Al arrancar, el servidor crea (o promueve, si ya existe) una cuenta de
administrador activa con el email de la variable `ADMIN_EMAIL`. Se eligió así
porque no requiere tocar la base de datos a mano, es idempotente y el email del
administrador queda fuera del código. Las credenciales de prueba para la
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

## Ejecutar las pruebas

```bash
npm test
```

Ejecuta con `node:test` todas las pruebas de `test/`: unitarias de la capa
lógica (`test/logic`), del contrato del repositorio (`test/data`) y de
integración de la API con peticiones HTTP reales (`test/api`).

## Variables de entorno

Ver `.env.example` (solo nombres, sin valores reales):

| Variable | Descripción |
|----------|-------------|
| `PORT` | Puerto HTTP (Cloud Run lo fija automáticamente). |
| `NODE_ENV` | `development`, `production` o `test`. |
| `LOG_LEVEL` | `debug`, `info`, `warn`, `error` o `silent`. |
| `ADMIN_EMAIL` | Email del administrador inicial. |

## Flujo de trabajo (GitHub Flow)

1. Crear una rama por cambio: `git switch -c feature/<descripcion>`.
2. Programar y ejecutar `npm test` en local.
3. `git push -u origin feature/<descripcion>` y abrir un pull request contra `main`.
4. Esperar el CI en verde e integrar el PR (*Create a merge commit*).
5. El push a `main` dispara el despliegue automático en Cloud Run.

Al cerrar cada hito se etiqueta el último commit de `main` (`hito-1`, `hito-2`…).

## Despliegue

Ver [docs/despliegue-cloud-run.md](docs/despliegue-cloud-run.md).
