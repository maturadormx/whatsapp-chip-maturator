# ==========================================================
# WHATSAPP CHIP MATURATOR
# Dockerfile para Railway
# ==========================================================

# ==========================
# BUILD STAGE
# ==========================
FROM node:22-bookworm-slim AS builder

# ==========================================================
# DEBUG
# ==========================================================
RUN echo "==================================================" && \
    echo "USING NEW DOCKERFILE - BUILD STAGE" && \
    echo "==================================================" && \
    node -v && \
    npm -v && \
    cat /etc/os-release

WORKDIR /app

# Atualiza npm
RUN npm install -g npm@10.9.4

# Copia apenas manifests
COPY package.json package-lock.json ./

# Limpa cache do npm
RUN npm cache clean --force

# Instala dependências (incluindo optional)
RUN npm ci --include=optional

# Copia o restante do projeto
COPY . .

# Verificação do Rollup antes do build
RUN node -e "console.log('Rollup:', require.resolve('rollup'))"

# Build
RUN npm run build


# ==========================
# RUNTIME STAGE
# ==========================
FROM node:22-bookworm-slim AS runner

# ==========================================================
# DEBUG
# ==========================================================
RUN echo "==================================================" && \
    echo "USING NEW DOCKERFILE - RUNTIME STAGE" && \
    echo "==================================================" && \
    node -v && \
    npm -v

WORKDIR /app

# Atualiza npm
RUN npm install -g npm@10.9.4

# Copia manifests
COPY package.json package-lock.json ./

# Instala somente produção
RUN npm ci --omit=dev --include=optional

# Copia artefatos necessários
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/scripts ./scripts
COPY --from=builder /app/server ./server
COPY --from=builder /app/shared ./shared
COPY --from=builder /app/drizzle ./drizzle
COPY --from=builder /app/drizzle.config.ts ./drizzle.config.ts

ENV NODE_ENV=production
ENV PORT=3000

EXPOSE 3000

CMD ["npm", "run", "start"]
