# Build stage
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci

# Copy source code
COPY . .

# Set dummy token for build time (actual token injected at runtime)
ENV AI_BUILDER_TOKEN=dummy_build_token

# Build the Next.js app in standalone mode
RUN npm run build

# Production stage
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production

# Copy necessary files from builder (public may or may not exist)
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static

# Expose port
EXPOSE 3000

# Start application - Next.js standalone reads PORT env var automatically
CMD ["node", "server.js"]
