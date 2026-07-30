FROM node:24-alpine AS builder
WORKDIR /app

COPY package*.json ./
COPY packages/shared/package*.json ./packages/shared/
COPY packages/client/package*.json ./packages/client/

RUN npm ci

COPY tsconfig.base.json ./
COPY packages/shared/ ./packages/shared/
COPY packages/client/ ./packages/client/

RUN npm run build -w packages/client

FROM nginx:1.27-alpine
COPY --from=builder /app/packages/client/dist /usr/share/nginx/html
COPY packages/client/nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
