FROM node:20-alpine AS build
WORKDIR /app/backend
# 默认 dl-cdn 源在本环境持续带宽极低且易超时/截断；切到 SJTU 镜像（保持版本随镜像走）
RUN sed -i 's#dl-cdn.alpinelinux.org#mirror.sjtu.edu.cn#' /etc/apk/repositories \
  && apk add --no-cache python3 make g++
COPY backend/package.json backend/package-lock.json ./
RUN npm ci --omit=dev

FROM node:20-alpine
WORKDIR /app
COPY --from=build /app/backend/node_modules ./backend/node_modules
COPY backend/package.json ./backend/package.json
COPY backend/src backend/src
ENV NODE_ENV=production
EXPOSE 3001
# API 入口；worker 服务通过 compose command 覆盖为 backend/src/worker/main.js
CMD ["node", "backend/src/server.js"]