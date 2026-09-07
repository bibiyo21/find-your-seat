const test = require("node:test");
const {spawnServer, loginAsTestAdmin} = require("./spawn-server");
const {runApiSuite} = require("./api-suite");

// These tests need a real MongoDB connection string (Atlas, local mongod, etc).
// Set TEST_MONGODB_URI to run them, e.g.:
//   TEST_MONGODB_URI="mongodb://localhost:27017" npm test
// They create and delete their own disposable event, so they're safe to run
// against a shared/production URI too.
const mongoUri = process.env.TEST_MONGODB_URI || "";

test("server.js (MongoDB mode)", {skip: !mongoUri && "set TEST_MONGODB_URI to run MongoDB tests"}, async () => {
  const server = await spawnServer("server.js", 39233, {MONGODB_URI: mongoUri});
  try {
    const cookie = await loginAsTestAdmin(server.baseUrl);
    await runApiSuite(server.baseUrl, cookie);
  } finally {
    server.stop();
  }
});
