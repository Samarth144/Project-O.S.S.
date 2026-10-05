FROM node:22-bookworm-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

WORKDIR /app

RUN apt-get update \
    && apt-get install -y --no-install-recommends python3 python3-venv python3-pip build-essential libgomp1 \
    && rm -rf /var/lib/apt/lists/*

COPY package*.json ./
RUN npm ci --omit=dev --no-audit --no-fund

COPY ai/requirements.txt ./ai/requirements.txt
RUN python3 -m venv /opt/ai-venv \
    && /opt/ai-venv/bin/pip install --no-cache-dir --upgrade pip \
    && /opt/ai-venv/bin/pip install --no-cache-dir -r ai/requirements.txt

COPY --chown=node:node . .

RUN mkdir -p /app-data /home/node/.cache \
    && chown -R node:node /app-data /home/node/.cache

ENV NODE_ENV=production \
    PORT=3000 \
    DATA_DIR=/app-data \
    LOG_FILE=/app-data/project_oss.log \
    POLICY_FILE=/app-data/policy.json \
    CHROMA_DB_DIR=/app-data/chroma_db \
    HF_HOME=/app-data/huggingface \
    PYTHON_BIN=/opt/ai-venv/bin/python

USER node

EXPOSE 3000

CMD ["node", "start-container.js"]
