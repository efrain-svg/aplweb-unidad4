FROM node:24-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY backend ./backend
USER node
CMD ["node", "backend/server.js"]
