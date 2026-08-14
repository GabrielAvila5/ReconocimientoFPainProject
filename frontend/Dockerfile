# Etapa 1: Compilar la aplicación React/Vite
FROM node:20-alpine as build

WORKDIR /app

# Copiar archivos de dependencias
COPY package*.json ./

# Instalar dependencias
RUN npm install

# Copiar el código fuente
COPY . .

# Construir la aplicación estática
RUN npm run build

# Etapa 2: Servir con Nginx
FROM nginx:alpine

# Copiar el build del paso anterior a la carpeta pública de Nginx
COPY --from=build /app/dist /usr/share/nginx/html

# Copiar nuestra configuración personalizada de Nginx
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
