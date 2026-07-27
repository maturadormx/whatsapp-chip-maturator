# ==========================
# BUILD STAGE
# ==========================
FROM node:22-bookworm-slim AS builder

# DEBUG
RUN echo "===================================" \
 && echo "USING NEW DOCKERFILE" \
 && echo "===================================" \
 && node -v \
 && npm -v

WORKDIR /app

# Atualiza o npm
RUN npm install -g npm@10.9.4

# Copia apenas manifests primeiro
COPY package*.json ./

# Instala dependências
RUN npm ci --include=optional

# Copia o restante do projeto
COPY . .

# Build da aplicação
RUN npm run build


# ==========================
# RUNTIME STAGE
# ==========================
FROM node:22-bookworm-slim

# DEBUG
RUN node -v && npm -v

WORKDIR /app

# Atualiza o npm
RUN npm install -g npm@10.9.4

# Copia manifests
COPY package*.json ./

# Instala apenas dependências de produção
RUN npm ci --omit=dev --include=optional

# Copia somente o necessário
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/scripts ./scripts

ENV NODE_ENV=production

EXPOSE 3000

CMD ["npm", "run", "start"]
