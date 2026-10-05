const express = require('express');
const winston = require('winston');
const nodemailer = require('nodemailer');
const fetch = require('node-fetch');
const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');
let createClient;
try {
  createClient = require('@supabase/supabase-js').createClient;
} catch (_) {
  createClient = null;
}

const rlPolicy = require('./server/rl/rl-policy');

const SIMULATOR_PROBS = {
  db_down: { reset_pool: 0.3, restart_db_conn: 0.5, failover_replica: 0.85, clear_locks: 0.4 },
  payment_down: { reset_gateway_pool: 0.35, switch_backup_gateway: 0.9, flush_retry_queue: 0.5 },
  api_timeout: { restart_workers: 0.6, scale_workers: 0.8, shed_load: 0.45 },
  high_error_rate: { rollback_deploy: 0.9, flush_cache: 0.4, block_ip_range: 0.3 }
};

function applySimulatedFix(type, action) {
  // The hidden outcome belongs only to the simulator, never to the policy.
  const recovered = rlPolicy.rng() <= (SIMULATOR_PROBS[type]?.[action] ?? 0.5);
  return { type, action, healthy: recovered };
}

async function verifyRecovery(type, action, mode, simulatedIncident) {
  if (mode === 'train') return simulatedIncident?.type === type && simulatedIncident.healthy === true;
  return selfCheck();
}


// ---------------------------------------------------------
// Load .env file automatically if present (root or ai/)
// ---------------------------------------------------------
const candidateEnvPaths = [
  path.join(__dirname, '.env'),
  path.join(__dirname, 'ai', '.env'),
];
for (const envPath of candidateEnvPaths) {
  if (fs.existsSync(envPath)) {
    try {
      const envContent = fs.readFileSync(envPath, 'utf8');
      envContent.split(/\r?\n/).forEach(line => {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) return;
        const idx = trimmed.indexOf('=');
        if (idx !== -1) {
          const key = trimmed.slice(0, idx).trim();
          let val = trimmed.slice(idx + 1).trim();
          if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
            val = val.slice(1, -1);
          }
          if (!process.env[key]) {
            process.env[key] = val;
          }
        }
      });
    } catch (_) {}
  }
}

// ---------------------------------------------------------
// Supabase — Incident State Persistence
// Ensures activeIncident survives server restarts.
// ---------------------------------------------------------
const SUPABASE_URL = process.env.SUPABASE_URL || '';
const SUPABASE_KEY = process.env.SUPABASE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || '';
const supabase = (createClient && SUPABASE_URL && SUPABASE_KEY)
  ? createClient(SUPABASE_URL, SUPABASE_KEY)
  : null;

if (!supabase) {
  console.warn('[Supabase] SUPABASE_URL / SUPABASE_KEY not set — active_incidents table persistence disabled.');
} else {
  console.log(`[Supabase] Incident state persistence enabled (${SUPABASE_URL})`);
}

/**
 * Persists the current activeIncident to Supabase.
 * Called every time activeIncident is mutated.
 * Fire-and-forget — never blocks the request cycle.
 */
async function persistIncidentState(incident) {
  if (!supabase) return;
  try {
    if (!incident.type) {
      // Mark any previously active incident as resolved in Supabase
      await supabase
        .from('active_incidents')
        .update({ status: 'resolved', resolved_at: new Date().toISOString() })
        .eq('status', 'active');
    } else {
      // Upsert the active incident — use type+started_at as natural key
      const payload = {
        incident_type:   incident.type,
        started_at:      incident.startedAt,
        reporter_email:  incident.reporterEmail || null,
        status:          'active',
        source_of_truth: 'supabase',
        updated_at:      new Date().toISOString(),
      };
      
      const { error } = await supabase
        .from('active_incidents')
        .upsert(payload, { onConflict: 'incident_type,started_at' });

      if (error) {
        console.error('[Supabase] Failed to persist active_incident:', error.message);
      }
    }
  } catch (err) {
    console.error('[Supabase] Failed to persist incident state:', err.message);
  }
}

/**
 * On server startup, checks Supabase for any incident still marked active.
 * If found, restores it into in-memory activeIncident so the server
 * never wakes up blind after a crash or restart.
 */
async function restoreIncidentFromSupabase() {
  if (!supabase) return;
  try {
    const { data, error } = await supabase
      .from('active_incidents')
      .select('*')
      .eq('status', 'active')
      .order('started_at', { ascending: false })
      .limit(1)
      .single();

    if (error || !data) return; // No active incident — clean slate

    activeIncident.id              = data.incident_uuid || data.id?.toString() || crypto.randomUUID();
    activeIncident.incident_uuid   = activeIncident.id;
    activeIncident.type            = data.incident_type;
    activeIncident.startedAt       = data.started_at;
    activeIncident.reporterEmail   = data.reporter_email || 'restored@system';
    activeIncident.affectedUserCount = 0;
    activeIncident.affectedUsers   = [];
    activeIncident.ragContext      = null;
    activeIncident.healAttempts    = 0;

    console.warn(`[Supabase] ⚡ RESTORED active incident from Supabase: [${data.incident_type}] (started ${data.started_at})`);
    // Pre-warm RAG cache for the restored incident
    fetchAndCacheRAGContext(data.incident_type);
  } catch (err) {
    console.error('[Supabase] Failed to restore incident state:', err.message);
  }
}

// ---------------------------------------------------------
// SSE Subscriber Registry
// ---------------------------------------------------------
const sseClients = new Map(); // clientId -> res
let sseClientCounter = 0;

function broadcastSSE(eventName, data) {
  const payload = `event: ${eventName}\ndata: ${JSON.stringify(data)}\n\n`;
  for (const [id, res] of sseClients) {
    if (res.destroyed || res.writableEnded) {
      sseClients.delete(id);
      continue;
    }
    try {
      res.write(payload);
    } catch (err) {
      logger.warn(`SSE write failed for client ${id}`, { error: err.message });
      sseClients.delete(id);
    }
  }
}

const app = express();
const PORT = process.env.PORT || 3000;
const LOG_FILE = process.env.LOG_FILE || path.join(__dirname, 'project_oss.log');

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

const APOLOGY_RECIPIENTS = [
  'pranavjadhav1319@gmail.com',
  'pranavjadhav.kitcoek@gmail.com',
  'samarthkumbhar8734@gmail.com',
  'leciwit866@bitproy.com'
];
const smtpHost = process.env.SMTP_HOST;
const smtpPort = Number(process.env.SMTP_PORT || 587);
const mailTransporter = smtpHost ? nodemailer.createTransport({
  host: smtpHost,
  port: smtpPort,
  secure: process.env.SMTP_SECURE ? process.env.SMTP_SECURE === 'true' : smtpPort === 465,
  connectionTimeout: 10000,
  greetingTimeout: 10000,
  socketTimeout: 15000,
  auth: process.env.SMTP_USER && process.env.SMTP_PASS
    ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
    : undefined
}) : null;

async function sendIncidentApology(type, incident = {}) {
  if (!mailTransporter) {
    logger.warn('Incident apology email skipped: SMTP_HOST is not configured', { type });
    return;
  }
  const from = process.env.SMTP_FROM || process.env.SMTP_USER;
  if (!from) {
    logger.warn('Incident apology email skipped: set SMTP_FROM or SMTP_USER', { type });
    return;
  }
  const startedAt = incident.startedAt ? new Date(incident.startedAt) : null;
  const resolvedAt = incident.resolvedAt ? new Date(incident.resolvedAt) : new Date();
  const date = startedAt ? startedAt.toLocaleDateString() : '[date]';
  const startTime = startedAt ? startedAt.toLocaleTimeString() : '[start time]';
  const endTime = resolvedAt.toLocaleTimeString();
  const incidentId = incident.id || incident.incident_uuid || '[Incident ID]';
  const serviceNames = {
    payment_down: 'payment services',
    db_down: 'database services',
    api_timeout: 'app and API services',
    high_error_rate: 'banking services',
    checkout_failure: 'checkout services',
    authentication_failure: 'sign-in services',
    service_degradation: 'banking services',
    disk_space_critical: 'banking services'
  };
  const affectedServices = serviceNames[type] || `${type.replace(/_/g, ' ')} services`;
  const title = affectedServices.replace(/\b\w/g, letter => letter.toUpperCase());
  const affectedActivity = type === 'payment_down'
    ? 'some of your payments and transfers'
    : 'some banking services, including payments and transfers';
  const subject = `Our Apology for the ${title} Disruption - Nexa Bank`;
  const text = `Dear Customer,

We are sorry. On ${date}, between ${startTime} and ${endTime}, Nexa Bank's ${affectedServices} were disrupted, and ${affectedActivity} were delayed or could not be completed. We know how important it is to be able to move your money when you need to, and we did not meet the standard of service you expect from us. We sincerely apologise for the stress and inconvenience this caused.

The service has now been fully restored, and ${affectedServices} are working normally.

WHAT THIS MEANS FOR YOU
- Your account balance and funds were never at risk.
- Any transfer you chose to queue has been processed automatically. You can check its status under Transactions in the app.
- Any payment that did not complete will not result in a lasting debit. If any amount was temporarily held, it has been released or will be within [timeframe].
- Please check your transaction history before resubmitting any payment, as repeating one that shows as completed or queued could create a duplicate.

WHAT WENT WRONG AND WHAT WE ARE DOING
The disruption was caused by a technical fault in our ${affectedServices}. Our team identified the cause, applied a fix, and monitored the service closely to confirm it was stable before we declared it resolved. We take responsibility for the disruption, and we are carrying out a full review so we can strengthen our systems and reduce the chance of this happening again.

WE ARE HERE TO HELP
If you notice a transaction that looks incorrect, or an amount that has not been released, please contact us and we will look into it right away. You can ask Shield in the Nexa Bank app, or reach our Customer Care team at [phone number] or [support email], quoting the reference below.

For your security, Nexa Bank will never ask you for your PIN, password or one-time passcode by email, phone or message.

Thank you for your patience, and again, we are truly sorry. We value your trust and will work to earn it.

Sincerely,
Customer Care Team
Nexa Bank
Reference: ${incidentId}`;
  const html = `<div style="font-family:Arial,sans-serif;white-space:pre-wrap;line-height:1.5">${text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</div>`;
  const deliveries = await Promise.allSettled(APOLOGY_RECIPIENTS.map(async to =>
    mailTransporter.sendMail({ from, to, subject, text, html })
  ));
  deliveries.forEach((delivery, index) => {
    const recipient = APOLOGY_RECIPIENTS[index];
    if (delivery.status === 'fulfilled') {
      logger.info('Incident apology email sent', { type, recipient, messageId: delivery.value.messageId });
    } else {
      logger.error('Incident apology email failed', { type, recipient, error: delivery.reason?.message });
    }
  });
  return deliveries.every(delivery => delivery.status === 'fulfilled');
}

async function sendResolvedIncidentApology(incident, resolvedAt) {
  if (!incident?.type) return false;
  logger.info('Sending post-incident apology email', {
    type: incident.type,
    incidentId: incident.id || incident.incident_uuid
  });
  try {
    return await sendIncidentApology(incident.type, { ...incident, resolvedAt });
  } catch (error) {
    logger.error('Incident apology email handler failed', { type: incident.type, error: error.message });
    return false;
  }
}

let apologyOutboxRunning = false;
const OUTBOX_DIRECTORY = process.env.DATA_DIR || path.join(os.tmpdir(), 'project-oss-mail-data');
fs.mkdirSync(OUTBOX_DIRECTORY, { recursive: true });
const APOLOGY_OUTBOX_PATH = path.join(OUTBOX_DIRECTORY, 'apology-email-outbox.json');

function readApologyOutbox() {
  try {
    return JSON.parse(fs.readFileSync(APOLOGY_OUTBOX_PATH, 'utf8'));
  } catch (error) {
    if (error.code !== 'ENOENT') logger.error('Could not read apology email outbox', { error: error.message });
    return [];
  }
}

function writeApologyOutbox(jobs) {
  const temporaryPath = `${APOLOGY_OUTBOX_PATH}.tmp`;
  fs.writeFileSync(temporaryPath, JSON.stringify(jobs, null, 2));
  fs.renameSync(temporaryPath, APOLOGY_OUTBOX_PATH);
}

function queueResolvedIncidentApology(incident, resolvedAt) {
  if (!incident?.type) return;
  const incidentId = String(incident.id || incident.incident_uuid || crypto.randomUUID());
  const jobs = readApologyOutbox();
  if (!jobs.some(job => job.incident_id === incidentId)) {
    jobs.push({ incident_id: incidentId, incident_type: incident.type, incident, resolved_at: resolvedAt, status: 'pending', attempts: 0 });
    writeApologyOutbox(jobs);
  }
  logger.info('Incident apology email queued', { incidentId });
  setImmediate(processPendingApologyEmails);
}

async function processPendingApologyEmails() {
  if (apologyOutboxRunning) return;
  apologyOutboxRunning = true;
  try {
    while (true) {
      const jobs = readApologyOutbox();
      const job = jobs.find(item => item.status === 'pending');
      if (!job) break;
      job.status = 'sending';
      job.attempts = (job.attempts || 0) + 1;
      writeApologyOutbox(jobs);
      try {
        const sent = await sendResolvedIncidentApology(job.incident, job.resolved_at);
        if (!sent) throw new Error('One or more recipient deliveries failed or SMTP is not configured');
        const remainingJobs = readApologyOutbox().filter(item => item.incident_id !== job.incident_id);
        writeApologyOutbox(remainingJobs);
        logger.info('Queued incident apology email completed', { incidentId: job.incident_id });
      } catch (error) {
        const remainingJobs = readApologyOutbox();
        const failedJob = remainingJobs.find(item => item.incident_id === job.incident_id);
        if (failedJob) {
          failedJob.status = 'pending';
          failedJob.last_error = error.message;
          writeApologyOutbox(remainingJobs);
        }
        logger.error('Queued incident apology email retry scheduled', {
          incidentId: job.incident_id,
          error: error.message
        });
        const retryTimer = setTimeout(processPendingApologyEmails, Math.min(300000, 30000 * job.attempts));
        retryTimer.unref();
      }
    }
  } finally {
    apologyOutboxRunning = false;
  }
}

// Demo data stays in memory and resets whenever the server restarts.
const demoStore = {
  users: [{ username: 'admin', password: 'password123' }],
  products: [
    { id: 1, name: 'Quantum Processor Unit', price: 899.99, stock: 15 },
    { id: 2, name: 'Holographic Display V1', price: 349.99, stock: 30 },
    { id: 3, name: 'Superfluid Cooling Gel', price: 24.50, stock: 120 },
    { id: 4, name: 'Gravity Boots (Refurbished)', price: 149.99, stock: 8 },
  ],
  cartItems: [],
  payments: [],
  accounts: [
    { id: 'savings', name: 'Savings Account', account_number: '•••• 4521', balance: 1524890.50, ifsc: 'NEXA0001234' },
    { id: 'current', name: 'Current Account', account_number: '•••• 8873', balance: 987633.25, ifsc: 'NEXA0001234' },
  ],
};
let nextPaymentId = 1;

// ---------------------------------------------------------
// 3. Incident State Setup
// ---------------------------------------------------------
let activeIncident = {
  id: null,
  type: null, // 'payment_down' | 'db_down' | 'api_timeout' | null
  startedAt: null,
  reporterEmail: null,
  affectedUserCount: 0,
  affectedUsers: [],
  ragContext: null,
  healAttempts: 0
};

let resolving = false;

// ---------------------------------------------------------
// 4. Middlewares & Helper Functions
// ---------------------------------------------------------
// CORS — Allow frontend dev server (TanStack Start / Vite)
app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (origin) {
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

// In-memory demo data runner (preserves the simulated db_down incident behavior)
function runDbQuery(queryFn) {
  if (activeIncident.type === 'db_down') {
    const dbError = new Error('Simulated database connection unavailable');
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
      signal: AbortSignal.timeout(800), // 800ms fast timeout if n8n is offline
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
const WATCHDOG_URL = process.env.WATCHDOG_URL || 'http://localhost:3100';

// Trigger n8n Commander workflow to autonomously execute auto-heal
// Called non-blocking — Express never waits for Commander to finish
async function triggerCommander(incidentType, startedAt) {
  const payload = {
    type:       incidentType,
    startedAt:  startedAt || new Date().toISOString(),
    source:     'express-server',
      autoHealUrl: `${process.env.INTERNAL_API_URL || `http://localhost:${process.env.PORT || 3000}`}/auto-heal`,
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
}

// ---------------------------------------------------------
// 5. Business Endpoints
// ---------------------------------------------------------

// GET /products - Retrieve list of available products
app.get('/products', (req, res, next) => {
  try {
    const products = runDbQuery(() => demoStore.products.map(product => ({ ...product })));
    
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
    const user = runDbQuery(() => demoStore.users.find(candidate => candidate.username === username));

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
    const product = runDbQuery(() => demoStore.products.find(candidate => candidate.id === Number(productId)));

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
      const existing = demoStore.cartItems.find(item => item.product_id === Number(productId));
      if (existing) existing.quantity += Number(quantity);
      else demoStore.cartItems.push({ product_id: Number(productId), quantity: Number(quantity) });
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
    const cartItems = runDbQuery(() => demoStore.cartItems.map(item => {
      const product = demoStore.products.find(candidate => candidate.id === item.product_id);
      return product ? { ...item, name: product.name, price: product.price, stock: product.stock } : null;
    }).filter(Boolean));

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
      for (const item of cartItems) {
        const product = demoStore.products.find(candidate => candidate.id === item.product_id);
        if (product) product.stock -= item.quantity;
      }
      demoStore.cartItems = [];
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

    runDbQuery(() => demoStore.payments.push({
      id: nextPaymentId++, amount, status: 'APPROVED', transaction_id: txId, created_at: new Date().toISOString()
    }));

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
app.post('/simulate-failure', requireToken, (req, res) => {
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

  const incident_uuid = crypto.randomUUID();
  activeIncident = {
    id: incident_uuid,
    incident_uuid,
    type,
    startedAt: new Date().toISOString(),
    reporterEmail: reporterEmail || 'samarthkumbhar8734@gmail.com',
    affectedUserCount: 0,
    affectedUsers: [],
    ragContext: null,
    healAttempts: 0
  };
  persistIncidentState(activeIncident).catch(() => {}); // persist immediately — survive restarts
  fetchAndCacheRAGContext(type);

  logger.warn(`INCIDENT SIMULATOR: Activated failure event of type [${type}] (UUID: ${incident_uuid})`, { activeIncident });
  // Generate a burst of error logs (minimum 5 entries)
  generateNoiseLogs(type);

  // Notify n8n Observer (non-blocking fire-and-forget alert)
  const alertPayload = {
    incident_uuid,
    id: incident_uuid,
    type,
    timestamp: activeIncident.startedAt,
    started_at: activeIncident.startedAt,
    source: 'mini-app',
    status: 'firing',
    reporterEmail: activeIncident.reporterEmail,
    auto_heal: true,
  };
  sendWebhookNotification(N8N_WEBHOOKS.observer, alertPayload).catch(() => {});

  // Broadcast SSE event to all connected frontend clients
  broadcastSSE('incident-update', {
    incident_uuid,
    id: incident_uuid,
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


// ---------------------------------------------------------
// Incident Verification & Unified Resolution Engine
// ---------------------------------------------------------

/**
 * requireToken Middleware:
 * If INTERNAL_API_KEY is configured in environment, validates header.
 * If not set, allows local UI and testing requests without error.
 */
const OSS_TOKEN = process.env.OSS_TOKEN || 'dev-token';
function requireToken(req, res, next) {
  const token = req.headers['authorization'] || req.headers['x-api-key'] || req.headers['x-oss-token'];
  
  // 1. Check for dev demo token (Fix 3)
  if (req.get('x-oss-token') === OSS_TOKEN) {
    return next();
  }

  // 2. Check for upstream internal API key
  const expectedKey = process.env.INTERNAL_API_KEY;
  if (!expectedKey) return next();

  if (token === expectedKey || token === `Bearer ${expectedKey}`) {
    return next();
  }
  return res.status(401).json({ error: 'Unauthorized: Invalid or missing token.' });
}

/** The simulator's in-memory data store is available while the process is running. */
async function selfCheck() {
  return true;
}

let lastPolicyDecision = null;
async function tryHeal(type, mode = 'live', { emitSSE = mode === 'live', incident = null } = {}) {
  const exclude = [];
  const attempts = [];
  let healed = false;
  let action = null;
  for (let attempt = 1; attempt <= 2; attempt++) {
    action = rlPolicy.choose(type, { mode, exclude });
    if (!action) break;
    const simulatedIncident = mode === 'train' ? applySimulatedFix(type, action) : incident;
    const success = await verifyRecovery(type, action, mode, simulatedIncident);
    const reason = success ? 'verified recovery' : 'recovery verification failed';
    rlPolicy.reward(type, action, success);
    const result = { type, action, reason, success, attempt };
    attempts.push(result);
    lastPolicyDecision = { decision: action, evidence: `Attempt ${attempt} ${success ? 'verified recovery' : 'failed verification'}`, confidence: rlPolicy.getStats()[type]?.actions[action]?.successRate || 0, reason };
    logger.info('[Auto-Heal Engine]: Remediation attempt', result);
    if (emitSSE) broadcastSSE('heal_attempt', result);
    if (success) { healed = true; break; }
    exclude.push(action);
  }
  return { healed, action: healed ? action : null, attempts };
}

/**
 * resolveActiveIncident:
 * Unified resolution path for both manual engineer actions and automated auto-heal.
 * Uses mutex lock (resolving) to prevent duplicate executions and duplicate Scribe webhooks.
 */
async function resolveActiveIncident(how = 'manual', command = null) {
  if (!activeIncident.type || resolving) return null;
  resolving = true;
  try {
    const prevIncident = { ...activeIncident };
    const resolvedAt = new Date().toISOString();

    // Clear in-memory activeIncident state
    activeIncident.type = null;
    activeIncident.startedAt = null;
    activeIncident.affectedUserCount = 0;
    activeIncident.affectedUsers = [];
    activeIncident.ragContext = null;
    activeIncident.healAttempts = 0;

    // Persist cleared state to Supabase — survive restarts
    await persistIncidentState(activeIncident);

    const durationSec = prevIncident.startedAt
      ? Math.round((new Date(resolvedAt) - new Date(prevIncident.startedAt)) / 1000)
      : 0;

    logger.info(`INCIDENT RESOLVED (${how}): System returned to nominal operating conditions. Incident [${prevIncident.type}] cleared.`, {
      resolvedAt,
      how,
      duration: `${durationSec} seconds`,
      commandExecuted: command
    });

    // Build affected customer list for Scribe apology outreach
    const affectedList = (prevIncident.affectedUsers && prevIncident.affectedUsers.length > 0)
      ? prevIncident.affectedUsers
      : [prevIncident.reporterEmail || 'samarthkumbhar8734@gmail.com'];

    // Notify n8n Scribe for post-mortem logging (fire-and-forget)
    const resolvePayload = {
      incident_uuid: prevIncident.id,
      id: prevIncident.id,
      type: prevIncident.type,
      startedAt: prevIncident.startedAt,
      started_at: prevIncident.startedAt,
      resolvedAt,
      resolved_at: resolvedAt,
      status: how === 'auto-healed' ? 'auto-healed' : 'resolved',
      resolvedBy: how,
      commandExecuted: command || (how === 'auto-healed' ? 'auto-remediation' : 'manual-override'),
      reporterEmail: prevIncident.reporterEmail || 'samarthkumbhar8734@gmail.com',
      reporter_email: prevIncident.reporterEmail || 'samarthkumbhar8734@gmail.com',
      affected_users: affectedList,
      affected_emails: affectedList.join(', '),
      affected_user_count: (prevIncident.affectedUsers && prevIncident.affectedUsers.length) || 0,
    };
    sendWebhookNotification(N8N_WEBHOOKS.scribe, resolvePayload).catch(() => {});

    // Broadcast SSE event to all connected frontend clients
    broadcastSSE('incident-update', {
      incident_uuid: prevIncident.id,
      id: prevIncident.id,
      type: null,
      status: how === 'auto-healed' ? 'auto-healed' : 'resolved',
      resolvedAt,
      previousType: prevIncident.type,
      commandExecuted: command,
    });

    return { success: true, prevIncident, resolvedAt };
  } finally {
    resolving = false;
  }
}

// POST /resolve-incident - Manual engineer resolution override
app.post('/resolve-incident', requireToken, async (req, res) => {
  if (!activeIncident.type) {
    logger.warn('Resolve incident requested but no active incident running.');
    return res.status(400).json({ success: false, error: 'No active incident to resolve.' });
  }

  const prevType = activeIncident.type;
  const result = await resolveActiveIncident('manual');
  if (!result) {
    return res.status(409).json({ success: false, error: 'Resolution already in progress or incident already cleared.' });
  }

  queueResolvedIncidentApology(result.prevIncident, result.resolvedAt);

  res.json({
    success: true,
    healed: true,
    message: `Incident '${prevType}' manually resolved. Systems restored.`,
    incidentCleared: result.prevIncident,
    resolvedAt: result.resolvedAt
  });
});

// Helper to execute Python RAG query via child process
const { exec } = require('child_process');

function getPythonCommand() {
  if (process.env.PYTHON_BIN) return `"${process.env.PYTHON_BIN}"`;
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
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
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
        id: activeIncident.id,
        incident_uuid: activeIncident.id,
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
// POST /auto-heal - Auto-remediation endpoint with verification and escalation
app.post('/auto-heal', requireToken, async (req, res) => {
  try {
  if (!activeIncident.type) {
    logger.warn('[Auto-Heal Engine]: Auto-heal requested but no active incident running.');
    return res.json({ healed: false, reason: 'no active incident' });
  }

  let { type } = req.body || {};
  if (!type || (activeIncident.type && type !== activeIncident.type)) {
    type = activeIncident.type;
  }
  if (type === 'api_degradation') type = 'api_timeout';
  if (type === 'db_failure') type = 'db_down';

  const incomingId = req.body?.incident_uuid || req.body?.id;
  if (incomingId && !activeIncident.id) {
    activeIncident.id = incomingId;
    activeIncident.incident_uuid = incomingId;
  }

  const result = await tryHeal(type, 'live');
  activeIncident.healAttempts = (activeIncident.healAttempts || 0) + result.attempts.length;

  if (result.healed) {
    const healAttempts = activeIncident.healAttempts;
    const resolved = await resolveActiveIncident('auto-healed', result.action);
    if (!resolved) {
      return res.status(409).json({
        healed: false,
        reason: 'resolution already in progress or already cleared'
      });
    }
    queueResolvedIncidentApology(resolved.prevIncident, resolved.resolvedAt);
    logger.warn('Auto-remediation verified and successful. Engineers never got paged.');
    return res.json({
      healed: true,
      success: true,
      message: 'Auto-remediation command executed and verified. Incident resolved.',
      commandExecuted: result.action,
      healAttempts,
      resolvedAt: resolved.resolvedAt
    });
  } else {
    logger.warn(`[Auto-Heal Engine]: Escalation triggered - max heal attempts reached for [${type}]. Escalate to engineer.`);
    return res.status(409).json({
      healed: false,
      reason: 'max attempts, escalate to engineer',
      healAttempts: activeIncident.healAttempts,
      incidentType: type
    });
  }
  } catch (error) {
    logger.error('[Auto-Heal Engine]: Request failed without resolving the incident.', {
      error: error.message,
      stack: error.stack
    });
    if (!res.headersSent) {
      return res.status(500).json({ healed: false, error: 'Auto-heal failed. The incident remains active.' });
    }
  }
});


// ---------------------------------------------------------
// Self-Learning Remediation Policy API
// ---------------------------------------------------------
app.get('/api/policy', requireToken, (req, res) => {
  res.json({ stats: rlPolicy.getStats(), trainingCurves: rlPolicy.getTrainingCurves(), lastDecision: lastPolicyDecision });
});

app.get('/api/policy/recommendation', requireToken, (req, res) => {
  const { type } = req.query;
  if (!rlPolicy.actions[type]) return res.status(400).json({ error: 'unsupported type' });
  const action = rlPolicy.choose(type, { mode: 'live' });
  res.json({ type, recommendation: action });
});

app.post('/api/policy/train', requireToken, async (req, res) => {
  const { type, episodes = 50, seed = 1337 } = req.body || {};
  if (!type) return res.status(400).json({ error: 'type required' });
  if (!rlPolicy.actions[type]) return res.status(400).json({ error: 'unsupported type' });
  const count = Math.max(1, Math.min(500, Number.parseInt(episodes, 10) || 50));
  rlPolicy.setSeed(seed);
  const curve = [];
  for (let i = 0; i < count; i++) {
    // Each episode owns a simulated incident and emits no customer-facing events.
    const outcome = await tryHeal(type, 'train', { emitSSE: false, incident: { type, simulated: true } });
    const attempts = outcome.healed ? outcome.attempts.length : 3;
    curve.push({ episode: i + 1, attempts, healed: outcome.healed });
  }
  rlPolicy.setTrainingCurve(type, curve);
  res.json({ curve, stats: rlPolicy.getStats()[type], lastDecision: lastPolicyDecision });
});

app.post('/api/policy/reset', requireToken, (req, res) => {
  rlPolicy.reset();
  res.json({ success: true, stats: rlPolicy.getStats() });
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
    persistIncidentState(activeIncident).catch(() => {}); // persist cleared state
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
    if (req.body.healAttempts !== undefined) {
      activeIncident.healAttempts = req.body.healAttempts;
    }
    persistIncidentState(activeIncident).catch(() => {}); // persist active state
    fetchAndCacheRAGContext(type);
    logger.warn(`Incident manually updated/triggered via API to [${type}]`, { activeIncident });
    // Generate logs for this failure type if it's one of the simulated types
    if (['payment_down', 'db_down', 'api_timeout'].includes(type)) {
      generateNoiseLogs(type);
    }
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

  // If a simulated payment_down or db_down incident is active, report failure & latency breach to watchdog
  if (activeIncident && (activeIncident.type === 'payment_down' || activeIncident.type === 'db_down')) {
    return res.status(500).json({
      ok: false,
      error: activeIncident.type === 'payment_down'
        ? 'Payment gateway connection reset: socket failure'
        : 'Demo data service unavailable',
      dbLatencyMs: 2000.0,
      uptime: process.uptime(),
    });
  }

  // If a simulated api_timeout incident is active, report service timeout to watchdog
  if (activeIncident && activeIncident.type === 'api_timeout') {
    return res.status(500).json({
      ok: false,
      error: 'Downstream integration service timeout (504)',
      dbLatencyMs: 1600.0,
      uptime: process.uptime(),
    });
  }

  const dbLatencyMs = Number(process.hrtime.bigint() - t0) / 1e6;
  res.json({
    ok: true,
    dbLatencyMs: +dbLatencyMs.toFixed(1),
    uptime: process.uptime(),
  });
});

// ─── 2. Metrics proxy (Shield UI keeps calling /api/metrics unchanged) ──────
app.get('/api/metrics', async (req, res) => {
  try {
    const r = await fetch(`${WATCHDOG_URL}/metrics`, {
      signal: AbortSignal.timeout(600), // 600ms fast timeout if watchdog is offline
    });
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
    const customerEmail = req.body.userEmail || req.body.email || 'samarthkumbhar8734@gmail.com';
    if (!activeIncident.affectedUsers) {
      activeIncident.affectedUsers = [];
    }
    if (!activeIncident.affectedUsers.includes(customerEmail)) {
      activeIncident.affectedUsers.push(customerEmail);
      activeIncident.affectedUserCount = activeIncident.affectedUsers.length;

      // Broadcast real-time counter update to Ops dashboard
      broadcastSSE('incident-update', {
        incident_uuid: activeIncident.id,
        id: activeIncident.id,
        type: activeIncident.type,
        startedAt: activeIncident.startedAt,
        status: 'active',
        affectedUserCount: activeIncident.affectedUserCount,
      });
    }

    const customerMessage = INCIDENT_CUSTOMER_MESSAGES[activeIncident.type] ||
      'We are experiencing a temporary issue. Your account has not been charged. Please try again shortly.';

    logger.error('[Banking API] Transfer blocked due to active incident', {
      incidentType: activeIncident.type,
      amount: numAmount,
      userId: customerEmail,
      affectedCustomer: customerEmail,
      totalAffectedUsers: activeIncident.affectedUserCount,
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
    const fromAcctKey = fromAccount === 'current' ? 'current' : 'savings';
    let remainingBalance = 0;

    runDbQuery(() => {
      demoStore.payments.push({
        id: nextPaymentId++, amount: numAmount, status: 'APPROVED', transaction_id: txId,
        created_at: new Date().toISOString()
      });
      const account = demoStore.accounts.find(candidate => candidate.id === fromAcctKey);
      if (account) {
        account.balance = Math.max(0, account.balance - numAmount);
        remainingBalance = account.balance;
      }
    });

    logger.info('[Banking API] Transfer approved & balance deducted', {
      transactionId: txId,
      amount: numAmount,
      fromAccount: fromAcctKey,
      remainingBalance,
      beneficiaryId,
      method: method || 'IMPS',
      requestId: req.id,
    });

    return res.json({
      success: true,
      transactionId: txId,
      amount: numAmount,
      fromAccount: fromAcctKey,
      remainingBalance,
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

// GET /api/banking/accounts — Live account balances from in-memory demo data
app.get('/api/banking/accounts', (req, res) => {
  res.json({ success: true, accounts: demoStore.accounts.map(account => ({ ...account })) });
});

// GET /api/banking/transactions — Live recent transactions from in-memory demo data
app.get('/api/banking/transactions', (req, res) => {
  const list = demoStore.payments.slice(-20).reverse().map(payment => ({ ...payment }));
  res.json({ success: true, transactions: list });
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

  let cleanedUp = false;
  let heartbeat;
  const cleanup = () => {
    if (cleanedUp) return;
    cleanedUp = true;
    clearInterval(heartbeat);
    sseClients.delete(clientId);
    logger.info(`[SSE] Client disconnected: ${clientId} (total: ${sseClients.size})`);
  };

  // Send current state immediately on connect
  const initialPayload = {
    type: activeIncident.type,
    startedAt: activeIncident.startedAt,
    status: activeIncident.type ? 'active' : 'idle',
    preAlert: preAlert || null,
    affectedUserCount: activeIncident.affectedUserCount || 0,
  };
  try {
    res.write(`event: init\ndata: ${JSON.stringify(initialPayload)}\n\n`);
  } catch (err) {
    logger.warn(`[SSE] Initial write failed for client ${clientId}`, { error: err.message });
    cleanup();
    return;
  }

  // Heartbeat every 30s to prevent proxy timeouts
  heartbeat = setInterval(() => {
    if (res.destroyed || res.writableEnded) {
      cleanup();
      return;
    }
    try {
      res.write(': heartbeat\n\n');
    } catch (err) {
      logger.warn(`[SSE] Heartbeat failed for client ${clientId}`, { error: err.message });
      cleanup();
    }
  }, 30000);

  // Socket errors are emitted asynchronously, so listen for them explicitly.
  res.on('error', err => {
    logger.warn(`[SSE] Response error for client ${clientId}`, { error: err.message });
    cleanup();
  });
  res.on('close', cleanup);
  req.on('aborted', cleanup);
});


// POST /api/shield/chat - Interact with Shield assistant via n8n webhook (smartly enriched with dynamic RAG context)
app.post(['/api/shield/chat', '/api/chat', '/api/support/chat'], async (req, res) => {
  const originalMessage = req.body.message || '';
  let contextStr = '';
  
  // 1. Fast Context: Prioritize pre-cached incident RAG runbook if an incident is active (0ms)
  if (activeIncident?.ragContext) {
    contextStr = activeIncident.ragContext;
  }

  // 2. Fast Runbook lookup from local runbooks.json if no active incident runbook found
  if (!contextStr) {
    try {
      const runbooksPath = path.join(__dirname, 'runbooks.json');
      if (fs.existsSync(runbooksPath)) {
        const runbooks = JSON.parse(fs.readFileSync(runbooksPath, 'utf8'));
        const lower = originalMessage.toLowerCase();
        const matched = runbooks.find(rb => 
          lower.includes(rb.incident_type.replace(/_/g, ' ')) ||
          (lower.includes('payment') && rb.incident_type.includes('payment')) ||
          (lower.includes('database') && rb.incident_type.includes('db')) ||
          (lower.includes('timeout') && rb.incident_type.includes('timeout')) ||
          (lower.includes('broken') && activeIncident.type && rb.incident_type === activeIncident.type)
        );
        if (matched) {
          contextStr = `Incident Type: ${matched.incident_type}\nSummary: ${matched.user_message_template}\nRemediation Steps: ${matched.fix_steps.join('; ')}\nResolution ETA: ${matched.avg_resolution_minutes} minutes`;
        }
      }
    } catch (_) {}
  }

  // 3. Fallback: Quick RAG retrieval with strict 1.5s timeout so it NEVER blocks user chat
  if (!contextStr) {
    try {
      const ragResults = await Promise.race([
        getRAGContext(originalMessage),
        new Promise(resolve => setTimeout(() => resolve(null), 1500))
      ]);
      if (ragResults && ragResults.length > 0) {
        contextStr = ragResults
          .filter(r => r.metadata && r.metadata.source)
          .map(r => `[Source: ${path.basename(r.metadata.source)}]:\n${r.content.trim()}`)
          .join('\n\n');
      }
    } catch (ragErr) {
      logger.warn('Dynamic RAG retrieval skipped or timed out', { error: ragErr.message });
    }
  }

  const safetyDirective = "\n\n[Support Directive]: You are speaking directly to a retail banking customer. Reassure them with empathy that their funds and account are safe. Never mention internal commands, file paths, database queries, or runbook fix steps to customers.";

  if (contextStr) {
    req.body.message = `${originalMessage}\n\n[System Search Reference]:\n${contextStr}${safetyDirective}`;
  } else {
    req.body.message = `${originalMessage}${safetyDirective}`;
  }
  req.body.instruction = "Never mention internal commands, file paths, or runbook fix steps to customers.";

  // Attach active incident info to payload so n8n Shield Agent always has ground truth
  if (activeIncident?.type) {
    req.body.incident = {
      id: activeIncident.id,
      incident_uuid: activeIncident.id,
      incident_id: activeIncident.id,
      type: activeIncident.type,
      startedAt: activeIncident.startedAt,
      severity: activeIncident.type.includes('down') ? 'critical' : 'high',
      affectedUserCount: activeIncident.affectedUserCount || 0
    };
    req.body.incident_uuid = activeIncident.id;
    req.body.incident_id = activeIncident.id;
  }

  try {
    logger.info('Forwarding Shield Chat message to n8n webhook', { body: req.body });
    const response = await fetch(N8N_WEBHOOKS.shield, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(req.body),
      signal: AbortSignal.timeout(25000), // 25 seconds timeout for LLM
    });

    const text = await response.text();
    let parsed;
    try {
      parsed = JSON.parse(text);
    } catch (parseErr) {
      parsed = text;
    }

    const extractText = (val) => {
      if (!val) return '';
      if (typeof val === 'string') return val;
      if (Array.isArray(val)) return val.length ? extractText(val[0]) : '';
      if (typeof val === 'object') {
        return val.response || val.output || val.message || val.text || val.content || (val.json ? extractText(val.json) : '') || '';
      }
      return String(val);
    };

    const extracted = extractText(parsed);
    return res.json({ response: extracted || "Message received by Shield agent." });
  } catch (err) {
    logger.warn('Shield n8n webhook offline or timed out — using intelligent fallback', { error: err.message });
    
    const incType = activeIncident?.type ? activeIncident.type.replace(/_/g, ' ') : null;
    let fallbackAnswer = "Thank you for reaching out to Nexa Support. Our systems are currently operational. If you have any questions, please let us know.";
    if (incType) {
      fallbackAnswer = `Hi there,\n\nOur engineering team is currently addressing a **${incType}** issue. We're actively working on restoration and expect normal service shortly. Your account and funds remain completely secure.`;
    } else {
      fallbackAnswer = "I'm here to help. Our systems are operational and our team is monitoring all channels. Your account and funds remain secure. Please let me know how I can assist you.";
    }

    return res.json({
      success: true,
      response: fallbackAnswer,
      source: 'fallback'
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
      { level: 'error', message: 'Demo data service unavailable' },
      { level: 'error', message: 'Database query failed for transaction log: disk I/O error' },
      { level: 'error', message: 'DB query failure: SELECT * FROM products WHERE stock > 0 (Connection lost)' },
      { level: 'error', message: 'In-memory data service reported an unrecoverable error state' },
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

  const baseLogs = incidentLogs[type] || incidentLogs.silent_error;
  const logsToGenerate = [];
  while (logsToGenerate.length < 16) {
    logsToGenerate.push(...baseLogs);
  }
  logsToGenerate.length = 16;
  
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

// Start Server — restore any active incident from Supabase BEFORE accepting connections
app.listen(PORT, '0.0.0.0', async () => {
  logger.info(`Server successfully started on port ${PORT}`, {
    env: process.env.NODE_ENV || 'development',
    pid: process.pid
  });
  // Restore in-memory incident state from Supabase so the server never wakes up blind
  await restoreIncidentFromSupabase();
  // Retry email jobs whose previous process was interrupted during delivery.
  const pendingJobs = readApologyOutbox();
  let resetInterruptedJobs = false;
  for (const job of pendingJobs) {
    if (job.status === 'sending') {
      job.status = 'pending';
      resetInterruptedJobs = true;
    }
  }
  if (resetInterruptedJobs) writeApologyOutbox(pendingJobs);
  await processPendingApologyEmails();
});
