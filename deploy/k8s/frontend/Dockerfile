FROM node:20-alpine AS build
WORKDIR /app/front-end
COPY front-end/package.json front-end/package-lock.json ./
RUN npm ci --legacy-peer-deps
COPY front-end/ ./
RUN npm run build

FROM nginx:1.27-alpine
ENTRYPOINT []
RUN rm -f /etc/nginx/conf.d/default.conf && mkdir -p /etc/nginx/conf.d
COPY deploy/k8s/frontend/nginx-main.conf /etc/nginx/nginx.conf
COPY deploy/k8s/frontend/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/front-end/dist /usr/share/nginx/html
EXPOSE 8080
USER nginx
CMD ["nginx", "-g", "daemon off;"]