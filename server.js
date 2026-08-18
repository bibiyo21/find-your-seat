const express = require("express");
const multer = require("multer");
const XLSX = require("xlsx");
const Database = require("better-sqlite3");
const path = require("path");
const fs = require("fs");
const QRCode = require("qrcode");

const app = express();
const PORT = process.env.PORT || 3000;
const db = new Database(path.join(__dirname, "wedding.sqlite"));
const upload = multer({ dest: path.join(__dirname, "uploads") });

app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

db.exec(`
CREATE TABLE IF NOT EXISTS events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS tables (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  event_id INTEGER NOT NULL,
  table_number TEXT NOT NULL,
  seats INTEGER NOT NULL DEFAULT 0,
  UNIQUE(event_id, table_number),
  FOREIGN KEY(event_id) REFERENCES events(id) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS guests (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  event_id INTEGER NOT NULL,
  name TEXT NOT NULL,
  table_number TEXT,
  seat_number INTEGER,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(event_id) REFERENCES events(id) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS check_ins (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  event_id INTEGER NOT NULL,
  guest_id INTEGER NOT NULL,
  checked_in_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(event_id) REFERENCES events(id) ON DELETE CASCADE,
  FOREIGN KEY(guest_id) REFERENCES guests(id) ON DELETE CASCADE
);
`);

const normalize = s => String(s ?? "").trim().toLowerCase().replace(/[^a-z0-9]/g, "");

function findColumn(headers, candidates) {
  const normalized = headers.map(h => ({raw:h, n:normalize(h)}));
  for (const c of candidates) {
    const hit = normalized.find(h => h.n === normalize(c) || h.n.includes(normalize(c)));
    if (hit) return hit.raw;
  }
  return null;
}

app.get("/api/events", (req,res) => {
  res.json(db.prepare(`
    SELECT e.id,e.name,e.created_at,
      (SELECT COUNT(*) FROM guests g WHERE g.event_id=e.id) guest_count,
      (SELECT COALESCE(SUM(t.seats),0) FROM tables t WHERE t.event_id=e.id) seat_count,
      (SELECT COUNT(*) FROM tables t WHERE t.event_id=e.id) table_count
    FROM events e ORDER BY e.id DESC
  `).all());
});

app.post("/api/events", (req,res) => {
  const name = String(req.body.name || "").trim();
  if (!name) return res.status(400).json({error:"Event name is required"});
  const result = db.prepare("INSERT INTO events(name) VALUES(?)").run(name);
  res.json({id:Number(result.lastInsertRowid),name});
});

app.get("/api/events/:id", (req,res) => {
  const id = Number(req.params.id);
  const event = db.prepare("SELECT * FROM events WHERE id=?").get(id);
  if (!event) return res.status(404).json({error:"Event not found"});
  const tables = db.prepare("SELECT * FROM tables WHERE event_id=? ORDER BY table_number").all(id);
  const guests = db.prepare("SELECT * FROM guests WHERE event_id=? ORDER BY name").all(id);
  res.json({event,tables,guests});
});

app.post("/api/events/:id/import", upload.single("file"), (req,res) => {
  const eventId = Number(req.params.id);
  if (!req.file) return res.status(400).json({error:"Excel file is required"});
  try {
    const wb = XLSX.readFile(req.file.path, {cellDates:true});
    const ws = wb.Sheets[wb.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(ws, {defval:""});
    if (!rows.length) throw new Error("The first worksheet is empty.");

    const headers = Object.keys(rows[0]);
    const nameCol = findColumn(headers, ["name","guest","guest name","fullname","full name"]);
    const tableCol = findColumn(headers, ["table","table number","table no","table #","seat table"]);
    const seatCol = findColumn(headers, ["seat","seat number","seat no","seat #"]);

    if (!nameCol) throw new Error("Could not find a guest name column. Use a header such as Name or Guest Name.");
    if (!tableCol) throw new Error("Could not find a table column. Use a header such as Table or Table Number.");

    const insertGuest = db.prepare("INSERT INTO guests(event_id,name,table_number,seat_number) VALUES(?,?,?,?)");
    const upsertTable = db.prepare(`
      INSERT INTO tables(event_id,table_number,seats) VALUES(?,?,?)
      ON CONFLICT(event_id,table_number) DO UPDATE SET seats=excluded.seats
    `);

    const counts = new Map();
    const parsed = [];
    for (const row of rows) {
      const name = String(row[nameCol] ?? "").trim();
      const table = String(row[tableCol] ?? "").trim();
      if (!name || !table) continue;
      const seatRaw = seatCol ? String(row[seatCol] ?? "").trim() : "";
      const seat = seatRaw && Number.isFinite(Number(seatRaw)) ? Number(seatRaw) : null;
      parsed.push({name,table,seat});
      counts.set(table,(counts.get(table)||0)+1);
    }
    if (!parsed.length) throw new Error("No usable rows found.");

    const tx = db.transaction(() => {
      db.prepare("DELETE FROM guests WHERE event_id=?").run(eventId);
      db.prepare("DELETE FROM tables WHERE event_id=?").run(eventId);
      for (const [table,count] of counts) upsertTable.run(eventId,table,count);
      for (const g of parsed) insertGuest.run(eventId,g.name,g.table,g.seat);
    });
    tx();

    res.json({imported:parsed.length, tables:counts.size, seatTotals:[...counts.values()].reduce((a,b)=>a+b,0)});
  } catch (e) {
    res.status(400).json({error:e.message});
  } finally {
    fs.unlink(req.file.path,()=>{});
  }
});

app.put("/api/events/:id/tables/:tableId", (req,res) => {
  const seats = Math.max(0, Number(req.body.seats));
  if (!Number.isInteger(seats)) return res.status(400).json({error:"Seats must be an integer"});
  db.prepare("UPDATE tables SET seats=? WHERE id=? AND event_id=?").run(seats,Number(req.params.tableId),Number(req.params.id));
  res.json({ok:true});
});

app.put("/api/events/:id/guests/:guestId", (req,res) => {
  const table = String(req.body.table_number ?? "").trim();
  const seat = req.body.seat_number == null || req.body.seat_number === "" ? null : Number(req.body.seat_number);
  db.prepare("UPDATE guests SET table_number=?, seat_number=? WHERE id=? AND event_id=?")
    .run(table, Number.isFinite(seat) ? seat : null, Number(req.params.guestId), Number(req.params.id));
  res.json({ok:true});
});

app.get("/api/events/:id/search", (req,res) => {
  const q = String(req.query.q || "").trim();
  if (!q) return res.json([]);
  res.json(db.prepare(`
    SELECT g.*, t.seats
    FROM guests g LEFT JOIN tables t ON t.event_id=g.event_id AND t.table_number=g.table_number
    WHERE g.event_id=? AND g.name LIKE ? ORDER BY g.name LIMIT 20
  `).all(Number(req.params.id), `%${q}%`));
});

app.get("/api/events/:id/qr", async (req,res) => {
  const eventId = Number(req.params.id);
  const event = db.prepare("SELECT * FROM events WHERE id=?").get(eventId);
  if (!event) return res.status(404).json({error:"Event not found"});
  try {
    const qrUrl = `${req.protocol}://${req.get('host')}/find-your-seat/${eventId}`;
    const qrCode = await QRCode.toDataURL(qrUrl);
    res.json({qrCode, url: qrUrl});
  } catch (e) {
    res.status(500).json({error:e.message});
  }
});

app.get("/find-your-seat", (req,res) => {
  res.sendFile(path.join(__dirname, "public", "checkin-select.html"));
});

app.get("/api/find-your-seat/events/list", (req,res) => {
  const events = db.prepare("SELECT id, name FROM events ORDER BY id DESC").all();
  res.json(events);
});

app.get("/find-your-seat/:eventId", (req,res) => {
  res.sendFile(path.join(__dirname, "public", "checkin.html"));
});

app.get("/api/find-your-seat/:eventId/guest", (req,res) => {
  const eventId = Number(req.params.eventId);
  const q = String(req.query.q || "").trim();
  if (!q) return res.json([]);
  const guests = db.prepare(`
    SELECT g.id, g.name, g.table_number, g.seat_number, t.seats,
      (SELECT COUNT(*) FROM check_ins WHERE guest_id=g.id) as checked_in
    FROM guests g 
    LEFT JOIN tables t ON t.event_id=g.event_id AND t.table_number=g.table_number
    WHERE g.event_id=? AND g.name LIKE ? 
    ORDER BY g.name LIMIT 20
  `).all(eventId, `%${q}%`);
  res.json(guests);
});

app.post("/api/find-your-seat/:eventId/guest/:guestId", (req,res) => {
  const eventId = Number(req.params.eventId);
  const guestId = Number(req.params.guestId);
  const guest = db.prepare("SELECT * FROM guests WHERE id=? AND event_id=?").get(guestId, eventId);
  if (!guest) return res.status(404).json({error:"Guest not found"});
  
  const existing = db.prepare("SELECT * FROM check_ins WHERE guest_id=?").get(guestId);
  if (existing) return res.json({already_checked_in: true, guest});
  
  db.prepare("INSERT INTO check_ins(event_id, guest_id) VALUES(?,?)").run(eventId, guestId);
  res.json({checked_in: true, guest});
});

app.listen(PORT,()=>console.log(`Wedding Seating Planner: http://localhost:${PORT}`));