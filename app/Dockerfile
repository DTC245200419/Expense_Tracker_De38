# syntax=docker/dockerfile:1
FROM node:24-alpine

ENV NODE_ENV=production
WORKDIR /app

# Cai dependencies truoc de tan dung cache layer (npm ci: dung dung phien ban trong package-lock.json)
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --no-audit --no-fund \
    && npm cache clean --force

# Copy ma nguon, giao dien va tai nguyen tinh
COPY src ./src
COPY views ./views
COPY public ./public

# Thu muc log duoc mount bang named volume (quyen 1000:1000)
RUN mkdir -p /app/logs && chown -R node:node /app

# Hardening: chay bang user khong phai root
USER node

EXPOSE 3000
CMD ["node", "src/server.js"]
