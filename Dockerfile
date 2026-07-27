FROM node:20-slim

WORKDIR /app

RUN npm install -g npm@10.9.4

COPY package*.json ./

RUN npm ci --include=optional

COPY . .

RUN npm run build

EXPOSE 3000

CMD ["npm", "start"]
