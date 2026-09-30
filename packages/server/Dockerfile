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
# one unit.
#
# It runs from its own virtualenv here exactly as it does in development, so
# both use one mechanism and the image cannot drift onto a different interpreter
# or miss a dependency.
# --python /usr/bin/python3 pins the venv to Alpine's interpreter, which already
# satisfies requires-python. Left to itself uv downloads one into /root, which
# the unprivileged runtime user cannot read.
RUN apk add --no-cache python3
COPY --from=ghcr.io/astral-sh/uv:latest /uv /usr/local/bin/uv
COPY --chown=node:node swellkit ./swellkit
RUN cd swellkit \
 && uv sync --frozen --no-dev --python /usr/bin/python3 \
 && chown -R node:node .venv \
 && rm /usr/local/bin/uv
# Absolute because the image flattens the monorepo layout the server resolves
# against by default: dist lives at /app/dist, not /app/packages/server/dist.
ENV SWELLKIT_BIN=/app/swellkit/.venv/bin/swellkit

COPY --from=builder --chown=node:node /app/packages/server/dist ./dist
COPY --from=builder --chown=node:node /app/packages/server/src/db/migrations ./dist/db/migrations
COPY --from=builder --chown=node:node /app/node_modules ./node_modules
COPY --chown=node:node packages/server/package.json ./

# node_modules/@swell-engine/shared is a workspace symlink to
# ../../packages/shared, so the target has to exist here or every import of it
# fails at startup with ERR_MODULE_NOT_FOUND.
COPY --from=builder --chown=node:node /app/packages/shared/package.json ./packages/shared/
COPY --from=builder --chown=node:node /app/packages/shared/dist ./packages/shared/dist

EXPOSE 3000
USER node
CMD ["node", "dist/index.js"]
