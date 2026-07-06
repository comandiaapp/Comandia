FROM node:20-alpine

WORKDIR /app

# Copiar e instalar frontend
COPY frontend/package*.json ./frontend/
RUN cd frontend && npm install

# Copiar e instalar backend
COPY backend/package*.json ./backend/
RUN cd backend && npm install

# Copiar todo el código
COPY frontend/ ./frontend/
COPY backend/ ./backend/

# Build del frontend
RUN cd frontend && npm run build

# Exponer puerto
EXPOSE 3000

# Arrancar backend
CMD ["node", "backend/server.js"]
