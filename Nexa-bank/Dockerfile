FROM node:22-bookworm-slim

WORKDIR /app

COPY package*.json ./
RUN npm ci --no-audit --no-fund

COPY . .

ARG VITE_API_BASE_URL=/backend
ENV VITE_API_BASE_URL=${VITE_API_BASE_URL}
ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=4173

RUN npm run build

EXPOSE 4173

CMD ["node", ".output/server/index.mjs"]
