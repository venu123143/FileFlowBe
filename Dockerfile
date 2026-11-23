# ============================
# Single-stage Bun build (multi-arch: amd64 + arm64)
# ============================
ARG TARGETPLATFORM
FROM --platform=$TARGETPLATFORM oven/bun:1.2.21-debian

WORKDIR /app

# Install curl for the HEALTHCHECK (not present in the base image)
RUN apt-get update \
    && apt-get install -y --no-install-recommends curl ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Copy package files and Bun config
COPY package.json bun.lock bunfig.toml ./

# Install all dependencies (dev + prod) using the lockfile for reproducible arm64 builds
RUN bun install --frozen-lockfile

# Copy the rest of the source code
COPY . .

# Optional: type-check/build for validation
RUN bun run build

# Expose app port
EXPOSE 7000

# Health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD curl -fsS http://localhost:7000/health || exit 1

# Start Bun directly with TypeScript
CMD ["bun", "run", "src/index.ts"]
