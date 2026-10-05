'use strict';

const { spawn } = require('node:child_process');

const port = process.env.PORT || '3000';
const env = {
  ...process.env,
  PORT: port,
  INTERNAL_API_URL: process.env.INTERNAL_API_URL || `http://127.0.0.1:${port}`,
  WATCHDOG_URL: process.env.WATCHDOG_URL || 'http://127.0.0.1:3100',
  WATCHDOG_PORT: process.env.WATCHDOG_PORT || '3100',
  WATCHDOG_HOST: process.env.WATCHDOG_HOST || '127.0.0.1',
  OBSERVER_WEBHOOK: process.env.OBSERVER_WEBHOOK || process.env.N8N_OBSERVER_WEBHOOK || 'http://localhost:5678/webhook/Observer',
  APP_URL: process.env.APP_URL || `http://127.0.0.1:${port}`,
};

const children = new Map();
let shuttingDown = false;
let shutdownTimer;

function shutdown(exitCode, signal) {
  if (shuttingDown) return;
  shuttingDown = true;

  for (const child of children.keys()) {
    if (child.exitCode === null && child.signalCode === null) child.kill(signal);
  }

  shutdownTimer = setTimeout(() => {
    for (const child of children.keys()) {
      if (child.exitCode === null && child.signalCode === null) child.kill('SIGKILL');
    }
    process.exit(exitCode);
  }, 10000);
  shutdownTimer.unref();

  if (children.size === 0) {
    clearTimeout(shutdownTimer);
    process.exit(exitCode);
  }
}

for (const [name, script] of [['api', 'server.js'], ['watchdog', 'telemetry-watchdog.js']]) {
  const child = spawn(process.execPath, [script], { env, stdio: 'inherit' });
  children.set(child, name);

  child.on('error', (error) => {
    console.error(`[container] Failed to start ${name}:`, error);
    shutdown(1, 'SIGTERM');
  });

  child.on('exit', (code, signal) => {
    children.delete(child);
    if (!shuttingDown) {
      console.error(`[container] ${name} exited unexpectedly (code=${code}, signal=${signal})`);
      shutdown(code || 1, 'SIGTERM');
    } else if (children.size === 0) {
      clearTimeout(shutdownTimer);
      process.exitCode = code || 0;
    }
  });
}

for (const signal of ['SIGTERM', 'SIGINT']) {
  process.on(signal, () => shutdown(0, signal));
}
