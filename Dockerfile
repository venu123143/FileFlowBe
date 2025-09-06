# ============================
# Single-stage Bun build
# ============================
FROM oven/bun:1.2.21-debian

WORKDIR /app

# Copy package files and Bun config
COPY package.json bun.lock bunfig.toml ./

# Install all dependencies (dev + prod)
RUN bun install

# Copy the rest of the source code
COPY . .

# Optional: type-check/build for validation
RUN bun run build

# Expose app port
EXPOSE 7000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:7000/health || exit 1

# Start Bun directly with TypeScript
CMD ["bun", "run" , "src/index.ts"]
