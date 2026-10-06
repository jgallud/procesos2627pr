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

## Estructura

```
server/          Backend
  index.js       Punto de entrada (configuración + arranque)
  app.js         Construcción de la app Express
  config.js      Lectura de variables de entorno
  logger.js      Registro de actividad (JSON a stdout)
client/          Frontend estático servido por el backend
test/            Pruebas automatizadas (node:test)
docs/            Documentación de despliegue
.github/         Workflows de CI y despliegue
```

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

## Variables de entorno

Ver `.env.example` (solo nombres, sin valores reales):

| Variable | Descripción |
|----------|-------------|
| `PORT` | Puerto HTTP (Cloud Run lo fija automáticamente). |
| `NODE_ENV` | `development`, `production` o `test`. |
| `LOG_LEVEL` | `debug`, `info`, `warn`, `error` o `silent`. |

## Flujo de trabajo (GitHub Flow)

1. Crear una rama por cambio: `git switch -c feature/<descripcion>`.
2. Programar y ejecutar `npm test` en local.
3. `git push -u origin feature/<descripcion>` y abrir un pull request contra `main`.
4. Esperar el CI en verde e integrar el PR (*Create a merge commit*).
5. El push a `main` dispara el despliegue automático en Cloud Run.

Al cerrar cada hito se etiqueta el último commit de `main` (`hito-1`, `hito-2`…).

## Despliegue

Ver [docs/despliegue-cloud-run.md](docs/despliegue-cloud-run.md).
