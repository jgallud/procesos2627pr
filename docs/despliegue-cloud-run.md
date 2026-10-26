# Despliegue continuo en Google Cloud Run

El despliegue continuo usa la **integración de Cloud Run con el repositorio
de GitHub**: un activador (*trigger*) de Cloud Build vigila la rama `main` y,
en cada cambio:

1. Descarga el código del commit.
2. Construye la imagen con el `Dockerfile` de la raíz.
3. La sube a Artifact Registry y despliega una nueva revisión en Cloud Run.

No hay ningún paso manual por cambio ni claves de cuenta de servicio en
GitHub: la conexión se autoriza mediante la app de GitHub de Cloud Build.
La integración continua (pruebas) sigue en GitHub Actions (`.github/workflows/ci.yml`);
ambos funcionan de forma independiente, como permite la especificación.

La configuración se hace **una sola vez** desde la consola de Google Cloud.

## 1. Proyecto y facturación

1. Crea un proyecto en la consola (o usa el que te asignen).
2. *Facturación* → vincula el proyecto a la cuenta de facturación de los
   **créditos de educación**.
3. *Facturación → Presupuestos y alertas* → crea un presupuesto pequeño con
   alertas al 50 %, 90 % y 100 %.

## 2. Crear el servicio conectado al repositorio

*Cloud Run → Implementar contenedor → Servicio* (o *Conectar repositorio*):

1. Elige **Implementar continuamente desde un repositorio (GitHub)** →
   **Configurar con Cloud Build**. Si lo pide, activa las APIs de Cloud Build
   y Artifact Registry.
2. **Proveedor:** GitHub → autentícate e instala la app *Google Cloud Build*
   solo en el repositorio `procesos2627pr`.
3. **Rama:** `^main$`.
4. **Tipo de compilación:** *Dockerfile*, ubicación `/Dockerfile`.
5. **Nombre del servicio:** `procesos2627pr`; **región:** `europe-west1`.
6. **Autenticación:** *Permitir acceso público* (sin autenticación).
7. **Facturación:** basada en solicitudes; **instancias mínimas:** 0;
   **instancias máximas:** desde el Hito 3 puede ser más de 1, porque usuarios y
   sesiones están en MongoDB y todas las instancias los comparten (con 2-3 basta;
   el cluster M0 de Atlas admite unas 500 conexiones).
8. *Contenedores → Variables y secretos*, añade:

   | Variable | Valor |
   |----------|-------|
   | `NODE_ENV` | `production` |
   | `MONGODB_URI` | cadena de conexión de Atlas (secreto, ver sección 2b) |
   | `MONGODB_DB` | `procesos2627pr` |
   | `LOG_LEVEL` | `info` |
   | `ADMIN_EMAIL` | email del administrador inicial |
   | `ADMIN_PASSWORD` | contraseña del administrador inicial (mejor como secreto, ver abajo) |
   | `APP_URL` | URL pública del servicio, p. ej. `https://procesos2627pr-xxxx.europe-west1.run.app` (**obligatoria**: sin ella el servidor no arranca en producción) |
   | `BREVO_API_KEY` | clave del API de Brevo (secreto, ver sección 2c) |
   | `CORREO_REMITENTE` | dirección remitente verificada en Brevo |
   | `CORREO_REMITENTE_NOMBRE` | nombre del remitente (opcional) |

   `PORT` no se define: Cloud Run lo inyecta (8080).
9. **Crear**. El primer despliegue tarda unos minutos; la URL pública aparece
   arriba en la página del servicio.

Las variables se guardan en el servicio y se conservan en cada nuevo despliegue
del activador.

## 2b. Base de datos: MongoDB Atlas (Hito 3)

1. **Cluster:** en Atlas, un cluster **M0** (gratuito), preferiblemente en una
   región europea cercana a `europe-west1` (p. ej. GCP Bélgica).
2. **Database Access:** un usuario de base de datos con el rol
   *Read and write to any database* y una contraseña generada.
3. **Network Access:** añade `0.0.0.0/0` (*Allow access from anywhere*). Cloud Run
   no tiene una IP de salida fija en la capa gratuita; la protección está en el
   usuario y la contraseña de la cadena de conexión, y la conexión siempre va
   cifrada (TLS).
4. **Cadena de conexión:** *Connect → Drivers → Node.js*. Tiene la forma
   `mongodb+srv://<usuario>:<contraseña>@<cluster>.mongodb.net/`.
5. **Guardarla como secreto:** *Secret Manager → Crear secreto* `mongodb-uri`
   con la cadena como valor. En el servicio de Cloud Run: *Editar e implementar
   nueva revisión → Variables y secretos → Hacer referencia a un secreto* →
   expónlo como variable de entorno `MONGODB_URI` (versión `latest`). La cuenta
   de servicio de Cloud Run necesita el rol *Descriptor de acceso a secretos de
   Secret Manager* sobre ese secreto (la consola ofrece concederlo).
6. Añade también `MONGODB_DB=procesos2627pr` como variable normal.

Al arrancar, en *Registros* debe aparecer `Conectado a MongoDB` con el host del
cluster (nunca se registra la cadena completa). Si falta `MONGODB_URI` con
`NODE_ENV=production`, el servidor no arranca y el registro lo indica: así no se
puede quedar en producción, sin darse cuenta, con datos en memoria.

**Comprobar la persistencia:** crea un usuario, inicia sesión y despliega una
nueva revisión (o integra cualquier cambio en `main`). Tras el despliegue el
usuario sigue existiendo y la sesión sigue abierta. En Atlas, *Browse
Collections* muestra las colecciones `usuarios` y `sesiones`.

## 2c. Correo de confirmación: Brevo (Hito 4)

1. **Cuenta:** crea una cuenta gratuita en Brevo.
2. **Remitente:** en *Senders, domains & dedicated IPs* añade y verifica la
   dirección remitente (o, mejor, un dominio propio con sus registros DNS:
   así es menos probable que el correo llegue a spam).
3. **Clave de API:** en *SMTP & API → API keys* genera una clave. Solo se ve
   una vez: cópiala directamente al secreto del paso siguiente, no la guardes
   en ningún archivo del repositorio.
4. **Guardarla como secreto:** *Secret Manager → Crear secreto* `brevo-api-key`
   y expónlo en Cloud Run como variable `BREVO_API_KEY` (igual que `mongodb-uri`
   en la sección 2b).
5. Añade `CORREO_REMITENTE` (la dirección verificada) y, si quieres,
   `CORREO_REMITENTE_NOMBRE` como variables normales.

Al arrancar, en *Registros* debe aparecer `Correo de confirmación con Brevo`.
Si aparece en cambio el aviso `BREVO_API_KEY no está definida`, el secreto no
está llegando al servicio. Si Brevo rechaza un envío, el registro de la
aplicación muestra `Brevo rechazó el correo de confirmación` con el código de
estado y el motivo que da Brevo (por ejemplo, remitente sin verificar o
dirección IP no autorizada en la configuración de seguridad de la cuenta).

## 3. Comprobar el despliegue continuo

- *Cloud Build → Activadores*: aparece el activador sobre `^main$`.
- *Cloud Build → Historial*: una compilación por cada cambio integrado en `main`.
- En GitHub, cada commit de `main` muestra el resultado de Cloud Build junto al del CI.
- `https://<url-del-servicio>/api/salud` debe responder `{"estado":"ok"}`.

## Si la cuenta es institucional

Si *Permitir acceso público* falla con un error de dominio no permitido
(política `iam.allowedPolicyMemberDomains` de la organización), en *Seguridad*
del servicio desactiva **Usar IAM para autenticar las solicitudes entrantes**
(equivale a `--no-invoker-iam-check`). Si también está bloqueado, hay que pedir
una excepción al administrador de Google Cloud de la organización.

## Notas

- Cloud Run escala a cero: la primera petición tras un rato de inactividad
  tarda unos segundos (arranque en frío). Tenlo en cuenta el día de la prueba.
- Desde el Hito 3 los datos están en MongoDB Atlas y sobreviven a despliegues y
  reinicios. Con el servidor en local y sin `MONGODB_URI`, se siguen usando los
  repositorios en memoria (solo para desarrollo).
- `ADMIN_PASSWORD` y `MONGODB_URI` son secretos: se crean en Secret Manager y se
  exponen al servicio como variables (*Variables y secretos → Hacer referencia a
  un secreto*), nunca en el código. Igual con `BREVO_API_KEY` (sección 2c) y,
  más adelante, con las claves de OAuth.
- Si la contraseña del usuario de Atlas cambia, basta con añadir una versión
  nueva al secreto `mongodb-uri` y desplegar una revisión nueva.
- Sin `BREVO_API_KEY`, el enlace de confirmación no se envía por correo: se
  consulta en *Cloud Run → servicio → Registros* buscando
  `Enlace de confirmación de cuenta`.
- `APP_URL` es obligatoria en producción: si falta o no empieza por `https://`, el
  servidor no arranca y el registro lo indica (Cloud Run sigue sirviendo la
  revisión anterior). La URL de Cloud Run tiene la forma
  `https://<servicio>-<número de proyecto>.<región>.run.app`, así que se puede
  definir antes del primer despliegue. La de este proyecto está en el README.