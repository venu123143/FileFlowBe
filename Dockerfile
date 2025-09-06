# ============================
# Stage 1: Builder
# ============================
FROM oven/bun:1.2.21-debian AS builder

WORKDIR /app

# Copy package files
COPY package.json bun.lock bunfig.toml ./

# Install all dependencies (including dev)
RUN bun install

# Copy source code
COPY . .

# Build TypeScript -> dist
RUN bun run build


# ============================
# Stage 2: Production
# ============================
FROM oven/bun:1.2.21-debian AS production

WORKDIR /app

# Copy only package files
COPY package.json bun.lock bunfig.toml ./

# Install only production dependencies
RUN bun install --production

# Copy built files from builder
COPY --from=builder /app/dist ./dist

# Expose app port
EXPOSE 7000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:7000/health || exit 1

# Start the server
CMD ["bun", "run", "dist/index.js"]
