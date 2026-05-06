FROM node:22-alpine AS builder
WORKDIR /app

# Copy workspace manifests for layer caching
COPY package*.json ./
COPY packages/shared/package*.json ./packages/shared/
COPY packages/server/package*.json ./packages/server/

RUN npm ci

# Copy source and build
COPY tsconfig.base.json ./
COPY packages/shared/ ./packages/shared/
COPY packages/server/ ./packages/server/

RUN npm run build -w packages/shared
RUN npm run build -w packages/server

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

COPY --from=builder --chown=node:node /app/packages/server/dist ./dist
COPY --from=builder --chown=node:node /app/packages/server/src/db/migrations ./dist/db/migrations
COPY --from=builder --chown=node:node /app/node_modules ./node_modules
COPY --chown=node:node packages/server/package.json ./

USER node
CMD ["node", "dist/index.js"]
