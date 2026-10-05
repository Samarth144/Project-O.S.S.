# Project O.S.S. (Observability & Support Shield)

Project O.S.S. is an automated incident detection, response, and remediation system. It integrates a Node.js web application, a Python RAG (Retrieval-Augmented Generation) knowledge engine, a standalone monitoring watchdog, and n8n agent orchestrations to detect outages, answer user queries, and auto-heal systems autonomously using historical runbooks.

---

## 🏗️ System Architecture

```
                       ┌────────────────────────────────────────┐
                       │           Telemetry Watchdog           │
                       │              (Port 3100)               │
                       └──────────────────┬─────────────────────┘
                                          │
                                 Probes /health & OS
                                          │
                                          ▼
┌──────────────────────┐        ┌──────────────────┐        ┌──────────────────────┐
│  Shield Chat UI (JS) ├───────►│  Express Server  ├───────►│  Python RAG Engine   │
│  (Real-Time Intel)   │        │   (Port 3000)    │        │  (Vector Database)   │
└──────────────────────┘        └────────┬─────────┘        └──────────────────────┘
                                         │
                                 Webhooks (Observer, Scribe)
                                         │
                                         ▼
                        ┌──────────────────────────────────┐
                        │      n8n Orchestration Agent     │
                        │           (Port 5678)            │
                        └──────────────────────────────────┘
```

The platform is composed of four main components:
1. **Express Server (Port 3000):** Exposes application endpoints, in-memory demo banking data, and incident simulation utilities.
2. **Python RAG Engine:** A localized LangChain-based vector database (using ChromaDB and Sentence-Transformers) containing system runbooks and historical incident logs.
3. **Telemetry Watchdog (Port 3100):** A standalone, out-of-process monitor that tracks CPU, memory, database latency, and log error tails.
4. **n8n Agent Workflows (Port 5678):** Hosts three specialized agents:
   * **Observer-agent:** Webhook receiver for telemetry alerts; determines when to trigger remediation or page engineers.
   * **Shield-agent:** Empathetic live-chat customer assistant.
   * **Scribe-agent:** Generates post-mortems and customer apology emails once incidents are resolved.

---

## ⚡ Core Features

### 1. Dynamic RAG-Enriched Support Chat
Whenever a user interacts with the Shield customer support interface, the backend intercepts the message and performs a semantic search against the RAG vector store. Relevant runbooks or past resolution documents are appended as `[System Search Reference]` to the payload forwarded to the Shield LLM. This allows the AI agent to give highly accurate, technical answers to custom queries without modifying the n8n workflow.

### 2. Zero-Lag Status Polling (Optimized Caching)
To avoid spawning heavy Python sub-processes on every client polling request, the Express server queries RAG **once** at the moment an incident starts and caches the matched runbook solution. Client status checks return instantly (0ms latency), resolving browser freeze and high CPU utilization.

### 3. Independent Watchdog & Degraded Mode Routing
The watchdog process runs completely separate from the main application process. If the Express server hangs or dies (`app:DOWN`), the watchdog detects the failure within 30 seconds and fires a Datadog-style alert with structured flags (`app_reachable: false` and a `last_snapshot` containing metrics prior to the crash).

The **n8n Observer workflow** has a split-routing condition:
* **Normal Path (`app_reachable: true`):** Fetches the application error logs and runs a full LLM analysis.
* **Degraded Path (`app_reachable: false`):** Bypasses log fetching entirely (avoiding request timeouts), processes the watchdog's last-known metrics directly, and records the incident in Supabase under "Degraded Mode".

### 4. Autonomous Auto-Healing Engine
Exposes a `/auto-heal` endpoint. When the Observer identifies a known failure type (`db_down`, `payment_down`, `api_timeout`), it calls this endpoint *before* paging engineers. The server simulates running the recovery commands (e.g. promoting replica `touch /tmp/postgresql.trigger.5432` for `db_down`), resolves the active incident, and logs `"Auto-remediation successful. Engineers never got paged."` while Scribe asynchronously generates the post-mortem.

---

## 🚀 Getting Started

### 📋 Prerequisites
* **Node.js** (v18+)
* **Python** (v3.10+)
* **n8n** (installed locally or via Docker)
* **Supabase** account (for incident logging)

---

### ⚙️ Installation

1. **Install Node.js dependencies:**
   ```bash
   npm install
   ```

2. **Set up Python virtual environment:**
   Create and activate a virtual environment inside the `ai/` directory:
   ```bash
   cd ai
   python -m venv venv
   # On Windows:
   venv\Scripts\activate
   # On Unix/macOS:
   source venv/bin/activate
   ```

3. **Install Python packages:**
   ```bash
   pip install -r requirements.txt
   ```

4. **Ingest the Knowledge Base:**
   Index the runbooks and incidents into the Chroma vector database:
   ```bash
   python rag/ingest.py
   ```

---

## 🏃 Running the Application

Open two separate terminals:

**Terminal 1 (Main Server):**
```bash
npm start
```

**Terminal 2 (APM Watchdog):**
```bash
node telemetry-watchdog.js
```

### Incident Apology Emails

When an incident is resolved, Express sends a post-incident apology email to the configured recipients. The incident type, start/end times, and reference ID are included when available. Configure SMTP in the server environment; credentials are not stored in the repository:

```text
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-smtp-user
SMTP_PASS=your-smtp-password
SMTP_FROM=your-verified-sender@example.com
```

`SMTP_FROM` defaults to `SMTP_USER`. Port 465 defaults to secure TLS. If `SMTP_HOST` or a sender address is missing, incident handling continues and the email is skipped with a log entry.

### Docker deployment

The Compose stack runs the Express API with its Python RAG dependencies, the Nexa Bank UI, the telemetry watchdog, and an Nginx reverse proxy. The UI and API share one browser origin, so the frontend can also be deployed on a remote host without calling the visitor's `localhost`.

1. Install Docker Engine with the Compose plugin.
2. Copy `.env.example` to `.env` and add SMTP credentials. Set the n8n webhook URLs and Supabase credentials if those integrations are enabled. Keep `.env` private.
3. Build and start the stack:
   ```bash
   docker compose up --build -d
   ```
4. Open `http://localhost:8080` (or the port set by `WEB_PORT`). Check service output with `docker compose logs -f api watchdog frontend web`.

The API, UI, and watchdog communicate over the Compose network. Only the web proxy is published to the host. n8n and Supabase are external services; the default n8n URLs expect n8n to be running on the Docker host at port 5678. Override the webhook URLs in `.env` when n8n is elsewhere.

The `app-data` Docker volume stores the Chroma index, Hugging Face model cache, policy training data, logs, and pending apology emails. Demo users, products, carts, balances, and transactions are in memory and reset when the API container restarts. To ingest the knowledge base into the persistent vector store, run:

```bash
docker compose exec api /opt/ai-venv/bin/python ai/rag/ingest.py
```

Use `docker compose down` to stop the stack while retaining its volume.

---

## 🧪 Simulation & Testing

### 1. Test Auto-Healing
1. Trigger a database failure:
   ```powershell
   Invoke-RestMethod -Method Post -Uri "http://localhost:3000/simulate-failure" -ContentType "application/json" -Body '{"type": "db_down"}'
   ```
2. Trigger the auto-heal resolution (simulating the n8n Observer node call):
   ```powershell
   Invoke-RestMethod -Method Post -Uri "http://localhost:3000/auto-heal" -ContentType "application/json" -Body '{"type": "db_down"}'
   ```
3. Check the server console log to verify that the auto-healing successfully executed the replica trigger, cleared the incident state, and bypassed paging.

### 2. Test Server Death (Degraded Mode)
1. Ensure both the server and watchdog are running.
2. Terminate the main server (`Ctrl + C` in Terminal 1).
3. The watchdog will detect the outage in ~15-30s, send the `app_reachable: false` payload, and n8n will process it cleanly via the Degraded Path, inserting the incident details into Supabase without hanging.
