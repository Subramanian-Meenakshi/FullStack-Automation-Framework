FROM node:22-alpine AS build
WORKDIR /app
COPY frontend/employee-portal/package.json frontend/employee-portal/package-lock.json ./
RUN npm ci
COPY frontend/employee-portal/ ./
RUN npm run build

FROM nginx:1.27-alpine
COPY --from=build /app/dist /usr/share/nginx/html
COPY frontend/employee-portal/nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
