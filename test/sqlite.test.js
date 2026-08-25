const test = require("node:test");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const {spawnServer} = require("./spawn-server");
const {runApiSuite} = require("./api-suite");

// Covers both `npm run dev` (which forces MONGODB_URI empty) and the
// automatic SQLite fallback `npm start` uses when MONGODB_URI isn't set.
test("server.js (SQLite backend)", async (t) => {
  const sqlitePath = path.join(os.tmpdir(), `wedding-test-${Date.now()}.sqlite`);
  const server = await spawnServer("server.js", 39231, {SQLITE_PATH: sqlitePath, MONGODB_URI: ""});
  try {
    await runApiSuite(server.baseUrl);
  } finally {
    server.stop();
    fs.rmSync(sqlitePath, {force: true});
  }
});
