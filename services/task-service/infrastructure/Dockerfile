# Use Node.js 20 LTS on Debian
FROM node:20-slim

# Install runtime and healthcheck dependencies
RUN apt-get update && apt-get install -y openssl ca-certificates curl && rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy Prisma schema
COPY prisma/ ./prisma/

# Generate Prisma client using schema-compatible CLI
RUN npx prisma@5.0.0 generate

# Copy source code
COPY dist/ ./dist/
COPY docs/ ./docs/
COPY public/ ./public/

# Create non-root user
RUN groupadd -g 1001 nodejs && useradd -s /bin/bash -u 1001 -g nodejs taskflow

# Change ownership
RUN chown -R taskflow:nodejs /app
USER taskflow

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:3000/health || exit 1

# Start the application
CMD ["node", "dist/server.js"]
