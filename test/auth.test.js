// Covers the admin login/logout flow and the public-vs-protected route split.
// server.js is an API-only backend now (the Next.js app in frontend/ renders
// the actual pages and asks GET /api/session whether it should show the
// dashboard or redirect to /login):
//   - GET /api/session reports the session state the frontend gates on
//   - wrong credentials are rejected, correct credentials establish a session
//   - admin API routes require that session; the public guest routes never do
//   - logging out ends the session
const test = require("node:test");
const assert = require("node:assert/strict");
const {spawnServer, TEST_ADMIN_USERNAME, TEST_ADMIN_PASSWORD} = require("./spawn-server");

test("admin login/logout gates the API session and admin routes", async () => {
  const server = await spawnServer("server.js", 39236, {SQLITE_PATH: "/tmp/wedding-test-auth.sqlite", MONGODB_URI: ""});
  try {
    // With no session, /api/session reports not authenticated.
    let r = await fetch(`${server.baseUrl}/api/session`);
    let body = await r.json();
    assert.equal(r.status, 200);
    assert.equal(body.authenticated, false);

    // Wrong credentials are rejected.
    r = await fetch(`${server.baseUrl}/api/login`, {
      method: "POST", headers: {"Content-Type": "application/json"},
      body: JSON.stringify({username: TEST_ADMIN_USERNAME, password: "wrong-password"})
    });
    assert.equal(r.status, 401, "wrong password should be rejected");

    // Admin API is blocked without a session.
    r = await fetch(`${server.baseUrl}/api/events`);
    assert.equal(r.status, 401);

    // Correct credentials log in and return a session cookie.
    r = await fetch(`${server.baseUrl}/api/login`, {
      method: "POST", headers: {"Content-Type": "application/json"},
      body: JSON.stringify({username: TEST_ADMIN_USERNAME, password: TEST_ADMIN_PASSWORD})
    });
    assert.equal(r.status, 200, "correct credentials should log in");
    const cookie = r.headers.get("set-cookie").split(";")[0];

    // /api/session now reports authenticated.
    r = await fetch(`${server.baseUrl}/api/session`, {headers: {Cookie: cookie}});
    body = await r.json();
    assert.equal(body.authenticated, true);

    // Admin API now works.
    r = await fetch(`${server.baseUrl}/api/events`, {headers: {Cookie: cookie}});
    assert.equal(r.status, 200, "admin route should work with a valid session");

    // Logging out ends the session.
    r = await fetch(`${server.baseUrl}/api/logout`, {method: "POST", headers: {Cookie: cookie}});
    assert.equal(r.status, 200);

    r = await fetch(`${server.baseUrl}/api/events`, {headers: {Cookie: cookie}});
    assert.equal(r.status, 401, "admin route should be blocked again after logout");
  } finally {
    server.stop();
    require("node:fs").rmSync("/tmp/wedding-test-auth.sqlite", {force: true});
  }
});
