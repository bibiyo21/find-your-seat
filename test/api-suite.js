// Shared integration test suite, run against a live server instance
// (either the SQLite or MongoDB backend) via HTTP. Exercises the core
// event/table/guest flows, including the floor plan / door-stage layout,
// the "Add Table" endpoint (with the decimal-seats bug fixed), and admin
// auth (every call here is authenticated via the session cookie passed in).
const assert = require("node:assert/strict");

async function runApiSuite(baseUrl, cookie) {
  async function api(path, opt = {}) {
    const headers = {...opt.headers, ...(cookie ? {Cookie: cookie} : {})};
    const r = await fetch(baseUrl + path, {...opt, headers});
    const text = await r.text();
    let json;
    try { json = text ? JSON.parse(text) : null; } catch { json = text; }
    return {status: r.status, ok: r.ok, body: json, headers: r.headers};
  }

  // Create event
  let res = await api("/api/events", {
    method: "POST",
    headers: {"Content-Type": "application/json"},
    body: JSON.stringify({name: "__Automated Test Event__"})
  });
  assert.equal(res.status, 200, "create event should succeed");
  const eventId = res.body.id;
  assert.ok(eventId, "created event should have an id");

  try {
    // Event shows up in list
    res = await api("/api/events");
    assert.ok(res.body.some(e => e.id === eventId || String(e.id) === String(eventId)), "new event listed");

    // Event details include layout defaults (door/stage null)
    res = await api(`/api/events/${eventId}`);
    assert.equal(res.status, 200);
    assert.equal(res.body.tables.length, 0);
    assert.equal(res.body.event.door_x, null);

    // Add a table with default seats (should default to 8)
    res = await api(`/api/events/${eventId}/tables`, {
      method: "POST",
      headers: {"Content-Type": "application/json"},
      body: JSON.stringify({table_number: "1"})
    });
    assert.equal(res.status, 200, "add table should succeed");
    assert.equal(res.body.seats, 8, "table should default to 8 seats");
    assert.equal(typeof res.body.id, "string", "table id must be a string (both backends) so the frontend can compare ids consistently");
    const table1Id = res.body.id;

    // Add a table with a decimal seat count (previously threw "Seats must be an integer")
    res = await api(`/api/events/${eventId}/tables`, {
      method: "POST",
      headers: {"Content-Type": "application/json"},
      body: JSON.stringify({table_number: "2", seats: 9.5, shape: "rectangle"})
    });
    assert.equal(res.status, 200, "add table with decimal seats should be rounded, not rejected");
    assert.equal(res.body.seats, 10, "9.5 seats should round to 10");
    assert.equal(res.body.shape, "rectangle");
    const table2Id = res.body.id;

    // VIP tables default to rectangle so they're visually distinct from round guest tables
    res = await api(`/api/events/${eventId}/tables`, {
      method: "POST",
      headers: {"Content-Type": "application/json"},
      body: JSON.stringify({table_number: "VIP 1"})
    });
    assert.equal(res.status, 200, "add VIP table should succeed");
    assert.equal(res.body.shape, "rectangle", "VIP tables should default to rectangle shape");

    // Duplicate table number should be rejected
    res = await api(`/api/events/${eventId}/tables`, {
      method: "POST",
      headers: {"Content-Type": "application/json"},
      body: JSON.stringify({table_number: "1"})
    });
    assert.equal(res.status, 400, "duplicate table number should be rejected");

    // Update table position + shape (floor plan drag)
    res = await api(`/api/events/${eventId}/tables/${table1Id}`, {
      method: "PUT",
      headers: {"Content-Type": "application/json"},
      body: JSON.stringify({x: 123.7, y: 45, shape: "rectangle"})
    });
    assert.equal(res.status, 200, "table position/shape update should succeed");

    // Update table seats with a decimal value (previously threw an error)
    res = await api(`/api/events/${eventId}/tables/${table1Id}`, {
      method: "PUT",
      headers: {"Content-Type": "application/json"},
      body: JSON.stringify({seats: 7.2})
    });
    assert.equal(res.status, 200, "decimal seat update should be rounded, not rejected");

    res = await api(`/api/events/${eventId}`);
    assert.ok(res.body.tables.every(t => typeof t.id === "string"), "all table ids in GET /api/events/:id must be strings");
    const t1 = res.body.tables.find(t => t.id === table1Id);
    assert.ok(t1, "table 1 should exist and be found via strict id equality, like the frontend does");
    assert.equal(t1.shape, "rectangle");
    assert.equal(Math.round(t1.x), 124);
    assert.equal(t1.seats, 7);

    // Update venue layout (door + stage)
    res = await api(`/api/events/${eventId}/layout`, {
      method: "PUT",
      headers: {"Content-Type": "application/json"},
      body: JSON.stringify({door_x: 10, door_y: 20, stage_x: 300, stage_y: 40})
    });
    assert.equal(res.status, 200, "layout update should succeed");

    res = await api(`/api/events/${eventId}`);
    assert.equal(res.body.event.door_x, 10);
    assert.equal(res.body.event.stage_y, 40);

    // Import Excel (guests seated at table "1" and "3")
    const XLSX = require("xlsx");
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet([["Name","Table"],["Alice","1"],["Bob","3"],["Carol","VIP 2"]]);
    XLSX.utils.book_append_sheet(wb, ws, "Sheet1");
    const buf = XLSX.write(wb, {type: "buffer", bookType: "xlsx"});
    const form = new FormData();
    form.append("file", new Blob([buf], {type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"}), "guests.xlsx");
    let rawRes = await fetch(`${baseUrl}/api/events/${eventId}/import`, {method: "POST", body: form, headers: cookie ? {Cookie: cookie} : {}});
    const importBody = await rawRes.json();
    assert.equal(rawRes.status, 200, "excel import should succeed");
    assert.equal(importBody.imported, 3);

    res = await api(`/api/events/${eventId}`);
    const importedVipTable = res.body.tables.find(t => t.table_number === "VIP 2");
    assert.ok(importedVipTable, "VIP 2 table should have been created by the import");
    assert.equal(importedVipTable.shape, "rectangle", "VIP tables created via import should default to rectangle shape");
    const importedRegularTable = res.body.tables.find(t => t.table_number === "3");
    assert.equal(importedRegularTable.shape, "round", "regular tables created via import should default to round shape");

    // Excel export
    rawRes = await fetch(`${baseUrl}/api/events/${eventId}/export/excel`, {headers: cookie ? {Cookie: cookie} : {}});
    assert.equal(rawRes.status, 200, "excel export should succeed");
    assert.match(rawRes.headers.get("content-type") || "", /spreadsheetml/);

    // Guest search + reassign table
    res = await api(`/api/events/${eventId}/search?q=Alice`);
    assert.equal(res.status, 200);
    assert.equal(res.body.length, 1);
    assert.equal(typeof res.body[0].id, "string", "guest id must be a string");
    const aliceId = res.body[0].id;

    res = await api(`/api/events/${eventId}/guests/${aliceId}`, {
      method: "PUT",
      headers: {"Content-Type": "application/json"},
      body: JSON.stringify({table_number: "3", seat_number: ""})
    });
    assert.equal(res.status, 200, "guest reassignment should succeed");

    // Deleting a table should unassign its guests, not error
    res = await api(`/api/events/${eventId}`);
    const table3 = res.body.tables.find(t => t.table_number === "3");
    assert.ok(table3, "table 3 should have been auto-created by import");

    res = await api(`/api/events/${eventId}/tables/${table3.id}`, {method: "DELETE"});
    assert.equal(res.status, 200, "table delete should succeed");

    res = await api(`/api/events/${eventId}`);
    assert.ok(!res.body.tables.some(t => String(t.id) === String(table3.id)), "deleted table should be gone");
    const bobAndAlice = res.body.guests.filter(g => g.name === "Bob" || g.name === "Alice");
    assert.ok(bobAndAlice.every(g => !g.table_number), "guests at the deleted table should be unassigned");

    // QR code
    res = await api(`/api/events/${eventId}/qr`);
    assert.equal(res.status, 200);
    assert.match(res.body.qrCode, /^data:image\//);

    // Print page
    rawRes = await fetch(`${baseUrl}/events/${eventId}/print`, {headers: cookie ? {Cookie: cookie} : {}});
    assert.equal(rawRes.status, 200, "print page should be served");

    // --- Admin routes require auth; public guest routes don't ---
    const noAuth = await fetch(`${baseUrl}/api/events`);
    assert.equal(noAuth.status, 401, "admin route should reject requests without a session");

    const publicEventFetch = await fetch(`${baseUrl}/api/events/${eventId}`);
    assert.equal(publicEventFetch.status, 200, "GET /api/events/:id must stay public for the guest check-in page");

    const publicGuestSearch = await fetch(`${baseUrl}/api/events/${eventId}/guest?q=al`);
    assert.equal(publicGuestSearch.status, 200, "guest search must stay public for the guest check-in page");

    const publicCheckinPage = await fetch(`${baseUrl}/events/${eventId}`);
    assert.equal(publicCheckinPage.status, 200, "guest check-in page must stay public");
  } finally {
    // Clean up so the test never leaves residue behind, even against a real DB.
    await api(`/api/events/${eventId}`, {method: "DELETE"});
  }

  // Event should be gone after delete
  res = await api(`/api/events/${eventId}`);
  assert.equal(res.status, 404, "deleted event should 404");
}

module.exports = {runApiSuite};
