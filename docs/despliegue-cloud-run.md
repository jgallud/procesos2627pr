# Despliegue continuo en Google Cloud Run

Cada push a `main` ejecuta `.github/workflows/deploy.yml`, que:

1. Se autentica en Google Cloud con una cuenta de servicio.
2. Sube el código y lo construye con Cloud Build usando el `Dockerfile`.
3. Despliega la imagen en el servicio de Cloud Run y comprueba `/api/salud`.

Esta configuración se hace **una sola vez**. Los comandos usan `gcloud`
(también se pueden hacer desde la consola web).

## 1. Proyecto y APIs

```bash
export PROJECT_ID=procesos2627pr-xxxx      # id único que elijas
export REGION=europe-west1
export SERVICE=procesos2627pr

gcloud projects create $PROJECT_ID
gcloud config set project $PROJECT_ID
# Vincular una cuenta de facturación (necesario aunque se use la capa gratuita):
gcloud billing projects link $PROJECT_ID --billing-account=XXXXXX-XXXXXX-XXXXXX

gcloud services enable run.googleapis.com cloudbuild.googleapis.com \
  artifactregistry.googleapis.com iam.googleapis.com
```

> Recomendación: crea un presupuesto con alertas en *Facturación → Presupuestos*
> para que te avise si se supera la capa gratuita.

## 2. Cuenta de servicio para GitHub Actions

```bash
gcloud iam service-accounts create github-deployer \
  --display-name="Despliegue desde GitHub Actions"

SA=github-deployer@$PROJECT_ID.iam.gserviceaccount.com

for ROL in roles/run.admin roles/iam.serviceAccountUser \
           roles/cloudbuild.builds.editor roles/artifactregistry.admin \
           roles/storage.admin roles/serviceusage.serviceUsageConsumer; do
  gcloud projects add-iam-policy-binding $PROJECT_ID \
    --member="serviceAccount:$SA" --role="$ROL"
done

# Genera la clave JSON (NO la subas al repositorio; .gitignore la excluye).
gcloud iam service-accounts keys create gcp-key.json --iam-account=$SA
```

Si tu organización no permite crear claves de cuenta de servicio, la
alternativa es *Workload Identity Federation*; cambia en el workflow
`credentials_json` por `workload_identity_provider` y `service_account`.

## 3. Secretos y variables en GitHub

En el repositorio: *Settings → Secrets and variables → Actions*.

| Tipo     | Nombre              | Valor                                   |
|----------|---------------------|-----------------------------------------|
| Secret   | `GCP_SA_KEY`        | contenido completo de `gcp-key.json`    |
| Variable | `GCP_PROJECT_ID`    | `$PROJECT_ID`                           |
| Variable | `GCP_REGION`        | `europe-west1`                          |
| Variable | `CLOUD_RUN_SERVICE` | `procesos2627pr`                        |
| Variable | `ADMIN_EMAIL`       | email del administrador inicial         |

Después borra `gcp-key.json` de tu disco.

## 4. Primer despliegue

Integra cualquier PR en `main` (o lanza el workflow *Despliegue* a mano desde
la pestaña *Actions*, que tiene `workflow_dispatch`). La URL pública aparece en
el log del paso «Mostrar la URL pública» y en la consola de Cloud Run.

## Notas

- Cloud Run escala a cero: la primera petición tras un rato de inactividad
  tarda unos segundos (arranque en frío). Tenlo en cuenta el día de la prueba.
- Los datos en memoria (Hitos 1-2) se pierden en cada despliegue o cuando la
  instancia se apaga; es lo esperado hasta el Hito 3 (MongoDB Atlas).
- En los Hitos 3-4, los secretos (cadena de MongoDB, claves OAuth y de correo)
  se pasarán al servicio con Secret Manager (`secrets:` en el paso de
  despliegue), nunca en el código.
