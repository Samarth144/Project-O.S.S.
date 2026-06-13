const express = require('express');
const Database = require('better-sqlite3');
const winston = require('winston');
const fetch = require('node-fetch');
const fs = require('fs');
const path = require('path');

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
  startedAt: null
};

// ---------------------------------------------------------
// 4. Middlewares & Helper Functions
// ---------------------------------------------------------
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

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
  let { type } = req.body;

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
    startedAt: new Date().toISOString()
  };

  logger.warn(`INCIDENT SIMULATOR: Activated failure event of type [${type}]`, { activeIncident });

  // Generate a burst of error logs (minimum 5 entries)
  generateNoiseLogs(type);

  // Send webhook notification to monitoring controller asynchronously
  const alertUrl = 'http://localhost:5678/webhook/Observer';
  const alertPayload = {
    type,
    timestamp: activeIncident.startedAt,
    source: 'mini-app',
    status: 'firing'
  };

  // Trigger non-blocking async webhook
  sendWebhookNotification(alertUrl, alertPayload);

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

  // Send webhook notification asynchronously
  const resolveUrl = 'http://localhost:5678/webhook/Scribe';
  const resolvePayload = {
    type: prevIncident.type,
    startedAt: prevIncident.startedAt,
    resolvedAt,
    status: 'resolved'
  };

  // Trigger non-blocking async webhook
  sendWebhookNotification(resolveUrl, resolvePayload);

  res.json({
    success: true,
    message: `Incident '${prevIncident.type}' resolved. Systems restored.`,
    incidentCleared: prevIncident,
    resolvedAt
  });
});

// GET /api/incident/active - Retrieve current active incident status
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

    return res.json({
      active: true,
      incident: {
        type: activeIncident.type,
        startedAt: activeIncident.startedAt,
        severity,
        rootCause,
        etaMinutes
      }
    });
  }

  res.json({
    active: false,
    incident: null
  });
});


// POST /api/incident/update - Update active incident manually
app.post('/api/incident/update', (req, res) => {
  const { type, startedAt } = req.body;
  const supportedTypes = [
    'payment_down', 
    'db_down', 
    'api_timeout', 
    'high_error_rate', 
    'checkout_failure', 
    'authentication_failure', 
    'service_degradation', 
    'disk_space_critical', 
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
    logger.info(`Incident manually cleared via API (previous: ${prevType})`);
  } else {
    activeIncident.type = type;
    activeIncident.startedAt = startedAt || new Date().toISOString();
    logger.warn(`Incident manually updated/triggered via API to [${type}]`, { activeIncident });
    
    // Generate logs for this failure type if it's one of the simulated types
    if (['payment_down', 'db_down', 'api_timeout'].includes(type)) {
      generateNoiseLogs(type);
    }
  }

  res.json({
    success: true,
    message: 'Incident state updated successfully.',
    activeIncident
  });
});

// POST /api/shield/chat - Interact with Shield assistant via n8n webhook
app.post('/api/shield/chat', async (req, res) => {
  try {
    logger.info('Forwarding Shield Chat message to n8n webhook', { body: req.body });
    const response = await fetch('http://localhost:5678/webhook/Shield', {
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
    ]
  };

  const logsToGenerate = incidentLogs[type] || [];
  logsToGenerate.forEach((log, index) => {
    // Artificially space the log calls or execute synchronously to generate logs immediately
    logger.log({
      level: log.level,
      message: `${log.message} (SIMULATED_NOISE_${index + 1})`,
      incidentType: type,
      noiseBurst: true
    });
  });
}

// ---------------------------------------------------------
// 7. Monitoring Endpoint
// ---------------------------------------------------------

// GET /api/logs - Retrieve last 50 log lines and activeIncident status
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
    // Read from the end of the file up to 50 logs
    const limit = Math.min(lines.length, 50);
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
