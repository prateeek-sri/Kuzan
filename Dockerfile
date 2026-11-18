# Multi-Stage Production Dockerfile
# Standard: shipping-and-launch & ci-cd-and-automation

# Stage 1: Base Dependencies with Node 22 and Python 3.11
FROM node:22-bullseye-slim AS base
WORKDIR /app

# Install system dependencies & Python runtime
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 \
    python3-pip \
    python3-venv \
    curl \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Stage 2: Install Node Dependencies
FROM base AS deps
WORKDIR /app
COPY web/package.json web/package-lock.json ./web/
COPY web/prisma ./web/prisma/
WORKDIR /app/web
RUN npm ci

# Stage 3: Train & Prepare Python ML Estimators
FROM base AS ml-builder
WORKDIR /app
COPY ml-service/requirements.txt ./ml-service/
RUN pip3 install --no-cache-dir -r ml-service/requirements.txt
COPY ml-service/ ./ml-service/
WORKDIR /app/ml-service
RUN python3 models/train.py

# Stage 4: Next.js Production Build
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/web/node_modules ./web/node_modules
COPY web/ ./web/
COPY shared/ ./shared/
COPY --from=ml-builder /app/ml-service /app/ml-service

WORKDIR /app/web
ENV NEXT_TELEMETRY_DISABLED=1
RUN npx prisma generate
RUN npm run build

# Stage 5: Production Runner
FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000

# Install ML runtime packages in final stage
COPY ml-service/requirements.txt ./ml-service/
RUN pip3 install --no-cache-dir -r ml-service/requirements.txt

# Create non-root application user
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

# Copy build artifacts
COPY --from=builder /app/web/public ./web/public
COPY --from=builder /app/web/.next ./web/.next
COPY --from=builder /app/web/node_modules ./web/node_modules
COPY --from=builder /app/web/package.json ./web/package.json
COPY --from=builder /app/web/prisma ./web/prisma
COPY --from=ml-builder /app/ml-service ./ml-service
COPY shared/ ./shared/

USER nextjs
EXPOSE 3000

WORKDIR /app/web
CMD ["npm", "start"]

