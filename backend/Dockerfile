FROM node:20-alpine

WORKDIR /app

# Copiar manifiesto de dependencias y lockfile
COPY package*.json ./

# Instalar dependencias estrictamente de producción
RUN npm ci --omit=dev

# Copiar esquema de Prisma y generar cliente
COPY prisma ./prisma
RUN npx prisma generate

# Copiar el resto del código fuente
COPY . .

EXPOSE 4000

# Arranque seguro en producción (sin DDL de migraciones; se ejecutan externamente con saas_migrator)
CMD ["npm", "start"]
