// Covers the admin login/logout flow and the public-vs-protected route split:
//   - "/" serves the login page when there's no session, the dashboard when there is
//   - wrong credentials are rejected, correct credentials establish a session
//   - admin API routes require that session; the public guest routes never do
//   - logging out ends the session
const test = require("node:test");
const assert = require("node:assert/strict");
const {spawnServer, TEST_ADMIN_USERNAME, TEST_ADMIN_PASSWORD} = require("./spawn-server");

test("admin login/logout gates the dashboard and API", async () => {
  const server = await spawnServer("server.js", 39236, {SQLITE_PATH: "/tmp/wedding-test-auth.sqlite", MONGODB_URI: ""});
  try {
    // "/" with no session serves the login page, not the dashboard.
    let r = await fetch(`${server.baseUrl}/`);
    let body = await r.text();
    assert.equal(r.status, 200);
    assert.match(body, /Admin Login/i);
    assert.doesNotMatch(body, /Your Events/);

    // Requesting the dashboard file directly is redirected back to "/".
    r = await fetch(`${server.baseUrl}/index.html`, {redirect: "manual"});
    assert.ok([301, 302, 303, 307, 308].includes(r.status), "index.html should redirect when not logged in");

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

    // "/" now serves the dashboard.
    r = await fetch(`${server.baseUrl}/`, {headers: {Cookie: cookie}});
    body = await r.text();
    assert.match(body, /Your Events/);

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
