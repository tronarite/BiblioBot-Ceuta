FROM node:20-alpine AS build

# Prisma's query/schema engine binaries need real OpenSSL, which Alpine's musl libc
# doesn't provide by default (without this the container crash-loops with
# "Could not parse schema engine response").
RUN apk add --no-cache openssl

WORKDIR /app

COPY package.json ./
RUN npm install

COPY tsconfig.json ./
COPY prisma ./prisma
RUN npx prisma generate

COPY src ./src
RUN npm run build

# Deja solo dependencias de producción (quita typescript, tsx, @types/*, etc.)
RUN npm prune --omit=dev

FROM node:20-alpine AS runtime
RUN apk add --no-cache openssl
WORKDIR /app

ENV NODE_ENV=production
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/prisma ./prisma
COPY package.json ./

EXPOSE 4000

CMD sh -c "npx prisma db push --skip-generate --accept-data-loss && node dist/seed.js && node dist/index.js"
