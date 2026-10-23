# Ribbonmere — one small container: Node serves the site and the API, SQLite lives in /data.
FROM node:22-slim AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:22-slim
WORKDIR /app
ENV NODE_ENV=production PORT=8787 DATA_DIR=/data
COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY --from=build /app/dist ./dist
COPY server ./server
COPY shared ./shared
VOLUME ["/data"]
EXPOSE 8787
CMD ["npx", "tsx", "server/index.ts"]
