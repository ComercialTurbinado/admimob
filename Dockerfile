# API + server (better-sqlite3 e playwright-core precisam de ferramentas de build)
FROM node:20-bookworm-slim

RUN apt-get update -y && apt-get install -y --no-install-recommends \
    python3 make g++ \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY server ./server
COPY railpack.json ./

ENV NODE_ENV=production
EXPOSE 3333

CMD ["node", "server/index.js"]
