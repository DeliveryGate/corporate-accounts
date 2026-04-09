FROM node:18-alpine
RUN apk add --no-cache openssl
WORKDIR /app
COPY package*.json ./
RUN npm install --production
COPY web/package*.json ./web/
COPY prisma ./prisma
COPY . .
RUN cd web && rm -rf node_modules && npm install --production && ./node_modules/.bin/prisma generate --schema=../prisma/schema.prisma
EXPOSE 3000
CMD cd web && node index.js
