# Stage 1: Build Frontend and Server
FROM node:20-slim AS builder

WORKDIR /app

# Install pnpm
RUN npm install -g pnpm

# Copy package descriptors
COPY package.json pnpm-lock.yaml* ./
RUN pnpm install --frozen-lockfile || pnpm install

# Copy application code
COPY . .

# Build Vite client and Express production server
RUN pnpm run build || (npx vite build && npx esbuild server/index.ts --platform=node --packages=external --bundle --format=esm --outdir=dist)

# Stage 2: Production Runtime
FROM node:20-slim AS runner

WORKDIR /app

ENV NODE_ENV=production \
    PORT=3000

# Copy package.json for runtime dependencies
COPY package.json ./
RUN npm install -g pnpm && pnpm install --prod --ignore-scripts

# Copy built distribution from builder
COPY --from=builder /app/dist ./dist

# Expose web port
EXPOSE 3000

# Run production server
CMD ["node", "dist/index.js"]
