# syntax=docker/dockerfile:1
# Backend listaCompra — Node 20 + Express + Prisma (PostgreSQL)
# Build: multi-stage. El runtime NO necesita tooling de compilación.

FROM node:20-alpine AS builder
WORKDIR /app

# bcrypt es nativo: hace falta toolchain solo en esta fase
RUN apk add --no-cache python3 make g++

COPY package.json package-lock.json ./
RUN npm ci

COPY tsconfig.json ./
COPY prisma ./prisma
COPY src ./src

# Cliente Prisma + compilación TypeScript
RUN npx prisma generate
RUN npm run build

# El código usa alias @/ (@infrastructure/...) y `tsc` NO los reescribe:
# sin esto, `node dist/main.js` fallaría con "Cannot find module".
# tsc-alias reescribe los require() de dist/ a rutas relativas.
RUN npx -y tsc-alias@1.8.10 -p tsconfig.json

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

# Prisma 5 necesita el binario openssl para detectar la versión de libssl;
# sin él solo avisa, pero mejor instalarlo. wget lo usa el healthcheck.
RUN apk add --no-cache openssl wget

# Los archivos vienen del builder como root: hay que darlos al usuario node,
# si no `npx prisma migrate deploy` no puede escribir en
# node_modules/@prisma/engines y el contenedor entra en bucle de reinicios.
COPY --chown=node:node --from=builder /app/node_modules ./node_modules
COPY --chown=node:node --from=builder /app/dist ./dist
COPY --chown=node:node --from=builder /app/package.json ./package.json
# Esquema + migraciones: el arranque aplica `prisma migrate deploy`
COPY --chown=node:node --from=builder /app/prisma ./prisma

# El logger (winston) crea ./logs al arrancar: /app es de root en la imagen,
# así que el directorio debe existir y ser del usuario node, si no el
# proceso muere con EACCES mkdir '/app/logs' y el contenedor reinicia.
RUN mkdir -p /app/logs && chown node:node /app/logs

USER node
EXPOSE 3333

HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=3 \
  CMD wget -qO- http://127.0.0.1:3333/health || exit 1

CMD ["node", "dist/main.js"]
