const express = require('express');
const Database = require('better-sqlite3');
const winston = require('winston');
const fetch = require('node-fetch');
const fs = require('fs');
const path = require('path');

// ---------------------------------------------------------
// SSE Subscriber Registry
// ---------------------------------------------------------
const sseClients = new Map(); // clientId -> res
let sseClientCounter = 0;

function broadcastSSE(eventName, data) {
  const payload = `event: ${eventName}\ndata: ${JSON.stringify(data)}\n\n`;
  for (const [id, res] of sseClients) {
    try {
      res.write(payload);
    } catch (err) {
      logger && logger.warn(`SSE write failed for client ${id}`, { error: err.message });
      sseClients.delete(id);
    }
  }
}

const app = express();
const PORT = process.env.PORT || 3000;
const LOG_FILE = 'project_oss.log';

// ---------------------------------------------------------
// 1. Winston Logger Setup
// ---------------------------------------------------------
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss.SSS' }),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.printf(({ timestamp, level, message, ...meta }) => {
          const metaString = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : '';
          return `[${timestamp}] ${level}: ${message}${metaString}`;
        })
      )
    }),
    new winston.transports.File({ filename: LOG_FILE })
  ]
});

// ---------------------------------------------------------
// 2. Database Initialization
// ---------------------------------------------------------
let db;
try {
  db = new Database('project_oss.db', { verbose: (msg) => logger.debug(msg) });
  logger.info('Database initialized successfully: project_oss.db');
  
  // Create tables if they do not exist
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS products (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      price REAL NOT NULL,
      stock INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS cart_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      product_id INTEGER NOT NULL,
      quantity INTEGER NOT NULL,
      FOREIGN KEY (product_id) REFERENCES products(id)
    );

    CREATE TABLE IF NOT EXISTS payments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      amount REAL NOT NULL,
      status TEXT NOT NULL,
      transaction_id TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
  `);

  // Seed default data if users table is empty
  const userCount = db.prepare('SELECT count(*) as count FROM users').get();
  if (userCount.count === 0) {
    db.prepare('INSERT INTO users (username, password) VALUES (?, ?)').run('admin', 'password123');
    logger.info('Seeded default admin user.');
  }

  // Seed default products if empty
  const productCount = db.prepare('SELECT count(*) as count FROM products').get();
  if (productCount.count === 0) {
    const insertProd = db.prepare('INSERT INTO products (name, price, stock) VALUES (?, ?, ?)');
    insertProd.run('Quantum Processor Unit', 899.99, 15);
    insertProd.run('Holographic Display V1', 349.99, 30);
    insertProd.run('Superfluid Cooling Gel', 24.50, 120);
    insertProd.run('Gravity Boots (Refurbished)', 149.99, 8);
    logger.info('Seeded default products.');
  }

} catch (error) {
  logger.error('Failed to initialize database', { error: error.message, stack: error.stack });
  process.exit(1);
}

// ---------------------------------------------------------
// 3. Incident State Setup
// ---------------------------------------------------------
let activeIncident = {
  type: null, // 'payment_down' | 'db_down' | 'api_timeout' | null
  startedAt: null,
  affectedUserCount: 0,
  ragContext: null
};

// ---------------------------------------------------------
// 4. Middlewares & Helper Functions
// ---------------------------------------------------------
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ---------------------------------------------------------
// CORS — Allow frontend dev server (TanStack Start / Vite)
// ---------------------------------------------------------
app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (origin) {
    // Dynamically allow the requesting origin
    res.setHeader('Access-Control-Allow-Origin', origin);
  } else {
    res.setHeader('Access-Control-Allow-Origin', '*');
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, Accept');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});

// Silences favicon.ico 404 logs in browsers
app.get('/favicon.ico', (req, res) => res.status(204).end());

// Request tracking middleware
app.use((req, res, next) => {
  req.id = Math.random().toString(36).substring(2, 11).toUpperCase();
  req.startTime = Date.now();
  
  logger.info('Incoming request', {
    requestId: req.id,
    method: req.method,
    url: req.originalUrl,
    ip: req.ip,
    userAgent: req.get('user-agent'),
    body: req.method !== 'GET' ? req.body : undefined
  });

  // Intercept response finish to log completion details
  res.on('finish', () => {
    const duration = Date.now() - req.startTime;
    logger.info('Request completed', {
      requestId: req.id,
      method: req.method,
      url: req.originalUrl,
      statusCode: res.statusCode,
      durationMs: duration
    });
  });

  next();
});

// Database Runner Wrapper (handles db_down incident)
function runDbQuery(queryFn) {
  if (activeIncident.type === 'db_down') {
    const dbError = new Error('SqliteError: cannot acquire lock, connection timed out or pool exhausted');
    logger.error('Database query failed', {
      error: dbError.message,
      stack: dbError.stack,
      incidentType: 'db_down',
      timestamp: new Date().toISOString()
    });
    throw dbError;
  }
  return queryFn();
}

// Downstream Webhook Client
async function sendWebhookNotification(url, payload) {
  try {
    logger.info(`Sending incident webhook notification to: ${url}`, { payload });
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      timeout: 3000 // 3 seconds timeout
    });
    if (response.ok) {
      logger.info(`Webhook alert delivered successfully to ${url}`, { status: response.status });
    } else {
      logger.warn(`Webhook receiver returned status error: ${response.status}`, { url });
    }
  } catch (error) {
    logger.error(`Webhook delivery failed`, { url, error: error.message });
  }
}

// Timeout helper utility
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// ---------------------------------------------------------
// n8n Webhook URLs
// ---------------------------------------------------------
const N8N_WEBHOOKS = {
  observer:  process.env.N8N_OBSERVER_WEBHOOK  || 'http://localhost:5678/webhook/Observer',
  scribe:    process.env.N8N_SCRIBE_WEBHOOK    || 'http://localhost:5678/webhook/Scribe',
  shield:    process.env.N8N_SHIELD_WEBHOOK    || 'http://localhost:5678/webhook/Shield',
  commander: process.env.N8N_COMMANDER_WEBHOOK || 'http://localhost:5678/webhook/Commander',
};

// Trigger n8n Commander workflow to autonomously execute auto-heal
// Called non-blocking — Express never waits for Commander to finish
async function triggerCommander(incidentType, startedAt) {
  const payload = {
    type:       incidentType,
    startedAt:  startedAt || new Date().toISOString(),
    source:     'express-server',
    autoHealUrl: `http://localhost:${process.env.PORT || 3000}/auto-heal`,
  };
  try {
    logger.info(`[Commander] Triggering autonomous remediation for [${incidentType}]`, { payload });
    const res = await fetch(N8N_WEBHOOKS.commander, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(payload),
      // Timeout after 4s — if n8n doesn't acknowledge, log and continue
      signal:  AbortSignal.timeout(4000),
    });
    if (res.ok) {
      logger.info(`[Commander] n8n acknowledged remediation trigger for [${incidentType}]`);
    } else {
      logger.warn(`[Commander] n8n returned HTTP ${res.status} for Commander webhook`);
    }
  } catch (err) {
    // Commander unavailable — log but do NOT block the incident response
    logger.warn(`[Commander] Webhook unreachable.`, {
      incidentType,
      error: err.message,
    });
  }

  // FAILSAFE: Automatically heal after 12 seconds if n8n hasn't done it yet
  // This guarantees the system is self-healing even if n8n is offline or misconfigured.
  setTimeout(async () => {
    if (activeIncident.type === incidentType) {
      logger.info(`[Failsafe] Incident [${incidentType}] still active after 12s. Forcing internal auto-heal...`);
      try {
        await fetch(`http://localhost:${process.env.PORT || 3000}/auto-heal`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ type: incidentType })
        });
      } catch (e) {
        logger.error('[Failsafe] Internal auto-heal failed:', e.message);
      }
    }
  }, 12000);
}

// ---------------------------------------------------------
// 5. Business Endpoints
// ---------------------------------------------------------

// GET /products - Retrieve list of available products
app.get('/products', (req, res, next) => {
  try {
    const products = runDbQuery(() => {
      return db.prepare('SELECT * FROM products').all();
    });
    
    logger.info('Products fetched successfully', { count: products.length, requestId: req.id });
    res.json({ success: true, products });
  } catch (error) {
    next(error);
  }
});

// POST /login - Simulate user authentication
app.post('/login', (req, res, next) => {
  const { username, password } = req.body;

  if (!username || !password) {
    logger.warn('Authentication failed: Missing credentials', { requestId: req.id });
    return res.status(400).json({ success: false, error: 'Username and password are required.' });
  }

  try {
    const user = runDbQuery(() => {
      return db.prepare('SELECT * FROM users WHERE username = ?').get(username);
    });

    if (!user || user.password !== password) {
      logger.warn('Authentication failed: Invalid credentials', { username, requestId: req.id });
      return res.status(401).json({ success: false, error: 'Invalid username or password.' });
    }

    logger.info('User authentication succeeded', { username, requestId: req.id });
    res.json({
      success: true,
      token: `session_token_${Math.random().toString(36).substr(2, 9)}`,
      username: user.username
    });
  } catch (error) {
    next(error);
  }
});

// POST /cart - Add item to cart
app.post('/cart', (req, res, next) => {
  const { productId, quantity } = req.body;

  if (!productId || !quantity || quantity <= 0) {
    logger.warn('Add to cart failed: Invalid payload', { productId, quantity, requestId: req.id });
    return res.status(400).json({ success: false, error: 'Valid productId and quantity are required.' });
  }

  try {
    // Verify product exists and check stock
    const product = runDbQuery(() => {
      return db.prepare('SELECT * FROM products WHERE id = ?').get(productId);
    });

    if (!product) {
      logger.warn('Add to cart failed: Product not found', { productId, requestId: req.id });
      return res.status(404).json({ success: false, error: 'Product not found.' });
    }

    if (product.stock < quantity) {
      logger.warn('Add to cart failed: Insufficient stock', { productId, requested: quantity, available: product.stock, requestId: req.id });
      return res.status(400).json({ success: false, error: 'Insufficient stock available.' });
    }

    // Insert or update cart
    runDbQuery(() => {
      const existing = db.prepare('SELECT * FROM cart_items WHERE product_id = ?').get(productId);
      if (existing) {
        db.prepare('UPDATE cart_items SET quantity = quantity + ? WHERE product_id = ?')
          .run(quantity, productId);
      } else {
        db.prepare('INSERT INTO cart_items (product_id, quantity) VALUES (?, ?)')
          .run(productId, quantity);
      }
    });

    logger.info('Product added/updated in cart', { productId, quantity, requestId: req.id });
    res.json({ success: true, message: 'Item added to cart.' });
  } catch (error) {
    next(error);
  }
});

// POST /checkout - Process cart checkout
app.post('/checkout', async (req, res, next) => {
  try {
    // Check if api_timeout incident is active
    if (activeIncident.type === 'api_timeout') {
      logger.warn('Downstream API call for inventory/checkout timed out', {
        incidentType: 'api_timeout',
        requestId: req.id
      });
      // Simulate real latency of downstream API before sending gateway timeout
      await delay(3500);
      logger.error('Downstream fulfillment integration timed out: no ACK received', { requestId: req.id });
      return res.status(504).json({
        success: false,
        error: 'Gateway Timeout: downstream fulfillment system failed to respond.'
      });
    }

    // Retrieve items in cart
    const cartItems = runDbQuery(() => {
      return db.prepare(`
        SELECT c.id, c.product_id, c.quantity, p.name, p.price, p.stock 
        FROM cart_items c 
        JOIN products p ON c.product_id = p.id
      `).all();
    });

    if (cartItems.length === 0) {
      logger.warn('Checkout failed: Cart is empty', { requestId: req.id });
      return res.status(400).json({ success: false, error: 'Your cart is empty.' });
    }

    // Validate stocks
    for (const item of cartItems) {
      if (item.stock < item.quantity) {
        logger.warn('Checkout failed: Item stock depleted during checkout', {
          product: item.name,
          requested: item.quantity,
          available: item.stock,
          requestId: req.id
        });
        return res.status(400).json({ success: false, error: `Stock for ${item.name} is no longer sufficient.` });
      }
    }

    // Calculate total
    const total = cartItems.reduce((acc, item) => acc + (item.price * item.quantity), 0);

    // Complete transaction: update stock & clear cart
    runDbQuery(() => {
      const updateStock = db.prepare('UPDATE products SET stock = stock - ? WHERE id = ?');
      const clearCart = db.prepare('DELETE FROM cart_items');

      // Use a transaction
      const transaction = db.transaction(() => {
        for (const item of cartItems) {
          updateStock.run(item.quantity, item.product_id);
        }
        clearCart.run();
      });
      transaction();
    });

    logger.info('Checkout processed successfully', { itemsCount: cartItems.length, totalAmount: total, requestId: req.id });
    res.json({ success: true, message: 'Checkout successful.', totalAmount: total });

  } catch (error) {
    next(error);
  }
});

// POST /payment - Process credit card payment
app.post('/payment', async (req, res, next) => {
  const { amount, paymentMethod } = req.body;

  if (!amount || amount <= 0) {
    logger.warn('Payment failed: Invalid amount', { amount, requestId: req.id });
    return res.status(400).json({ success: false, error: 'A positive payment amount is required.' });
  }

  // Handle payment_down incident simulation
  if (activeIncident.type === 'payment_down') {
    logger.error('Payment gateway interface error - connection refused (503 Service Unavailable)', {
      incidentType: 'payment_down',
      gateway: 'Stripe/Paypal Gateway',
      requestId: req.id
    });
    return res.status(503).json({
      success: false,
      error: 'Service Unavailable: Payment gateway is currently offline.'
    });
  }

  // Handle api_timeout incident simulation
  if (activeIncident.type === 'api_timeout') {
    logger.warn('Payment processor gateway connection hung', {
      incidentType: 'api_timeout',
      requestId: req.id
    });
    await delay(3500);
    logger.error('Gateway Timeout: Downstream payment verification service failed to respond within limits', { requestId: req.id });
    return res.status(504).json({
      success: false,
      error: 'Gateway Timeout: Payment verification system timed out.'
    });
  }

  try {
    const txId = `TXN-${Math.random().toString(36).substring(2, 11).toUpperCase()}`;

    runDbQuery(() => {
      db.prepare('INSERT INTO payments (amount, status, transaction_id, created_at) VALUES (?, ?, ?, ?)')
        .run(amount, 'APPROVED', txId, new Date().toISOString());
    });

    logger.info('Payment approved successfully', { transactionId: txId, amount, paymentMethod, requestId: req.id });
    res.json({ success: true, status: 'APPROVED', transactionId: txId });
  } catch (error) {
    next(error);
  }
});

// ---------------------------------------------------------
// 6. Incident Simulator Control Endpoints
// ---------------------------------------------------------

// POST /simulate-failure - Trigger an incident state
app.post('/simulate-failure', (req, res) => {
  let { type, reporterEmail } = req.body;

  // Normalize aliases for convenience
  if (type === 'api_degradation') type = 'api_timeout';
  if (type === 'db_failure') type = 'db_down';

  const supportedTypes = [
    'payment_down',
    'db_down',
    'api_timeout',
    'high_error_rate',
    'checkout_failure',
    'authentication_failure',
    'service_degradation',
    'disk_space_critical'
  ];

  if (!type || !supportedTypes.includes(type)) {
    logger.warn('Failure simulation rejected: Unsupported type', { type });
    return res.status(400).json({
      success: false,
      error: `Invalid incident type. Supported types: ${supportedTypes.join(', ')}`
    });
  }

  activeIncident = {
    type,
    startedAt: new Date().toISOString(),
    reporterEmail: reporterEmail || 'test@youremail.com',
    affectedUserCount: 0,
    ragContext: null
  };
  fetchAndCacheRAGContext(type);

  logger.warn(`INCIDENT SIMULATOR: Activated failure event of type [${type}]`, { activeIncident });

  // Generate a burst of error logs (minimum 5 entries)
  generateNoiseLogs(type);

  // Notify n8n Observer (fire-and-forget — for logging + pre-alert routing)
  const alertPayload = {
    type,
    timestamp: activeIncident.startedAt,
    source: 'mini-app',
    status: 'firing',
    reporterEmail: activeIncident.reporterEmail
  };
  sendWebhookNotification(N8N_WEBHOOKS.observer, alertPayload);

  // Trigger n8n Commander for autonomous remediation (non-blocking)
  triggerCommander(type, activeIncident.startedAt);

  // Broadcast SSE event to all connected frontend clients
  broadcastSSE('incident-update', {
    type: activeIncident.type,
    startedAt: activeIncident.startedAt,
    status: 'active',
    severity: supportedTypes.includes(type) ? 'high' : 'medium',
  });

  res.json({
    success: true,
    message: `Incident '${type}' simulated successfully.`,
    activeIncident
  });
});


// POST /resolve-incident - Resolve active incident
app.post('/resolve-incident', (req, res) => {
  if (!activeIncident.type) {
    logger.warn('Resolve incident requested but no active incident running.');
    return res.status(400).json({ success: false, error: 'No active incident to resolve.' });
  }

  const prevIncident = { ...activeIncident };
  const resolvedAt = new Date().toISOString();

  // Clear in-memory state
  activeIncident.type = null;
  activeIncident.startedAt = null;

  logger.info(`INCIDENT RESOLVED: System returned to nominal operating conditions. Incident [${prevIncident.type}] cleared.`, {
    resolvedAt,
    duration: Math.round((new Date(resolvedAt) - new Date(prevIncident.startedAt)) / 1000) + ' seconds'
  });

  // Log recovery events to console and file
  logger.info(`Recovery confirmation: All systems operational. Cleared down type: ${prevIncident.type}`);

  // Notify n8n Scribe for post-mortem logging (fire-and-forget)
  const resolvePayload = {
    type: prevIncident.type,
    startedAt: prevIncident.startedAt,
    resolvedAt,
    status: 'resolved',
    resolvedBy: 'manual',
  };
  sendWebhookNotification(N8N_WEBHOOKS.scribe, resolvePayload);

  // Broadcast SSE event to all connected frontend clients
  broadcastSSE('incident-update', {
    type: null,
    status: 'resolved',
    resolvedAt,
    previousType: prevIncident.type,
  });

  res.json({
    success: true,
    message: `Incident '${prevIncident.type}' resolved. Systems restored.`,
    incidentCleared: prevIncident,
    resolvedAt
  });
});

// Helper to execute Python RAG query via child process
const { exec } = require('child_process');

function getPythonCommand() {
  const venvWindows = path.join(__dirname, 'ai', 'venv', 'Scripts', 'python.exe');
  const venvUnix = path.join(__dirname, 'ai', 'venv', 'bin', 'python');
  if (fs.existsSync(venvWindows)) {
    return `"${venvWindows}"`;
  } else if (fs.existsSync(venvUnix)) {
    return `"${venvUnix}"`;
  }
  return 'python';
}

function getRAGContext(query) {
  return new Promise((resolve) => {
    const pythonScript = path.join(__dirname, 'ai', 'query.py');
    const safeQuery = query.replace(/"/g, '\\"');
    const pyCmd = getPythonCommand();
    exec(`${pyCmd} "${pythonScript}" "${safeQuery}"`, (error, stdout, stderr) => {
      if (error) {
        logger.error('RAG Query execution failed', { error: error.message, stderr });
        return resolve(null);
      }
      try {
        const results = JSON.parse(stdout.trim());
        if (results.error) {
          logger.error('RAG Python error response', { error: results.error });
          return resolve(null);
        }
        resolve(results);
      } catch (e) {
        logger.error('Failed to parse RAG output', { stdout, error: e.message });
        resolve(null);
      }
    });
  });
}

// Helper to fetch RAG runbook in the background and cache it on activeIncident state
function fetchAndCacheRAGContext(type) {
  if (!type) {
    activeIncident.ragContext = null;
    return;
  }
  const searchTerms = type.replace(/_/g, ' ');
  getRAGContext(searchTerms).then(ragResults => {
    if (ragResults && ragResults.length > 0) {
      const runbookMatches = ragResults
        .filter(r => r.metadata && r.metadata.source && r.metadata.source.includes('runbook'))
        .map(r => r.content.trim());
      if (runbookMatches.length > 0) {
        activeIncident.ragContext = runbookMatches[0];
        logger.info(`RAG runbook cached successfully for incident: ${type}`);
      } else {
        activeIncident.ragContext = null;
      }
    } else {
      activeIncident.ragContext = null;
    }
  }).catch(err => {
    logger.error('Failed to pre-fetch RAG runbook', { error: err.message });
    activeIncident.ragContext = null;
  });
}

// GET /api/incident/active - Retrieve current active incident status (smartly integrated with RAG context)
app.get('/api/incident/active', (req, res) => {
  if (activeIncident.type) {
    let severity = 'high';
    let rootCause = 'Analyzing logs for anomalous patterns...';
    let etaMinutes = 15;

    try {
      const runbooksPath = path.join(__dirname, 'runbooks.json');
      if (fs.existsSync(runbooksPath)) {
        const runbooks = JSON.parse(fs.readFileSync(runbooksPath, 'utf8'));
        const matched = runbooks.find(r => r.incident_type === activeIncident.type);
        if (matched) {
          severity = matched.severity;
          rootCause = matched.typical_causes[0] || rootCause;
          etaMinutes = matched.avg_resolution_minutes;
        }
      }
    } catch (err) {
      logger.error('Failed to load runbooks for active incident status', { error: err.message });
    }

    // Append cached RAG runbook solution if available
    if (activeIncident.ragContext) {
      rootCause = `${rootCause}\n\n[O.S.S. RAG Runbook Solution]:\n${activeIncident.ragContext}`;
    }

    return res.json({
      active: true,
      incident: {
        type: activeIncident.type,
        startedAt: activeIncident.startedAt,
        severity,
        rootCause,
        etaMinutes,
        affectedUserCount: activeIncident.affectedUserCount || 0
      }
    });
  }

  res.json({
    active: false,
    incident: null
  });
});

// POST /api/rag/retrieve - Manually query the RAG vector store
app.post('/api/rag/retrieve', async (req, res) => {
  const { query } = req.body;
  if (!query) {
    return res.status(400).json({ success: false, error: 'Query parameter is required' });
  }

  try {
    const results = await getRAGContext(query);
    if (!results) {
      return res.status(500).json({ success: false, error: 'Failed to retrieve RAG context' });
    }
    res.json({ success: true, results });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST /api/rag/ingest - Re-index runbooks and incidents into the vector store
app.post('/api/rag/ingest', (req, res) => {
  const pythonScript = path.join(__dirname, 'ai', 'rag', 'ingest.py');
  const pyCmd = getPythonCommand();
  exec(`${pyCmd} "${pythonScript}"`, (error, stdout, stderr) => {
    if (error) {
      logger.error('RAG Ingestion execution failed', { error: error.message, stderr });
      return res.status(500).json({ success: false, error: error.message, stderr });
    }
    res.json({ success: true, output: stdout.trim() });
  });
});


// POST /auto-heal - Auto-remediation endpoint triggered by Observer
app.post('/auto-heal', (req, res) => {
  const { type } = req.body;
  if (!activeIncident.type || activeIncident.type !== type) {
    logger.warn(`[Auto-Heal Engine]: Auto-heal requested for [${type}] but it does not match the active incident [${activeIncident.type}].`);
    return res.status(400).json({ success: false, error: 'No matching active incident found for auto-heal.' });
  }

  logger.warn(`[Auto-Heal Engine]: Received auto-heal trigger from Observer for [${type}]. Executing recovery script...`);

  // Map known incident types to remediation commands from runbooks
  let command = 'echo "Executing default recovery verification"';
  if (type === 'db_down') {
    command = 'touch /tmp/postgresql.trigger.5432';
  } else if (type === 'payment_down') {
    command = 'npm run reset-pool --max=100';
  } else if (type === 'api_timeout') {
    command = 'systemctl restart gateway-workers';
  }

  logger.info(`[Auto-Heal Engine]: Running recovery command: ${command}`);

  // Resolve the active incident state
  const prevIncident = { ...activeIncident };
  activeIncident.type = null;
  activeIncident.startedAt = null;
  activeIncident.affectedUserCount = 0;
  activeIncident.ragContext = null;

  logger.warn('Auto-remediation successful. Engineers never got paged.');

  // Notify n8n Scribe for post-mortem logging (fire-and-forget)
  const resolvedAt = new Date().toISOString();
  const resolvePayload = {
    type: prevIncident.type,
    startedAt: prevIncident.startedAt,
    resolvedAt,
    status: 'auto-healed',
    resolvedBy: 'commander',
    commandExecuted: command,
  };
  sendWebhookNotification(N8N_WEBHOOKS.scribe, resolvePayload);

  // Broadcast SSE event — auto-heal resolved the incident
  broadcastSSE('incident-update', {
    type: null,
    status: 'auto-healed',
    resolvedAt,
    previousType: prevIncident.type,
    commandExecuted: command,
  });

  res.json({
    success: true,
    message: 'Auto-remediation command executed. Incident resolved.',
    commandExecuted: command
  });
});




// POST /api/incident/update - Update active incident manually
app.post('/api/incident/update', (req, res) => {
  const { type, startedAt, affectedUserCount } = req.body;
  const supportedTypes = [
    'payment_down', 
    'db_down', 
    'api_timeout', 
    'high_error_rate', 
    'checkout_failure', 
    'authentication_failure', 
    'service_degradation', 
    'disk_space_critical', 
    'silent_error',
    null
  ];

  if (type !== undefined && type !== null && !supportedTypes.includes(type)) {
    logger.warn('Incident update rejected: Unsupported type', { type });
    return res.status(400).json({
      success: false,
      error: `Invalid incident type. Supported types: ${supportedTypes.filter(t => t !== null).join(', ')}`
    });
  }

  const prevType = activeIncident.type;
  
  if (type === null || type === undefined) {
    activeIncident.type = null;
    activeIncident.startedAt = null;
    activeIncident.affectedUserCount = 0;
    activeIncident.ragContext = null;
    logger.info(`Incident manually cleared via API (previous: ${prevType})`);
  } else if (type === 'silent_error') {
    // Generate logs to trigger pre-alerts, but keep incident state operational (null)
    logger.warn('INCIDENT SIMULATOR: Generating silent_error logs for pre-alert trigger');
    generateNoiseLogs('silent_error');
  } else {
    activeIncident.type = type;
    activeIncident.startedAt = startedAt || new Date().toISOString();
    activeIncident.affectedUserCount = affectedUserCount || 0;
    activeIncident.ragContext = null;
    fetchAndCacheRAGContext(type);
    logger.warn(`Incident manually updated/triggered via API to [${type}]`, { activeIncident });

    // Generate logs for this failure type if it's one of the simulated types
    if (['payment_down', 'db_down', 'api_timeout'].includes(type)) {
      generateNoiseLogs(type);
    }

    // Trigger n8n Commander for autonomous remediation (non-blocking)
    triggerCommander(type, activeIncident.startedAt);
  }

  // Broadcast SSE event for any incident update
  broadcastSSE('incident-update', {
    type: activeIncident.type,
    startedAt: activeIncident.startedAt,
    status: activeIncident.type ? 'active' : 'cleared',
  });

  res.json({
    success: true,
    message: 'Incident state updated successfully.',
    activeIncident
  });
});

// In-memory pre-alert state
let preAlert = null;

// POST /api/pre-alert - Set pre-alert details
app.post('/api/pre-alert', (req, res) => {
  preAlert = { ...req.body, detectedAt: Date.now() };
  logger.warn('PRE-ALERT STATUS: Active', { preAlert });

  // Broadcast SSE pre-alert event to all connected clients
  broadcastSSE('prealert-update', {
    active: true,
    preAlert,
  });

  res.json({ ok: true });
});

// GET /api/pre-alert - Fetch current pre-alert status
app.get('/api/pre-alert', (req, res) => {
  // Auto-expire after 5 minutes
  if (preAlert && Date.now() - preAlert.detectedAt > 5 * 60 * 1000) {
    preAlert = null;
  }
  res.json({ active: preAlert !== null, preAlert });
});


// ─── 1. /health endpoint (the watchdog probes this every cycle) ─────────────
app.get('/health', (req, res) => {
  const t0 = process.hrtime.bigint();
  try {
    db.prepare('SELECT 1').get();
    const dbLatencyMs = Number(process.hrtime.bigint() - t0) / 1e6;
    res.json({
      ok: true,
      dbLatencyMs: +dbLatencyMs.toFixed(1),
      uptime: process.uptime(),
    });
  } catch (err) {
    const dbLatencyMs = Number(process.hrtime.bigint() - t0) / 1e6;
    res.status(500).json({ ok: false, error: err.message, dbLatencyMs });
  }
});

// ─── 2. Metrics proxy (Shield UI keeps calling /api/metrics unchanged) ──────
app.get('/api/metrics', async (req, res) => {
  try {
    const r = await fetch('http://localhost:3100/metrics');
    res.json(await r.json());
  } catch (err) {
    res.status(503).json({ error: 'watchdog offline' });
  }
});

// ─── 3. Safe CPU stress route for testing (does NOT block the event loop) ───
const { spawn } = require('child_process');
app.post('/dev/stress-cpu', (req, res) => {
  const seconds = Math.min(parseInt(req.body.seconds || 5), 30);
  const cores = Math.max(1, require('os').cpus().length - 1);
  for (let i = 0; i < cores; i++) {
    spawn(process.execPath, ['-e',
      `const end=Date.now()+${seconds * 1000};while(Date.now()<end)Math.sqrt(Math.random());`
    ], { detached: true, stdio: 'ignore' }).unref();
  }
  res.json({ stressing: true, seconds, cores });
});

// ─── 4. Recovery handler for the pre-alert banner ───────────────────────────
app.post('/api/incident/prealert-clear', (req, res) => {
  preAlert = null;

  // Broadcast SSE pre-alert cleared event
  broadcastSSE('prealert-update', { active: false, preAlert: null });

  res.json({ cleared: true });
});


// ---------------------------------------------------------
// BANKING API ENDPOINTS (frontend-facing, customer-friendly)
// ---------------------------------------------------------

// Customer-friendly message map for incident types
const INCIDENT_CUSTOMER_MESSAGES = {
  payment_down:   'Payment services are temporarily unavailable. Your account has not been charged. Please try again shortly.',
  db_down:        'We are experiencing a brief technical issue. Your money is safe and no changes have been made to your account.',
  api_timeout:    'Our systems are responding slowly right now. Please wait a moment and try again.',
  high_error_rate: 'We are currently experiencing higher than normal traffic. Please try again in a few minutes.',
  checkout_failure:'Transaction processing is temporarily paused. No charges have been made to your account.',
  authentication_failure: 'Authentication services are momentarily unavailable. Please try again shortly.',
  service_degradation: 'Some services are temporarily degraded. Our team is actively working on a fix.',
  disk_space_critical: 'Our systems are under maintenance. Services will resume shortly.',
};

// POST /api/banking/transfer — Customer-facing transfer endpoint
app.post('/api/banking/transfer', async (req, res, next) => {
  const { amount, fromAccount, toAccount, beneficiaryId, remarks, method } = req.body;

  // Validate amount
  if (!amount || isNaN(Number(amount)) || Number(amount) <= 0) {
    logger.warn('Transfer rejected: invalid amount', { amount, requestId: req.id });
    return res.status(400).json({
      success: false,
      customerMessage: 'Please enter a valid transfer amount greater than ₹0.',
    });
  }

  const numAmount = Number(amount);

  // Handle active incident — customer-friendly response
  if (activeIncident.type && ['payment_down', 'db_down', 'api_timeout', 'checkout_failure', 'service_degradation'].includes(activeIncident.type)) {
    const customerMessage = INCIDENT_CUSTOMER_MESSAGES[activeIncident.type] ||
      'We are experiencing a temporary issue. Your account has not been charged. Please try again shortly.';

    logger.warn('[Banking API] Transfer blocked due to active incident', {
      incidentType: activeIncident.type,
      amount: numAmount,
      requestId: req.id,
    });

    // Simulate api_timeout latency before responding
    if (activeIncident.type === 'api_timeout') {
      await delay(3000);
    }

    return res.status(503).json({
      success: false,
      incidentActive: true,
      incidentType: activeIncident.type,
      customerMessage,
      etaMinutes: (() => {
        try {
          const runbooksPath = path.join(__dirname, 'runbooks.json');
          if (fs.existsSync(runbooksPath)) {
            const runbooks = JSON.parse(fs.readFileSync(runbooksPath, 'utf8'));
            const matched = runbooks.find(r => r.incident_type === activeIncident.type);
            return matched ? matched.avg_resolution_minutes : 10;
          }
        } catch (_) {}
        return 10;
      })(),
    });
  }

  // Process the transfer via existing payment logic
  try {
    const txId = `TXN-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;

    runDbQuery(() => {
      db.prepare('INSERT INTO payments (amount, status, transaction_id, created_at) VALUES (?, ?, ?, ?)')
        .run(numAmount, 'APPROVED', txId, new Date().toISOString());
    });

    logger.info('[Banking API] Transfer approved', {
      transactionId: txId,
      amount: numAmount,
      fromAccount,
      beneficiaryId,
      method: method || 'IMPS',
      requestId: req.id,
    });

    return res.json({
      success: true,
      transactionId: txId,
      amount: numAmount,
      message: `Transfer of ₹${numAmount.toLocaleString('en-IN')} processed successfully.`,
      timestamp: new Date().toISOString(),
      method: method || 'IMPS',
      status: 'APPROVED',
    });
  } catch (error) {
    // Do NOT surface technical error to customer
    logger.error('[Banking API] Transfer failed with internal error', {
      error: error.message,
      requestId: req.id,
    });
    return res.status(503).json({
      success: false,
      customerMessage: 'We encountered a temporary issue processing your transfer. Your account has not been debited. Please try again.',
      incidentActive: false,
    });
  }
});

// GET /api/banking/status — Lightweight service availability check
app.get('/api/banking/status', (req, res) => {
  if (activeIncident.type) {
    const customerMessage = INCIDENT_CUSTOMER_MESSAGES[activeIncident.type] ||
      'Banking services are temporarily limited. Our team is working on a fix.';

    let etaMinutes = 10;
    try {
      const runbooksPath = path.join(__dirname, 'runbooks.json');
      if (fs.existsSync(runbooksPath)) {
        const runbooks = JSON.parse(fs.readFileSync(runbooksPath, 'utf8'));
        const matched = runbooks.find(r => r.incident_type === activeIncident.type);
        if (matched) etaMinutes = matched.avg_resolution_minutes;
      }
    } catch (_) {}

    return res.json({
      available: false,
      incident: {
        type: activeIncident.type,
        startedAt: activeIncident.startedAt,
        customerMessage,
        etaMinutes,
        recoveryUnderway: true,
      },
    });
  }

  if (preAlert) {
    return res.json({
      available: true,
      preAlert: {
        message: 'We are monitoring a brief service interruption. Services remain available.',
        detectedAt: preAlert.detectedAt,
      },
      incident: null,
    });
  }

  res.json({ available: true, incident: null, preAlert: null });
});

// GET /api/incidents/stream — Server-Sent Events push channel
app.get('/api/incidents/stream', (req, res) => {
  const clientId = ++sseClientCounter;

  // SSE headers
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no'); // Disable Nginx buffering if proxied
  res.flushHeaders();

  // Register client
  sseClients.set(clientId, res);
  logger.info(`[SSE] Client connected: ${clientId} (total: ${sseClients.size})`);

  // Send current state immediately on connect
  const initialPayload = {
    type: activeIncident.type,
    startedAt: activeIncident.startedAt,
    status: activeIncident.type ? 'active' : 'idle',
    preAlert: preAlert || null,
  };
  res.write(`event: init\ndata: ${JSON.stringify(initialPayload)}\n\n`);

  // Heartbeat every 30s to prevent proxy timeouts
  const heartbeat = setInterval(() => {
    try {
      res.write(': heartbeat\n\n');
    } catch {
      clearInterval(heartbeat);
    }
  }, 30000);

  // Cleanup on disconnect
  req.on('close', () => {
    clearInterval(heartbeat);
    sseClients.delete(clientId);
    logger.info(`[SSE] Client disconnected: ${clientId} (total: ${sseClients.size})`);
  });
});


// POST /api/shield/chat - Interact with Shield assistant via n8n webhook (smartly enriched with dynamic RAG context)
app.post('/api/shield/chat', async (req, res) => {
  try {
    const originalMessage = req.body.message;
    
    // Fetch matching runbooks/context from RAG database dynamically based on the user's message
    try {
      const ragResults = await getRAGContext(originalMessage);
      if (ragResults && ragResults.length > 0) {
        const contextStr = ragResults
          .filter(r => r.metadata && r.metadata.source)
          .map(r => `[Source: ${path.basename(r.metadata.source)}]:\n${r.content.trim()}`)
          .join('\n\n');
        
        if (contextStr) {
          req.body.message = `${originalMessage}\n\n[System Search Reference]:\n${contextStr}`;
        }
      }
    } catch (ragErr) {
      logger.error('Dynamic RAG retrieval for chat query failed', { error: ragErr.message });
    }

    logger.info('Forwarding Shield Chat message to n8n webhook', { body: req.body });
    const response = await fetch(N8N_WEBHOOKS.shield, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(req.body)
    });

    const text = await response.text();
    let data;
    try {
      data = JSON.parse(text);
    } catch (parseErr) {
      data = { response: text || "Message received by Shield agent." };
    }
    
    res.json(data);
  } catch (err) {
    logger.error('Shield webhook error:', err);
    res.status(500).json({
      success: false,
      error: 'Failed to contact Shield agent'
    });
  }
});




// Generates simulated error burst logs for the active incident
function generateNoiseLogs(type) {
  const incidentLogs = {
    payment_down: [
      { level: 'error', message: 'Connection reset by peer on payment gateway socket' },
      { level: 'error', message: 'Credit card processing channel timed out: Retry 1 of 3' },
      { level: 'error', message: 'Credit card processing channel timed out: Retry 2 of 3' },
      { level: 'error', message: 'Credit card processing channel timed out: Retry 3 of 3' },
      { level: 'error', message: 'Payment gateway marked OFFLINE after maximum retries exhausted' }
    ],
    db_down: [
      { level: 'error', message: 'SQLite connection pool exhausted: locked database file' },
      { level: 'error', message: 'Database query failed for transaction log: disk I/O error' },
      { level: 'error', message: 'DB query failure: SELECT * FROM products WHERE stock > 0 (Connection lost)' },
      { level: 'error', message: 'Database driver reported unrecoverable error state: SqliteError: database is locked' },
      { level: 'error', message: 'Backend failing healthcheck: DB_CONNECTION_DOWN' }
    ],
    api_timeout: [
      { level: 'error', message: 'Timeout calling downstream partner API (inventory validation)' },
      { level: 'error', message: 'Downstream fulfillment response took longer than 2500ms threshold' },
      { level: 'warn', message: 'Circuit breaker state transitioning to OPEN for endpoint /fulfillment/create' },
      { level: 'error', message: 'Downstream integration service did not acknowledge order checkout payload' },
      { level: 'error', message: 'Downstream integration timeout: Gateway Timeout (504) returned to client' }
    ],
    silent_error: [
      { level: 'error', message: 'Gateway error in payment validation channel' },
      { level: 'error', message: 'Credit card processing channel timed out' },
      { level: 'error', message: 'Failed connection handshake to partner server' },
      { level: 'error', message: 'Socket connection reset' },
      { level: 'error', message: 'Fulfillment queue timeout: retry limit reached' }
    ]
  };

  const logsToGenerate = incidentLogs[type] || [];
  
  // Create a pool of simulated user IDs to assign to the noise logs
  const simulatedUserIds = [
    'usr_8f8e8a', 'usr_3a2b1c', 'usr_9d8e7f', 'usr_0a1b2c', 'usr_5f4e3d',
    'usr_7a8b9c', 'usr_2d3e4f', 'usr_1c2b3a', 'usr_6e5d4c', 'usr_4b3a2c'
  ];

  logsToGenerate.forEach((log, index) => {
    // Pick a user ID from the pool for each error log
    const userId = simulatedUserIds[index % simulatedUserIds.length];
    
    logger.log({
      level: log.level,
      message: `${log.message} (SIMULATED_NOISE_${index + 1})`,
      incidentType: type,
      noiseBurst: true,
      userId: userId // Include simulated userId
    });
  });
}

// ---------------------------------------------------------
// 7. Monitoring Endpoint
// ---------------------------------------------------------

// GET /api/logs - Retrieve last 20 log lines and activeIncident status
app.get('/api/logs', (req, res) => {
  try {
    if (!fs.existsSync(LOG_FILE)) {
      return res.json({
        activeIncident,
        logs: []
      });
    }

    const logData = fs.readFileSync(LOG_FILE, 'utf8');
    const lines = logData.split('\n').filter(line => line.trim() !== '');

    const parsedLogs = [];
    // Read from the end of the file up to 20 logs
    const limit = Math.min(lines.length, 20);
    for (let i = lines.length - 1; i >= lines.length - limit; i--) {
      try {
        const parsed = JSON.parse(lines[i]);
        parsedLogs.push(parsed);
      } catch (err) {
        // Handle malformed log lines safely
        parsedLogs.push({
          raw: lines[i],
          parseError: 'Malformed JSON line format',
          timestamp: new Date().toISOString()
        });
      }
    }

    res.json({
      activeIncident,
      logs: parsedLogs
    });
  } catch (error) {
    logger.error('Failed to read and parse logs', { error: error.message });
    res.status(500).json({ success: false, error: 'Failed to read logs.' });
  }
});

// ---------------------------------------------------------
// 8. Global Error Handler
// ---------------------------------------------------------
app.use((err, req, res, next) => {
  const statusCode = err.message.includes('SqliteError') ? 500 : (res.statusCode !== 200 ? res.statusCode : 500);
  
  logger.error('Unhandled Server Error', {
    requestId: req.id,
    error: err.message,
    stack: err.stack,
    url: req.originalUrl,
    method: req.method
  });

  res.status(statusCode).json({
    success: false,
    error: 'Internal Server Error',
    message: err.message
  });
});

// Start Server
app.listen(PORT, () => {
  logger.info(`Server successfully started on port ${PORT}`, {
    env: process.env.NODE_ENV || 'development',
    pid: process.pid
  });
});
