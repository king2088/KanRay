FROM node:20-alpine AS build
WORKDIR /app/backend
COPY backend/package.json backend/package-lock.json ./
RUN npm ci --omit=dev

FROM node:20-alpine
WORKDIR /app
COPY --from=build /app/backend/node_modules ./backend/node_modules
COPY backend/package.json ./backend/package.json
COPY backend/src backend/src
ENV NODE_ENV=production
EXPOSE 3001
# API 入口；worker 服务通过 deployment command 覆盖为 backend/src/worker/main.js
CMD ["node", "backend/src/server.js"]