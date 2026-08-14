FROM node:20-alpine

WORKDIR /app

# Copiar archivos de dependencias
COPY package*.json ./

# Instalar dependencias
RUN npm install

# Copiar el resto del código
COPY . .

# Generar cliente de Prisma
RUN npx prisma generate

EXPOSE 4000

# Ejecutar migraciones y encender servidor
CMD sh -c "npx prisma migrate deploy && npm start"
