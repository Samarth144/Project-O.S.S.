/**
 * e2e.js — Project O.S.S pre-demo smoke test
 * Usage: node scripts/e2e.js
 * All 8 checks must PASS before going live.
 */

const B     = "http://localhost:3000";
const H     = { "Content-Type": "application/json" };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const post  = (p, b = {}) => fetch(B + p, { method: "POST", headers: H, body: JSON.stringify(b) });
const get   = p => fetch(B + p).then(r => r.json());

let failed = 0;
const check = (name, ok) => {
  console.log(ok ? "\x1b[32mPASS\x1b[0m" : "\x1b[31mFAIL\x1b[0m", name);
  if (!ok) failed++;
};

(async () => {
  console.log("\n\x1b[1m=== Project O.S.S — E2E Smoke Test ===\x1b[0m\n");

  // 1. Server is up
  check("health ok at start", (await fetch(B + "/health")).ok);

  // 2. Simulate a db_down incident
  await post("/simulate-failure", { type: "db_down" });
  await sleep(1000);

  // 3. Incident is active
  check("incident active", (await get("/api/incident/active")).active === true);

  // 4. /health returns 500 during incident
  check("health 500 during incident", (await fetch(B + "/health")).status === 500);

  // 5. Transfer is blocked during incident
  const t = await post("/api/banking/transfer", {
    fromAccount: "ACC-77492018",
    toAccount:   "ACC-99381042",
    amount:      1
  });
  check("transfer blocked during incident", t.status >= 500);
  const activeAfterTransfer = await get("/api/incident/active");
  check("affected user counted", activeAfterTransfer.incident?.affectedUserCount >= 1);

  // 6. Shield chat replies with something
  const c = await (await post("/api/shield/chat", { message: "Is my money safe?", sessionId: "e2e" })).json();
  check("shield chat replied", JSON.stringify(c).length > 20);

  // 7. Auto-heal clears the incident
  await post("/auto-heal", { type: "db_down" });
  await sleep(1000);
  check("incident cleared after auto-heal", (await get("/api/incident/active")).active === false);

  // 8. Health is green again
  check("health ok after heal", (await fetch(B + "/health")).ok);

  console.log("\n" + (failed === 0
    ? "\x1b[32m All checks passed — safe to demo!\x1b[0m"
    : "\x1b[31m " + failed + " check(s) failed — fix before demo.\x1b[0m") + "\n");

  process.exit(failed ? 1 : 0);
})();
