FROM node:22-bookworm-slim AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci --include=optional

COPY . .

RUN npm run build

FROM node:22-bookworm-slim

WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev --include=optional

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/scripts ./scripts

ENV NODE_ENV=production

EXPOSE 3000

CMD ["npm","run","start"]
