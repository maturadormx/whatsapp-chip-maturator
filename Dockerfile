FROM node:20-slim

WORKDIR /app

# Instala o pnpm globalmente
RUN npm install -g pnpm@10.18.0

# Copia os arquivos de lock
COPY package*.json ./
COPY pnpm-lock.yaml ./

# Instala com pnpm
RUN pnpm install --frozen-lockfile

COPY . .

RUN pnpm run build

EXPOSE 3000

CMD ["pnpm", "start"]
