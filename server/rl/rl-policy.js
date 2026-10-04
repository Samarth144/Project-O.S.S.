const fs = require('fs');
const path = require('path');

const POLICY_FILE = path.join(__dirname, 'policy.json');
const DEFAULT_ACTIONS = {
  db_down: ['reset_pool', 'restart_db_conn', 'failover_replica', 'clear_locks'],
  payment_down: ['reset_gateway_pool', 'switch_backup_gateway', 'flush_retry_queue'],
  api_timeout: ['restart_workers', 'scale_workers', 'shed_load'],
  high_error_rate: ['rollback_deploy', 'flush_cache', 'rate_limit_traffic']
};
const DEFAULT_ORDER = { ...DEFAULT_ACTIONS };
const COST = {
  reset_pool: 0.02, restart_db_conn: 0.02, failover_replica: 0.15, clear_locks: 0.02,
  reset_gateway_pool: 0.02, switch_backup_gateway: 0.15, flush_retry_queue: 0.02,
  restart_workers: 0.02, scale_workers: 0.02, shed_load: 0.15,
  rollback_deploy: 0.15, flush_cache: 0.02, rate_limit_traffic: 0.05
};

function emptyPolicy() {
  return Object.fromEntries(Object.entries(DEFAULT_ACTIONS).map(([type, actions]) => [type, {
    totalPulls: 0,
    actions: Object.fromEntries(actions.map(action => [action, { pulls: 0, totalReward: 0, successes: 0 }]))
  }]));
}
let policy = emptyPolicy();
let trainingCurves = {};
function savePolicy() { fs.writeFileSync(POLICY_FILE, JSON.stringify({ ...policy, trainingCurves }, null, 2)); }
function loadPolicy() {
  try {
    const stored = JSON.parse(fs.readFileSync(POLICY_FILE, 'utf8'));
    trainingCurves = stored.trainingCurves && typeof stored.trainingCurves === 'object'
      ? Object.fromEntries(Object.entries(stored.trainingCurves).filter(([type, curve]) => DEFAULT_ACTIONS[type] && Array.isArray(curve)).map(([type, curve]) => [type, curve]))
      : {};
    for (const [type, actions] of Object.entries(DEFAULT_ACTIONS)) {
      if (!stored[type]) continue;
      policy[type].totalPulls = Number(stored[type].totalPulls) || 0;
      for (const action of actions) {
        const old = stored[type].actions?.[action];
        if (old) policy[type].actions[action] = {
          pulls: Number(old.pulls) || 0,
          totalReward: Number(old.totalReward) || 0,
          successes: Number(old.successes) || 0
        };
      }
    }
  } catch (_) { savePolicy(); }
}
function reset() { policy = emptyPolicy(); trainingCurves = {}; savePolicy(); }
function setTrainingCurve(type, curve) {
  if (!DEFAULT_ACTIONS[type] || !Array.isArray(curve)) return;
  trainingCurves[type] = curve.map(({ episode, attempts, healed }) => ({
    episode: Number(episode),
    attempts: Number(attempts),
    healed: Boolean(healed),
  }));
  savePolicy();
}
function getTrainingCurves() { return Object.fromEntries(Object.entries(trainingCurves).map(([type, curve]) => [type, curve.map(point => ({ ...point }))])); }

function mulberry32(a) {
  return function() {
    let t = a += 0x6D2B79F5;
    t = Math.imul(t ^ t >>> 15, t | 1);
    t ^= t + Math.imul(t ^ t >>> 7, t | 61);
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}
let rng = mulberry32(1337);
function setSeed(value = 1337) { rng = mulberry32(Number(value) >>> 0); }

function choose(type, { mode = 'live', exclude = [] } = {}) {
  const actions = DEFAULT_ACTIONS[type];
  if (!actions) return null;
  const available = actions.filter(action => !exclude.includes(action));
  if (!available.length) return null;
  const data = policy[type];
  if (mode === 'live') {
    if (!data.totalPulls) return available[0];
    const explored = available.filter(action => data.actions[action].pulls > 0);
    if (!explored.length) return available[0];
    return explored.reduce((best, action) => {
      const a = data.actions[action], b = data.actions[best];
      const meanA = a.totalReward / a.pulls, meanB = b.totalReward / b.pulls;
      return meanA > meanB ? action : best;
    }, explored[0]);
  }
  const C = 0.5;
  const unpulled = available.find(action => policy[type].actions[action].pulls === 0);
  if (unpulled) return unpulled;
  return available.slice(1).reduce((best, action) => {
    const stats = data.actions[action];
    const bestStats = data.actions[best];
    const score = s => s.totalReward / s.pulls + C * Math.sqrt(2 * Math.log(Math.max(data.totalPulls, 1)) / s.pulls);
    return score(stats) > score(bestStats) ? action : best;
  }, available[0]);
}

function reward(type, action, success) {
  if (!policy[type]?.actions[action]) return null;
  const stats = policy[type].actions[action];
  const value = (success ? 1 : 0) - (COST[action] ?? 0.02);
  policy[type].totalPulls++;
  stats.pulls++;
  stats.totalReward += value;
  if (success) stats.successes++;
  savePolicy();
  return value;
}

function getStats() {
  return Object.fromEntries(Object.entries(policy).map(([type, data]) => [type, {
    totalPulls: data.totalPulls,
    actions: Object.fromEntries(Object.entries(data.actions).map(([action, stats]) => [action, {
      ...stats,
      successRate: stats.pulls ? stats.successes / stats.pulls : 0,
      meanReward: stats.pulls ? stats.totalReward / stats.pulls : 0
    }]))
  }]));
}

loadPolicy();
module.exports = { choose, reward, getStats, getTrainingCurves, setTrainingCurve, reset, setSeed, rng: () => rng(), actions: DEFAULT_ACTIONS, defaultOrder: DEFAULT_ORDER };
