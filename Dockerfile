# Imagen de producción para Cloud Run.
FROM node:22-alpine

ENV NODE_ENV=production
WORKDIR /app

# Primero solo los manifiestos para aprovechar la caché de capas.
COPY package*.json ./
RUN if [ -f package-lock.json ]; then npm ci --omit=dev; else npm install --omit=dev; fi \
    && npm cache clean --force

COPY server ./server
COPY client ./client

# Cloud Run inyecta PORT (8080 por defecto).
ENV PORT=8080
EXPOSE 8080

USER node
CMD ["node", "server/index.js"]
