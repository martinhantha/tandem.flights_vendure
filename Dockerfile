# tandem.flights Vendure – multi-stage build (small runtime image for the shared Coolify server)
# Build stage: full install + build (server, dashboard, compiled seed/import scripts)
FROM node:24-slim AS build
WORKDIR /usr/src/app
COPY package.json yarn.lock ./
COPY patches ./patches
RUN --mount=type=cache,target=/usr/local/share/.cache/yarn \
    yarn install --frozen-lockfile
COPY . .
RUN yarn build \
 && yarn tsc -p scripts/tandem-import/tsconfig.build.json \
 && mkdir -p dist/scripts \
 && cp -r build-scripts/scripts/tandem-import dist/scripts/tandem-import \
 && cp -r scripts/tandem-import/assets scripts/tandem-import/voucher-template dist/scripts/tandem-import/ \
 && ln -s . dist/src

# Runtime dependencies: the (already patched) build node_modules, pruned to what dist/** can reach
# (scripts/prune-runtime-deps.js – drops dev deps and the dashboard's build-time frontend packages)
FROM node:24-slim AS deps
WORKDIR /usr/src/app
COPY --from=build /usr/src/app/node_modules ./node_modules
COPY --from=build /usr/src/app/dist ./dist
COPY scripts/prune-runtime-deps.js ./prune-runtime-deps.js
RUN node prune-runtime-deps.js . --report

# Runtime
FROM node:24-slim
RUN apt-get update && apt-get install -y --no-install-recommends curl ca-certificates && rm -rf /var/lib/apt/lists/*
WORKDIR /usr/src/app
ENV NODE_ENV=production
COPY package.json ./
COPY --from=deps /usr/src/app/node_modules ./node_modules
COPY --from=build /usr/src/app/dist ./dist
COPY static ./static
# plugins read GraphQL schemas (src/**/*.gql) relative to the working directory at runtime
COPY src ./src
# one-off commands inside the container:
#   node dist/scripts/tandem-import/seed.js
#   node dist/scripts/tandem-import/import-products.js --dump /tmp/old.sql
#   node dist/scripts/tandem-import/import-vouchers.js --dump /tmp/old.sql
CMD ["yarn", "start:server"]
