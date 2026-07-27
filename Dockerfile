# Use a imagem base oficial do Node
FROM node:20-slim

# Define o diretório de trabalho
WORKDIR /app

# Copia os arquivos de manifesto
COPY package*.json ./
COPY pnpm-lock.yaml ./

# --> MUDANÇA 1: Instala e FIXA a versão do NPM
RUN npm install -g npm@10.9.4

# --> MUDANÇA 2: Instala as dependências incluindo as opcionais
# O --include=optional garante que o Rollup tente baixar os binários para o Linux
RUN npm ci --include=optional

# Copia o resto do código
COPY . .

# Executa o build
RUN npm run build

# Expõe a porta (se for uma aplicação web)
EXPOSE 3000

# Comando para iniciar a aplicação
CMD ["npm", "start"]
