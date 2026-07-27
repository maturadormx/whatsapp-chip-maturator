# ---------- BUILD ----------
FROM node:22-bookworm-slim AS builder

WORKDIR /app

# Atualiza o npm
RUN npm install -g npm@10.9.4

# Copia apenas os manifests primeiro
COPY package*.json ./

# Instala TODAS as dependências
RUN npm ci

# Instala explicitamente o binário Linux do Rollup
RUN npm install @rollup/rollup-linux-x64-gnu@4.62.2 --no-save

# Copia o restante do projeto
COPY . .

# Build
RUN npm run build


# ---------- RUNTIME ----------
FROM node:22-bookworm-slim

WORKDIR /app

RUN npm install -g npm@10.9.4

COPY package*.json ./

# Apenas dependências de produção
RUN npm ci --omit=dev

# Copia o build
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/scripts ./scripts

ENV NODE_ENV=production

EXPOSE 3000

CMD ["npm", "run", "start"]
