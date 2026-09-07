// Focused persistence tests for the floor plan drag-and-drop interactions:
//   1. Moving a table persists its new location
//   2. Moving a guest onto a table persists the seat assignment
//   3. Dragging a guest off a table (unassigning) persists as "no table"
//   4. Moving the door/stage markers persists their new location
//
// These hit the same endpoints the browser's drag handlers call
// (public/floorplan.js), and re-fetch the event fresh each time to prove
// the change actually round-trips through the database rather than only
// existing in memory.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const {spawnServer, loginAsTestAdmin} = require("./spawn-server");

test("floor plan drag interactions persist to the database", async () => {
  const sqlitePath = path.join(os.tmpdir(), `wedding-test-floorplan-${Date.now()}.sqlite`);
  const server = await spawnServer("server.js", 39235, {SQLITE_PATH: sqlitePath, MONGODB_URI: ""});
  const baseUrl = server.baseUrl;

  try {
    const cookie = await loginAsTestAdmin(baseUrl);
    async function api(p, opt = {}) {
      const headers = {...opt.headers, Cookie: cookie};
      const r = await fetch(baseUrl + p, {...opt, headers});
      const text = await r.text();
      return {status: r.status, body: text ? JSON.parse(text) : null};
    }

    // Setup: event with two tables and one guest.
    let res = await api("/api/events", {
      method: "POST", headers: {"Content-Type": "application/json"},
      body: JSON.stringify({name: "__Floorplan Persistence Test__"})
    });
    const eventId = res.body.id;

    res = await api(`/api/events/${eventId}/tables`, {
      method: "POST", headers: {"Content-Type": "application/json"},
      body: JSON.stringify({table_number: "1", seats: 8})
    });

    await api(`/api/events/${eventId}/tables`, {
      method: "POST", headers: {"Content-Type": "application/json"},
      body: JSON.stringify({table_number: "2", seats: 8})
    });

    // Import one guest, unassigned to start.
    const XLSX = require("xlsx");
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([["Name","Table"],["Guest One","1"]]), "Sheet1");
    const buf = XLSX.write(wb, {type: "buffer", bookType: "xlsx"});
    const form = new FormData();
    form.append("file", new Blob([buf]), "guests.xlsx");
    await fetch(`${baseUrl}/api/events/${eventId}/import`, {method: "POST", body: form, headers: {Cookie: cookie}});
    // Import recreates tables, so re-fetch their (new) ids.
    res = await api(`/api/events/${eventId}`);
    const table1 = res.body.tables.find(t => t.table_number === "1");
    const guest = res.body.guests.find(g => g.name === "Guest One");
    assert.equal(guest.table_number, "1", "guest should start seated at table 1 from the import");

    // --- 1. Moving a table persists its new location ---
    res = await api(`/api/events/${eventId}/tables/${table1.id}`, {
      method: "PUT", headers: {"Content-Type": "application/json"},
      body: JSON.stringify({x: 542, y: 217})
    });
    assert.equal(res.status, 200, "moving a table should succeed");

    res = await api(`/api/events/${eventId}`); // fresh fetch, like reopening the page
    const movedTable = res.body.tables.find(t => t.id === table1.id);
    assert.equal(movedTable.x, 542, "table x position should be persisted");
    assert.equal(movedTable.y, 217, "table y position should be persisted");

    // --- 2. Moving a person onto a table persists the seat assignment ---
    res = await api(`/api/events/${eventId}/guests/${guest.id}`, {
      method: "PUT", headers: {"Content-Type": "application/json"},
      body: JSON.stringify({table_number: "2", seat_number: ""})
    });
    assert.equal(res.status, 200, "assigning a guest to a table should succeed");

    res = await api(`/api/events/${eventId}`);
    let movedGuest = res.body.guests.find(g => g.id === guest.id);
    assert.equal(movedGuest.table_number, "2", "guest should now be persisted at table 2");

    // --- 3. Dragging a person off a table unassigns them, persisted ---
    res = await api(`/api/events/${eventId}/guests/${guest.id}`, {
      method: "PUT", headers: {"Content-Type": "application/json"},
      body: JSON.stringify({table_number: "", seat_number: ""})
    });
    assert.equal(res.status, 200, "unassigning a guest should succeed");

    res = await api(`/api/events/${eventId}`);
    movedGuest = res.body.guests.find(g => g.id === guest.id);
    assert.ok(!movedGuest.table_number, "guest should now be persisted as unassigned");

    // --- 4. Moving the door and stage markers persists their location ---
    res = await api(`/api/events/${eventId}/layout`, {
      method: "PUT", headers: {"Content-Type": "application/json"},
      body: JSON.stringify({door_x: 33, door_y: 481})
    });
    assert.equal(res.status, 200, "moving the door should succeed");

    res = await api(`/api/events/${eventId}/layout`, {
      method: "PUT", headers: {"Content-Type": "application/json"},
      body: JSON.stringify({stage_x: 900, stage_y: 12})
    });
    assert.equal(res.status, 200, "moving the stage should succeed");

    res = await api(`/api/events/${eventId}`);
    assert.equal(res.body.event.door_x, 33, "door x should be persisted");
    assert.equal(res.body.event.door_y, 481, "door y should be persisted");
    assert.equal(res.body.event.stage_x, 900, "stage x should be persisted");
    assert.equal(res.body.event.stage_y, 12, "stage y should be persisted");

    await api(`/api/events/${eventId}`, {method: "DELETE"});
  } finally {
    server.stop();
    fs.rmSync(sqlitePath, {force: true});
  }
});
