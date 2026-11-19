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

# Production dependencies only (+ patches, applied with the build stage's patch-package)
FROM node:24-slim AS deps
WORKDIR /usr/src/app
COPY package.json yarn.lock ./
COPY patches ./patches
RUN --mount=type=cache,target=/usr/local/share/.cache/yarn \
    yarn install --frozen-lockfile --production --ignore-scripts
COPY --from=build /usr/src/app/node_modules/patch-package /tmp/patch-package
COPY --from=build /usr/src/app/node_modules /tmp/build_modules
RUN NODE_PATH=/tmp/build_modules node /tmp/patch-package/index.js \
 && rm -rf /tmp/patch-package /tmp/build_modules

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
