const {spawn} = require("node:child_process");
const path = require("node:path");

// Spawns `node <script>` with the given env, waits until it answers HTTP
// requests, and returns {baseUrl, stop()}.
async function spawnServer(script, port, env) {
  const child = spawn(process.execPath, [path.join(__dirname, "..", script)], {
    env: {...process.env, PORT: String(port), ...env},
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
      const r = await fetch(`${baseUrl}/api/events`);
      if (r.ok || r.status === 500) return {baseUrl, stop: () => child.kill(), output: () => output};
    } catch (e) {
      lastErr = e;
    }
    await Promise.race([new Promise(r => setTimeout(r, 200)), exitPromise.catch(e => { throw e; })]);
  }
  child.kill();
  throw new Error(`${script} did not become ready in time: ${lastErr}\n${output}`);
}

module.exports = {spawnServer};
