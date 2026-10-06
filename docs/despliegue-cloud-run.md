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
7. **Facturación:** basada en solicitudes; **instancias mínimas:** 0.
8. *Contenedores → Variables y secretos*, añade:

   | Variable | Valor |
   |----------|-------|
   | `NODE_ENV` | `production` |
   | `LOG_LEVEL` | `info` |
   | `ADMIN_EMAIL` | email del administrador inicial |

   `PORT` no se define: Cloud Run lo inyecta (8080).
9. **Crear**. El primer despliegue tarda unos minutos; la URL pública aparece
   arriba en la página del servicio.

Las variables se guardan en el servicio y se conservan en cada nuevo despliegue
del activador.

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
- Los datos en memoria (Hitos 1-2) se pierden en cada despliegue o cuando la
  instancia se apaga; es lo esperado hasta el Hito 3 (MongoDB Atlas).
- En los Hitos 3-4, los secretos (cadena de MongoDB, claves OAuth y de correo)
  se guardarán en Secret Manager y se expondrán al servicio como variables
  (*Variables y secretos → Hacer referencia a un secreto*), nunca en el código.
