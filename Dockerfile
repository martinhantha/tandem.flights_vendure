# Use Debian-based Node.js image (recommended for ARM64 & sharp)
FROM node:24-slim

WORKDIR /usr/src/app

RUN apt-get update && apt-get install -y curl

# Copy package.json and yarn.lock
COPY package.json yarn.lock ./

# Copy patches
COPY patches ./patches

# Install dependencies (use frozen lockfile for reproducible installs)
# yarn cache as BuildKit cache mount: kept between builds, not part of the image
RUN --mount=type=cache,target=/usr/local/share/.cache/yarn \
    yarn install

# Copy application files
COPY . .

# Build the project
RUN yarn global add copyfiles
RUN yarn build

# RUN rm -rf /usr/src/app/admin-ui

# RUN yarn build:admin
