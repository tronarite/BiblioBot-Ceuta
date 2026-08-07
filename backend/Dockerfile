FROM node:20-alpine AS base

WORKDIR /app

COPY package.json ./
RUN npm install

COPY tsconfig.json ./
COPY prisma ./prisma
RUN npx prisma generate

COPY src ./src
RUN npm run build

ENV NODE_ENV=production
EXPOSE 4000

CMD sh -c "npx prisma db push --skip-generate --accept-data-loss && node dist/seed.js && node dist/index.js"
