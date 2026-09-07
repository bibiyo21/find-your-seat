const {spawn} = require("node:child_process");
const path = require("node:path");

// Default admin credentials used by tests. Passed explicitly as env vars to
// each spawned server so tests never depend on (or clash with) a real .env.
const TEST_ADMIN_USERNAME = "test-admin";
const TEST_ADMIN_PASSWORD = "test-password-123";

// Spawns `node <script>` with the given env, waits until it answers HTTP
// requests, and returns {baseUrl, stop()}.
async function spawnServer(script, port, env) {
  const child = spawn(process.execPath, [path.join(__dirname, "..", script)], {
    env: {
      ...process.env,
      PORT: String(port),
      ADMIN_USERNAME: TEST_ADMIN_USERNAME,
      ADMIN_PASSWORD: TEST_ADMIN_PASSWORD,
      SESSION_SECRET: "test-session-secret",
      ...env
    },
    stdio: ["ignore", "pipe", "pipe"]
  });

  let output = "";
  child.stdout.on("data", d => output += d);
  child.stderr.on("data", d => output += d);

  const exitPromise = new Promise((_, reject) => {
    child.once("exit", code => {
      if (code !== null && code !== 0) reject(new Error(`${script} exited early (code ${code}):\n${output}`));
    });
  });

  const baseUrl = `http://127.0.0.1:${port}`;
  const deadline = Date.now() + 15000;
  let lastErr;
  while (Date.now() < deadline) {
    try {
      // "/" always responds (login or dashboard page) regardless of auth state.
      const r = await fetch(`${baseUrl}/`);
      if (r.status) return {baseUrl, stop: () => child.kill(), output: () => output};
    } catch (e) {
      lastErr = e;
    }
    await Promise.race([new Promise(r => setTimeout(r, 200)), exitPromise.catch(e => { throw e; })]);
  }
  child.kill();
  throw new Error(`${script} did not become ready in time: ${lastErr}\n${output}`);
}

// Logs in as the test admin and returns the session cookie header value to
// attach to subsequent authenticated requests.
async function loginAsTestAdmin(baseUrl) {
  const r = await fetch(`${baseUrl}/api/login`, {
    method: "POST",
    headers: {"Content-Type": "application/json"},
    body: JSON.stringify({username: TEST_ADMIN_USERNAME, password: TEST_ADMIN_PASSWORD})
  });
  if (!r.ok) throw new Error(`test admin login failed: ${await r.text()}`);
  const setCookie = r.headers.get("set-cookie");
  if (!setCookie) throw new Error("login succeeded but no session cookie was set");
  return setCookie.split(";")[0];
}

module.exports = {spawnServer, loginAsTestAdmin, TEST_ADMIN_USERNAME, TEST_ADMIN_PASSWORD};
