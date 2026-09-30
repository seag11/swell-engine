FROM node:24-alpine AS builder
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
RUN npm prune --omit=dev

FROM node:24-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

# The surf model is a Python program the server invokes over a pipe. It ships in
# this image rather than as its own service so the two are built and deployed as
# one unit; swellkit has no dependencies beyond the standard library.
RUN apk add --no-cache python3
ENV SWELLKIT_SRC=/app/swellkit/src

COPY --from=builder --chown=node:node /app/packages/server/dist ./dist
COPY --from=builder --chown=node:node /app/packages/server/src/db/migrations ./dist/db/migrations
COPY --from=builder --chown=node:node /app/node_modules ./node_modules
COPY --chown=node:node packages/server/package.json ./
COPY --chown=node:node swellkit/src ./swellkit/src

# node_modules/@swell-engine/shared is a workspace symlink to
# ../../packages/shared, so the target has to exist here or every import of it
# fails at startup with ERR_MODULE_NOT_FOUND.
COPY --from=builder --chown=node:node /app/packages/shared/package.json ./packages/shared/
COPY --from=builder --chown=node:node /app/packages/shared/dist ./packages/shared/dist

EXPOSE 3000
USER node
CMD ["node", "dist/index.js"]
