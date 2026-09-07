require("dotenv").config();

const express = require("express");
const crypto = require("crypto");
const multer = require("multer");
const XLSX = require("xlsx");
const path = require("path");
const fs = require("fs");
const QRCode = require("qrcode");
const initSqlJs = require("sql.js");

// Uses MongoDB when MONGODB_URI is set (via the environment or a .env file),
// otherwise falls back to a local SQLite file automatically.
// `npm run dev` forces SQLite even if MONGODB_URI is set; `npm start` uses
// MongoDB when available, or the same SQLite fallback when it isn't.
const USE_MONGODB = process.env.MONGODB_URI ? true : false;

let db;
let mongoClient;
let SQL;

// MongoDB imports (only if using MongoDB)
let MongoClient, ObjectId;
if (USE_MONGODB) {
  const mongodb = require("mongodb");
  MongoClient = mongodb.MongoClient;
  ObjectId = mongodb.ObjectId;
}

const app = express();
// This process is now an API-only backend: the Next.js app in `frontend/`
// (dev server on :3000) proxies /api/* to it via `rewrites()` in
// frontend/next.config.js, so it defaults to a different port.
const PORT = process.env.PORT || 3001;
const MONGODB_URI = process.env.MONGODB_URI;

// Initialize database
async function initDB() {
  if (USE_MONGODB) {
    return await connectMongoDB();
  } else {
    return initSQLite();
  }
}

// MongoDB connection
async function connectMongoDB() {
  if (db) return db;
  
  if (!MONGODB_URI) {
    throw new Error("MONGODB_URI environment variable is not set");
  }
  
  mongoClient = new MongoClient(MONGODB_URI);
  await mongoClient.connect();
  db = mongoClient.db("wedding-planner");
  
  // Create collections if they don't exist
  const collections = await db.listCollections().toArray();
  const collectionNames = collections.map(c => c.name);
  
  if (!collectionNames.includes("events")) {
    await db.createCollection("events");
  }
  if (!collectionNames.includes("guests")) {
    await db.createCollection("guests");
  }
  if (!collectionNames.includes("tables")) {
    await db.createCollection("tables");
  }
  if (!collectionNames.includes("check_ins")) {
    await db.createCollection("check_ins");
  }
  
  return db;
}

// SQLite initialization
async function initSQLite() {
  if (db) return db;
  
  if (!SQL) {
    SQL = await initSqlJs();
  }
  
  const dbPath = process.env.SQLITE_PATH || path.join(__dirname, "wedding.sqlite");
  let data;
  
  try {
    data = fs.readFileSync(dbPath);
  } catch (e) {
    data = null;
  }
  
  db = new SQL.Database(data);
  
  // Create tables
  db.run(`
    CREATE TABLE IF NOT EXISTS events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      door_x REAL,
      door_y REAL,
      stage_x REAL,
      stage_y REAL
    );
    
    CREATE TABLE IF NOT EXISTS tables (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      event_id INTEGER NOT NULL,
      table_number TEXT,
      seats INTEGER,
      shape TEXT DEFAULT 'round',
      x REAL,
      y REAL,
      FOREIGN KEY (event_id) REFERENCES events(id)
    );
    
    CREATE TABLE IF NOT EXISTS guests (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      event_id INTEGER NOT NULL,
      name TEXT,
      table_number TEXT,
      seat_number INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (event_id) REFERENCES events(id)
    );
    
    CREATE TABLE IF NOT EXISTS check_ins (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      event_id INTEGER NOT NULL,
      guest_id INTEGER NOT NULL,
      checked_in_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (event_id) REFERENCES events(id),
      FOREIGN KEY (guest_id) REFERENCES guests(id)
    );
  `);
  
  // Migrate older databases missing newer columns
  for (const col of ["shape TEXT DEFAULT 'round'", "x REAL", "y REAL"]) {
    try { db.run(`ALTER TABLE tables ADD COLUMN ${col}`); } catch (e) { /* column already exists */ }
  }
  for (const col of ["door_x REAL", "door_y REAL", "stage_x REAL", "stage_y REAL"]) {
    try { db.run(`ALTER TABLE events ADD COLUMN ${col}`); } catch (e) { /* column already exists */ }
  }
  
  // Save database to file
  saveSQLiteDB();
  
  return db;
}

// Save SQLite database to file
function saveSQLiteDB() {
  if (!USE_MONGODB && db) {
    const data = db.export();
    const buffer = Buffer.from(data);
    fs.writeFileSync(process.env.SQLITE_PATH || path.join(__dirname, "wedding.sqlite"), buffer);
  }
}

// Use memory storage for Vercel (serverless environment)
const upload = multer({ storage: multer.memoryStorage() });

app.use(express.json());

// --- Admin authentication -------------------------------------------------
// The admin dashboard (event/table/guest management) requires a login,
// configured via ADMIN_USERNAME / ADMIN_PASSWORD in the environment or a
// .env file. The public guest experience (scanning a QR code to find a
// seat) stays fully open — see the specific routes marked "public" below.
//
// Auth is a signed cookie (HMAC over an expiry + a revocation epoch), not a
// server-side session store: on Vercel each request can land on a different
// serverless instance with its own memory, so an in-memory session store
// (e.g. express-session's default MemoryStore) would "forget" a login as
// soon as a request hit a different instance. The signature itself needs no
// shared state (only SESSION_SECRET must be consistent across instances),
// but logout has to actually revoke the cookie, so the "epoch" it's signed
// against is bumped on logout and — when MongoDB is configured — persisted
// there so every instance agrees on it. Without MongoDB (SQLite mode, e.g.
// local dev) it's just an in-memory counter, since that mode already
// assumes a single process.
if (!process.env.SESSION_SECRET) {
  console.warn("SESSION_SECRET is not set; using a random secret generated at startup. On serverless platforms (e.g. Vercel) each instance generates its own random secret, so login cookies signed by one instance won't validate on another — set SESSION_SECRET explicitly in production.");
}
const SESSION_SECRET = process.env.SESSION_SECRET || crypto.randomBytes(32).toString("hex");
const AUTH_COOKIE = "admin_auth";
const AUTH_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;
let authEpoch = 0;
app.set("trust proxy", 1);

async function currentAuthEpoch() {
  if (!USE_MONGODB) return authEpoch;
  const database = await initDB();
  const doc = await database.collection("settings").findOne({ _id: "auth" });
  return doc ? doc.epoch : 0;
}

async function bumpAuthEpoch() {
  const epoch = Date.now();
  if (USE_MONGODB) {
    const database = await initDB();
    await database.collection("settings").updateOne({ _id: "auth" }, { $set: { epoch } }, { upsert: true });
  } else {
    authEpoch = epoch;
  }
}

function timingSafeEqual(a, b) {
  const bufA = Buffer.from(String(a ?? ""));
  const bufB = Buffer.from(String(b ?? ""));
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

async function signAuthCookie() {
  const payload = Buffer.from(JSON.stringify({ exp: Date.now() + AUTH_MAX_AGE_MS, epoch: await currentAuthEpoch() })).toString("base64url");
  const sig = crypto.createHmac("sha256", SESSION_SECRET).update(payload).digest("base64url");
  return `${payload}.${sig}`;
}

async function verifyAuthCookie(value) {
  if (!value) return false;
  const [payload, sig] = value.split(".");
  if (!payload || !sig) return false;
  const expectedSig = crypto.createHmac("sha256", SESSION_SECRET).update(payload).digest("base64url");
  const sigBuf = Buffer.from(sig);
  const expectedBuf = Buffer.from(expectedSig);
  if (sigBuf.length !== expectedBuf.length || !crypto.timingSafeEqual(sigBuf, expectedBuf)) return false;
  try {
    const { exp, epoch } = JSON.parse(Buffer.from(payload, "base64url").toString());
    if (typeof exp !== "number" || Date.now() >= exp) return false;
    return epoch === (await currentAuthEpoch());
  } catch {
    return false;
  }
}

function parseCookies(req) {
  const header = req.headers.cookie;
  const out = {};
  if (!header) return out;
  for (const part of header.split(";")) {
    const idx = part.indexOf("=");
    if (idx === -1) continue;
    out[part.slice(0, idx).trim()] = decodeURIComponent(part.slice(idx + 1).trim());
  }
  return out;
}

async function isAuthenticated(req) {
  return verifyAuthCookie(parseCookies(req)[AUTH_COOKIE]);
}

async function requireAuth(req, res, next) {
  if (await isAuthenticated(req)) return next();
  return res.status(401).json({error: "Login required"});
}

app.post("/api/login", async (req, res) => {
  const {username, password} = req.body || {};
  const adminUser = process.env.ADMIN_USERNAME || "";
  const adminPass = process.env.ADMIN_PASSWORD || "";
  if (!adminUser || !adminPass) {
    return res.status(500).json({error: "ADMIN_USERNAME/ADMIN_PASSWORD are not configured on the server"});
  }
  if (timingSafeEqual(username, adminUser) && timingSafeEqual(password, adminPass)) {
    res.cookie(AUTH_COOKIE, await signAuthCookie(), {
      httpOnly: true,
      sameSite: "lax",
      secure: req.secure,
      maxAge: AUTH_MAX_AGE_MS,
    });
    return res.json({ok: true});
  }
  res.status(401).json({error: "Invalid username or password"});
});

app.post("/api/logout", async (req, res) => {
  await bumpAuthEpoch();
  res.clearCookie(AUTH_COOKIE);
  res.json({ok: true});
});

// Lets the frontend (Next.js) ask whether the current session is an
// authenticated admin session, e.g. to decide whether "/" should render the
// dashboard or redirect to "/login". Deliberately public: it only reveals a
// boolean, never any data.
app.get("/api/session", async (req, res) => {
  res.json({authenticated: await isAuthenticated(req)});
});

const normalize = s => String(s ?? "").trim().toLowerCase().replace(/[^a-z0-9]/g, "");

// Helper to safely create ObjectId (MongoDB only)
function safeObjectId(id) {
  if (!USE_MONGODB) return id;
  try {
    if (!id || typeof id !== 'string') return null;
    if (!/^[0-9a-f]{24}$/i.test(id)) return null;
    return new ObjectId(id);
  } catch (e) {
    return null;
  }
}

function findColumn(headers, candidates) {
  const normalized = headers.map(h => ({raw:h, n:normalize(h)}));
  for (const c of candidates) {
    const hit = normalized.find(h => h.n === normalize(c) || h.n.includes(normalize(c)));
    if (hit) return hit.raw;
  }
  return null;
}

// VIP tables default to a rectangle shape on the floor plan so they're
// visually distinct from regular round guest tables.
function defaultShapeForTable(tableNumber) {
  return /vip/i.test(String(tableNumber ?? "")) ? "rectangle" : "round";
}

// Get all events
app.get("/api/events", requireAuth, async (req,res) => {
  try {
    const database = await initDB();
    
    let events;
    if (USE_MONGODB) {
      events = await database.collection("events").find({}).toArray();
      events = events.map(e => ({
        id: e._id.toString(),
        name: e.name,
        table_count: 0,
        guest_count: 0,
        seat_count: 0
      }));
    } else {
      const result = database.exec("SELECT id, name FROM events");
      events = result.length > 0 ? result[0].values.map(v => ({id: String(v[0]), name: v[1], table_count: 0, guest_count: 0, seat_count: 0})) : [];
    }
    
    // Get counts for each event
    for (const e of events) {
      if (USE_MONGODB) {
        const eventId = new ObjectId(e.id);
        e.table_count = await database.collection("tables").countDocuments({event_id: eventId});
        e.guest_count = await database.collection("guests").countDocuments({event_id: eventId});
        const tables = await database.collection("tables").find({event_id: eventId}).toArray();
        e.seat_count = tables.reduce((a,t) => a+t.seats, 0);
      } else {
        const tableResult = database.exec(`SELECT COUNT(*) as count FROM tables WHERE event_id = ${e.id}`);
        e.table_count = tableResult.length > 0 ? tableResult[0].values[0][0] : 0;
        
        const guestResult = database.exec(`SELECT COUNT(*) as count FROM guests WHERE event_id = ${e.id}`);
        e.guest_count = guestResult.length > 0 ? guestResult[0].values[0][0] : 0;
        
        const seatResult = database.exec(`SELECT SUM(seats) as total FROM tables WHERE event_id = ${e.id}`);
        e.seat_count = seatResult.length > 0 && seatResult[0].values[0][0] ? seatResult[0].values[0][0] : 0;
      }
    }
    
    res.json(events);
  } catch (e) {
    res.status(500).json({error: e.message});
  }
});

// Create event
app.post("/api/events", requireAuth, async (req,res) => {
  try {
    const {name} = req.body;
    if (!name) return res.status(400).json({error:"Event name is required"});
    
    const database = await initDB();
    
    let result;
    if (USE_MONGODB) {
      result = await database.collection("events").insertOne({name, created_at: new Date().toISOString()});
      res.json({id: result.insertedId.toString(), name});
    } else {
      database.run(`INSERT INTO events (name) VALUES (?)`, [name]);
      const idResult = database.exec("SELECT last_insert_rowid() as id");
      const id = idResult[0].values[0][0];
      saveSQLiteDB();
      res.json({id: id.toString(), name});
    }
  } catch (e) {
    res.status(500).json({error: e.message});
  }
});

// Delete event
app.delete("/api/events/:id", requireAuth, async (req,res) => {
  try {
    const database = await initDB();
    
    if (USE_MONGODB) {
      const eventId = safeObjectId(req.params.id);
      if (!eventId) return res.status(400).json({error:"Invalid event ID format"});
      
      const event = await database.collection("events").findOne({_id: eventId});
      if (!event) return res.status(404).json({error:"Event not found"});
      
      await database.collection("guests").deleteMany({event_id: eventId});
      await database.collection("tables").deleteMany({event_id: eventId});
      await database.collection("check_ins").deleteMany({event_id: eventId});
      await database.collection("events").deleteOne({_id: eventId});
    } else {
      const eventResult = database.exec(`SELECT id FROM events WHERE id = ${req.params.id}`);
      if (eventResult.length === 0 || eventResult[0].values.length === 0) return res.status(404).json({error:"Event not found"});
      
      database.run(`DELETE FROM guests WHERE event_id = ?`, [req.params.id]);
      database.run(`DELETE FROM tables WHERE event_id = ?`, [req.params.id]);
      database.run(`DELETE FROM check_ins WHERE event_id = ?`, [req.params.id]);
      database.run(`DELETE FROM events WHERE id = ?`, [req.params.id]);
      saveSQLiteDB();
    }
    
    res.json({ok:true});
  } catch (e) {
    res.status(500).json({error: e.message});
  }
});

// Get all events (for Find Your Seat page). Must stay registered before
// GET /api/events/:id below, or Express matches that route first with
// id="list" and this handler never runs.
app.get("/api/events/list", async (req,res) => {
  try {
    const database = await initDB();

    let events;
    if (USE_MONGODB) {
      events = await database.collection("events").find({}).toArray();
      events = events.map(e => ({id: e._id.toString(), name: e.name}));
    } else {
      const result = database.exec("SELECT id, name FROM events");
      events = result.length > 0 ? result[0].values.map(v => ({id: String(v[0]), name: v[1]})) : [];
    }

    res.json(events);
  } catch (e) {
    res.status(500).json({error: e.message});
  }
});

// Get event details. Deliberately public (no requireAuth): the guest-facing
// check-in page (GET /events/:id) needs this to load the event name and the
// floor plan (tables + door/stage) for the wayfinding guide. It's read-only
// and only reachable by knowing the event's id.
app.get("/api/events/:id", async (req,res) => {
  try {
    const database = await initDB();
    
    let event, tables, guests;
    
    if (USE_MONGODB) {
      const eventId = safeObjectId(req.params.id);
      if (!eventId) return res.status(400).json({error:"Invalid event ID format"});
      
      event = await database.collection("events").findOne({_id: eventId});
      if (!event) return res.status(404).json({error:"Event not found"});
      
      tables = await database.collection("tables").find({event_id: eventId}).toArray();
      guests = await database.collection("guests").find({event_id: eventId}).toArray();
      
      res.json({
        event: {id: event._id.toString(), name: event.name, created_at: event.created_at, door_x: event.door_x ?? null, door_y: event.door_y ?? null, stage_x: event.stage_x ?? null, stage_y: event.stage_y ?? null},
        tables: tables.map(t => ({...t, id: t._id.toString(), event_id: t.event_id.toString(), shape: t.shape || "round", x: t.x ?? null, y: t.y ?? null})),
        guests: guests.map(g => ({...g, id: g._id.toString(), event_id: g.event_id.toString()}))
      });
    } else {
      const eventResult = database.exec(`SELECT id, name, created_at, door_x, door_y, stage_x, stage_y FROM events WHERE id = ${req.params.id}`);
      if (eventResult.length === 0 || eventResult[0].values.length === 0) return res.status(404).json({error:"Event not found"});
      
      const ev = eventResult[0].values[0];
      // Ids are stringified so the frontend can compare them consistently
      // regardless of backend (MongoDB's ObjectId is always a string).
      event = {id: String(ev[0]), name: ev[1], created_at: ev[2], door_x: ev[3], door_y: ev[4], stage_x: ev[5], stage_y: ev[6]};
      
      const tableResult = database.exec(`SELECT id, event_id, table_number, seats, shape, x, y FROM tables WHERE event_id = ${req.params.id}`);
      tables = tableResult.length > 0 ? tableResult[0].values.map(v => ({id: String(v[0]), event_id: String(v[1]), table_number: v[2], seats: v[3], shape: v[4] || "round", x: v[5], y: v[6]})) : [];
      
      const guestResult = database.exec(`SELECT id, event_id, name, table_number, seat_number, created_at FROM guests WHERE event_id = ${req.params.id}`);
      guests = guestResult.length > 0 ? guestResult[0].values.map(v => ({id: String(v[0]), event_id: String(v[1]), name: v[2], table_number: v[3], seat_number: v[4], created_at: v[5]})) : [];
      
      res.json({event, tables, guests});
    }
  } catch (e) {
    res.status(500).json({error: e.message});
  }
});

// Update venue layout markers (main door / stage position)
app.put("/api/events/:id/layout", requireAuth, async (req,res) => {
  try {
    const updates = {};
    for (const key of ["door_x","door_y","stage_x","stage_y"]) {
      if (req.body[key] !== undefined) updates[key] = Number(req.body[key]);
    }
    if (!Object.keys(updates).length) return res.status(400).json({error:"No fields to update"});
    
    const database = await initDB();
    
    if (USE_MONGODB) {
      const eventId = safeObjectId(req.params.id);
      if (!eventId) return res.status(400).json({error:"Invalid event ID format"});
      await database.collection("events").updateOne({_id: eventId}, {$set: updates});
    } else {
      const cols = Object.keys(updates);
      const setClause = cols.map(c => `${c} = ?`).join(", ");
      database.run(`UPDATE events SET ${setClause} WHERE id = ?`, [...cols.map(c=>updates[c]), req.params.id]);
      saveSQLiteDB();
    }
    
    res.json({ok:true});
  } catch (e) {
    res.status(500).json({error: e.message});
  }
});

// Create a table manually
app.post("/api/events/:id/tables", requireAuth, async (req,res) => {
  try {
    const table_number = String(req.body.table_number ?? "").trim();
    if (!table_number) return res.status(400).json({error:"Table number/name is required"});
    const seatsNum = req.body.seats === undefined || req.body.seats === "" ? 8 : Number(req.body.seats);
    if (!Number.isFinite(seatsNum)) return res.status(400).json({error:"Seats must be a number"});
    const seats = Math.max(1, Math.round(seatsNum));
    const shape = ["round","rectangle"].includes(req.body.shape) ? req.body.shape : defaultShapeForTable(table_number);
    
    const database = await initDB();
    
    if (USE_MONGODB) {
      const eventId = safeObjectId(req.params.id);
      if (!eventId) return res.status(400).json({error:"Invalid event ID format"});
      const existing = await database.collection("tables").findOne({event_id: eventId, table_number});
      if (existing) return res.status(400).json({error:"A table with that number already exists"});
      const result = await database.collection("tables").insertOne({event_id: eventId, table_number, seats, shape, x: null, y: null});
      res.json({id: result.insertedId.toString(), table_number, seats, shape});
    } else {
      const existingResult = database.exec(`SELECT id FROM tables WHERE event_id = ${req.params.id} AND table_number = '${table_number.replace(/'/g,"''")}'`);
      if (existingResult.length > 0 && existingResult[0].values.length > 0) return res.status(400).json({error:"A table with that number already exists"});
      database.run(`INSERT INTO tables (event_id, table_number, seats, shape) VALUES (?, ?, ?, ?)`, [req.params.id, table_number, seats, shape]);
      const idResult = database.exec("SELECT last_insert_rowid() as id");
      const id = idResult[0].values[0][0];
      saveSQLiteDB();
      res.json({id: id.toString(), table_number, seats, shape});
    }
  } catch (e) {
    res.status(500).json({error: e.message});
  }
});

// Delete a table (and unassign any guests seated at it)
app.delete("/api/events/:id/tables/:tableId", requireAuth, async (req,res) => {
  try {
    const database = await initDB();
    
    if (USE_MONGODB) {
      const eventId = safeObjectId(req.params.id);
      const tableId = safeObjectId(req.params.tableId);
      if (!eventId || !tableId) return res.status(400).json({error:"Invalid ID format"});
      
      const table = await database.collection("tables").findOne({_id: tableId, event_id: eventId});
      if (!table) return res.status(404).json({error:"Table not found"});
      
      await database.collection("guests").updateMany({event_id: eventId, table_number: table.table_number}, {$set: {table_number: "", seat_number: null}});
      await database.collection("tables").deleteOne({_id: tableId, event_id: eventId});
    } else {
      const tableResult = database.exec(`SELECT table_number FROM tables WHERE id = ${req.params.tableId} AND event_id = ${req.params.id}`);
      if (tableResult.length === 0 || tableResult[0].values.length === 0) return res.status(404).json({error:"Table not found"});
      const tableNumber = tableResult[0].values[0][0];
      
      database.run(`UPDATE guests SET table_number = '', seat_number = NULL WHERE event_id = ? AND table_number = ?`, [req.params.id, tableNumber]);
      database.run(`DELETE FROM tables WHERE id = ? AND event_id = ?`, [req.params.tableId, req.params.id]);
      saveSQLiteDB();
    }
    
    res.json({ok:true});
  } catch (e) {
    res.status(500).json({error: e.message});
  }
});

// Import Excel
app.post("/api/events/:id/import", requireAuth, upload.single("file"), async (req,res) => {
  try {
    const eventId = USE_MONGODB ? safeObjectId(req.params.id) : req.params.id;
    if (USE_MONGODB && !eventId) return res.status(400).json({error:"Invalid event ID format"});
    if (!req.file) return res.status(400).json({error:"Excel file is required"});
    
    // For memory storage, use buffer instead of file path
    const wb = XLSX.read(req.file.buffer, {cellDates:true});
    const ws = wb.Sheets[wb.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(ws, {defval:""});
    if (!rows.length) throw new Error("The first worksheet is empty.");

    const headers = Object.keys(rows[0]);
    const nameCol = findColumn(headers, ["name","guest","guest name","fullname","full name"]);
    const tableCol = findColumn(headers, ["table","table number","table no","table #","seat table"]);
    const seatCol = findColumn(headers, ["seat","seat number","seat no","seat #"]);

    if (!nameCol) throw new Error("Could not find a guest name column.");
    if (!tableCol) throw new Error("Could not find a table column.");

    const database = await initDB();
    
    const counts = new Map();
    const parsed = [];
    for (const row of rows) {
      const name = String(row[nameCol] ?? "").trim();
      const table = String(row[tableCol] ?? "").trim();
      if (!name || !table) continue;
      const seatRaw = seatCol ? String(row[seatCol] ?? "").trim() : "";
      const seat = seatRaw && Number.isFinite(Number(seatRaw)) ? Number(seatRaw) : null;
      parsed.push({name, table, seat});
      counts.set(table, (counts.get(table)||0)+1);
    }
    if (!parsed.length) throw new Error("No usable rows found.");

    // Clear existing data
    if (USE_MONGODB) {
      await database.collection("guests").deleteMany({event_id: eventId});
      await database.collection("tables").deleteMany({event_id: eventId});
    } else {
      database.run(`DELETE FROM guests WHERE event_id = ${eventId}`);
      database.run(`DELETE FROM tables WHERE event_id = ${eventId}`);
    }
    
    // Insert tables
    for (const [table, count] of counts) {
      const shape = defaultShapeForTable(table);
      if (USE_MONGODB) {
        await database.collection("tables").insertOne({
          event_id: eventId,
          table_number: table,
          seats: count,
          shape
        });
      } else {
        database.run(`INSERT INTO tables (event_id, table_number, seats, shape) VALUES (?, ?, ?, ?)`, [eventId, table, count, shape]);
      }
    }
    
    // Insert guests
    for (const g of parsed) {
      if (USE_MONGODB) {
        await database.collection("guests").insertOne({
          event_id: eventId,
          name: g.name,
          table_number: g.table,
          seat_number: g.seat,
          created_at: new Date().toISOString()
        });
      } else {
        database.run(`INSERT INTO guests (event_id, name, table_number, seat_number) VALUES (?, ?, ?, ?)`, [eventId, g.name, g.table, g.seat]);
      }
    }
    
    if (!USE_MONGODB) saveSQLiteDB();

    res.json({imported: parsed.length, tables: counts.size});
  } catch (e) {
    res.status(500).json({error: e.message});
  }
});

// Update table (seats, shape, and/or floor plan position)
app.put("/api/events/:id/tables/:tableId", requireAuth, async (req,res) => {
  try {
    const updates = {};
    if (req.body.seats !== undefined) {
      const seatsNum = Number(req.body.seats);
      if (!Number.isFinite(seatsNum)) return res.status(400).json({error:"Seats must be a number"});
      updates.seats = Math.max(0, Math.round(seatsNum));
    }
    if (req.body.shape !== undefined) {
      if (!["round","rectangle"].includes(req.body.shape)) return res.status(400).json({error:"Shape must be 'round' or 'rectangle'"});
      updates.shape = req.body.shape;
    }
    if (req.body.x !== undefined) updates.x = Number(req.body.x);
    if (req.body.y !== undefined) updates.y = Number(req.body.y);
    if (!Object.keys(updates).length) return res.status(400).json({error:"No fields to update"});
    
    const database = await initDB();
    
    if (USE_MONGODB) {
      const eventId = safeObjectId(req.params.id);
      const tableId = safeObjectId(req.params.tableId);
      if (!eventId || !tableId) return res.status(400).json({error:"Invalid ID format"});
      
      await database.collection("tables").updateOne(
        {_id: tableId, event_id: eventId},
        {$set: updates}
      );
    } else {
      const cols = Object.keys(updates);
      const setClause = cols.map(c => `${c} = ?`).join(", ");
      database.run(`UPDATE tables SET ${setClause} WHERE id = ? AND event_id = ?`, [...cols.map(c=>updates[c]), req.params.tableId, req.params.id]);
      saveSQLiteDB();
    }
    
    res.json({ok:true});
  } catch (e) {
    res.status(500).json({error: e.message});
  }
});

// Update guest
app.put("/api/events/:id/guests/:guestId", requireAuth, async (req,res) => {
  try {
    const eventId = USE_MONGODB ? safeObjectId(req.params.id) : req.params.id;
    const guestId = USE_MONGODB ? safeObjectId(req.params.guestId) : req.params.guestId;
    if (USE_MONGODB && (!eventId || !guestId)) return res.status(400).json({error:"Invalid ID format"});
    
    const table = String(req.body.table_number ?? "").trim();
    const seat = req.body.seat_number == null || req.body.seat_number === "" ? null : Number(req.body.seat_number);
    
    const database = await initDB();
    
    if (USE_MONGODB) {
      await database.collection("guests").updateOne(
        {_id: guestId, event_id: eventId},
        {$set: {table_number: table, seat_number: Number.isFinite(seat) ? seat : null}}
      );
    } else {
      database.run(`UPDATE guests SET table_number = ?, seat_number = ? WHERE id = ? AND event_id = ?`, [table, seat, guestId, eventId]);
      saveSQLiteDB();
    }
    
    res.json({ok:true});
  } catch (e) {
    res.status(500).json({error: e.message});
  }
});

// Search guests
app.get("/api/events/:id/search", requireAuth, async (req,res) => {
  try {
    const eventId = USE_MONGODB ? safeObjectId(req.params.id) : req.params.id;
    if (USE_MONGODB && !eventId) return res.status(400).json({error:"Invalid event ID format"});
    
    const q = String(req.query.q || "").trim();
    if (!q) return res.json([]);
    
    const database = await initDB();
    
    let guests;
    if (USE_MONGODB) {
      guests = await database.collection("guests").find({
        event_id: eventId,
        name: {$regex: q, $options: "i"}
      }).limit(20).toArray();
      guests = guests.map(g => ({...g, id: g._id.toString(), event_id: g.event_id.toString()}));
    } else {
      const result = database.exec(`SELECT id, event_id, name, table_number, seat_number FROM guests WHERE event_id = ${eventId} AND name LIKE '%${q}%' LIMIT 20`);
      guests = result.length > 0 ? result[0].values.map(v => ({id: String(v[0]), event_id: String(v[1]), name: v[2], table_number: v[3], seat_number: v[4]})) : [];
    }
    
    res.json(guests);
  } catch (e) {
    res.status(500).json({error: e.message});
  }
});

// QR Code generation
app.get("/api/events/:id/qr", requireAuth, async (req,res) => {
  try {
    const eventId = USE_MONGODB ? safeObjectId(req.params.id) : req.params.id;
    if (USE_MONGODB && !eventId) return res.status(400).json({error:"Invalid event ID format"});
    
    const database = await initDB();
    
    let event;
    if (USE_MONGODB) {
      event = await database.collection("events").findOne({_id: eventId});
    } else {
      const result = database.exec(`SELECT id, name FROM events WHERE id = ${eventId}`);
      event = result.length > 0 && result[0].values.length > 0 ? {id: result[0].values[0][0], name: result[0].values[0][1]} : null;
    }
    if (!event) return res.status(404).json({error:"Event not found"});
    
    // Not req.get('host'): the Next.js frontend (frontend/) proxies /api/*
    // to this process, so that would be this API's own host:port (3001),
    // not the public address guests scan the QR code from.
    const publicUrl = process.env.PUBLIC_URL || "http://localhost:3000";
    const qrUrl = `${publicUrl}/events/${req.params.id}`;
    const qrCode = await QRCode.toDataURL(qrUrl);
    res.json({qrCode, url: qrUrl});
  } catch (e) {
    res.status(500).json({error: e.message});
  }
});

// Export guest/table data as an Excel workbook
app.get("/api/events/:id/export/excel", requireAuth, async (req,res) => {
  try {
    const database = await initDB();
    
    let event, tables, guests;
    if (USE_MONGODB) {
      const eventId = safeObjectId(req.params.id);
      if (!eventId) return res.status(400).json({error:"Invalid event ID format"});
      event = await database.collection("events").findOne({_id: eventId});
      if (!event) return res.status(404).json({error:"Event not found"});
      tables = await database.collection("tables").find({event_id: eventId}).toArray();
      guests = await database.collection("guests").find({event_id: eventId}).toArray();
    } else {
      const eventResult = database.exec(`SELECT id, name FROM events WHERE id = ${req.params.id}`);
      if (eventResult.length === 0 || eventResult[0].values.length === 0) return res.status(404).json({error:"Event not found"});
      event = {id: eventResult[0].values[0][0], name: eventResult[0].values[0][1]};
      const tableResult = database.exec(`SELECT id, table_number, seats FROM tables WHERE event_id = ${req.params.id}`);
      tables = tableResult.length > 0 ? tableResult[0].values.map(v => ({table_number: v[1], seats: v[2]})) : [];
      const guestResult = database.exec(`SELECT name, table_number, seat_number FROM guests WHERE event_id = ${req.params.id}`);
      guests = guestResult.length > 0 ? guestResult[0].values.map(v => ({name: v[0], table_number: v[1], seat_number: v[2]})) : [];
    }
    
    const guestRows = guests
      .slice()
      .sort((a,b) => String(a.table_number||"").localeCompare(String(b.table_number||""), undefined, {numeric:true}) || String(a.name).localeCompare(String(b.name)))
      .map(g => ({Name: g.name, Table: g.table_number || "Unassigned", Seat: g.seat_number ?? ""}));
    const tableRows = tables
      .slice()
      .sort((a,b) => String(a.table_number||"").localeCompare(String(b.table_number||""), undefined, {numeric:true}))
      .map(t => ({Table: t.table_number, Seats: t.seats}));
    
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(guestRows), "Guests");
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(tableRows), "Tables");
    const buffer = XLSX.write(wb, {type:"buffer", bookType:"xlsx"});
    
    const filename = `${String(event.name).replace(/[^a-z0-9]+/gi,"-")}-seating.xlsx`;
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.send(buffer);
  } catch (e) {
    res.status(500).json({error: e.message});
  }
});

// --- Public guest-facing routes (no login required) -----------------------
// These power the "scan the QR code, find your name, see your table"
// experience and must stay reachable without an admin session. The pages
// themselves (print chart, find-your-seat, per-event check-in) are rendered
// by the Next.js frontend now; this API only needs to keep serving their data.

// Public guest name search used by the check-in page (rendered by the
// Next.js frontend at /events/:id, this is what the QR code links to).
app.get("/api/events/:eventId/guest", async (req,res) => {
  try {
    const eventId = USE_MONGODB ? safeObjectId(req.params.eventId) : req.params.eventId;
    if (USE_MONGODB && !eventId) return res.status(400).json({error:"Invalid event ID format"});
    
    const q = String(req.query.q || "").trim();
    if (!q) return res.json([]);
    
    const database = await initDB();
    
    let guests;
    if (USE_MONGODB) {
      guests = await database.collection("guests").find({
        event_id: eventId,
        name: {$regex: q, $options: "i"}
      }).limit(20).toArray();
      guests = guests.map(g => ({
        id: g._id.toString(),
        name: g.name,
        table_number: g.table_number,
        seat_number: g.seat_number,
        seats: 0,
        checked_in: 0
      }));
    } else {
      const result = database.exec(`SELECT id, name, table_number, seat_number FROM guests WHERE event_id = ${eventId} AND name LIKE '%${q}%' LIMIT 20`);
      guests = result.length > 0 ? result[0].values.map(v => ({id: String(v[0]), name: v[1], table_number: v[2], seat_number: v[3], seats: 0, checked_in: 0})) : [];
    }
    
    res.json(guests);
  } catch (e) {
    res.status(500).json({error: e.message});
  }
});

// Public: lets a guest mark themselves checked in from the check-in page above.
app.post("/api/events/:eventId/guest/:guestId", async (req,res) => {
  try {
    const eventId = USE_MONGODB ? safeObjectId(req.params.eventId) : req.params.eventId;
    const guestId = USE_MONGODB ? safeObjectId(req.params.guestId) : req.params.guestId;
    if (USE_MONGODB && (!eventId || !guestId)) return res.status(400).json({error:"Invalid ID format"});
    
    const database = await initDB();
    
    let guest;
    if (USE_MONGODB) {
      guest = await database.collection("guests").findOne({
        _id: guestId,
        event_id: eventId
      });
    } else {
      const result = database.exec(`SELECT id, name, table_number, seat_number FROM guests WHERE id = ${guestId} AND event_id = ${eventId}`);
      guest = result.length > 0 && result[0].values.length > 0 ? {id: result[0].values[0][0], name: result[0].values[0][1], table_number: result[0].values[0][2], seat_number: result[0].values[0][3]} : null;
    }
    
    if (!guest) return res.status(404).json({error:"Guest not found"});
    
    let existing;
    if (USE_MONGODB) {
      existing = await database.collection("check_ins").findOne({guest_id: guestId});
    } else {
      const result = database.exec(`SELECT id FROM check_ins WHERE guest_id = ${guestId}`);
      existing = result.length > 0 && result[0].values.length > 0;
    }
    if (existing) return res.json({already_checked_in: true, guest});
    
    if (USE_MONGODB) {
      await database.collection("check_ins").insertOne({
        event_id: eventId,
        guest_id: guestId,
        checked_in_at: new Date().toISOString()
      });
    } else {
      database.run(`INSERT INTO check_ins (event_id, guest_id) VALUES (?, ?)`, [eventId, guestId]);
      saveSQLiteDB();
    }
    
    res.json({checked_in: true, guest});
  } catch (e) {
    res.status(500).json({error: e.message});
  }
});

if (require.main === module) {
  app.listen(PORT, () => console.log(`Wedding Seating Planner: http://localhost:${PORT} (${USE_MONGODB ? 'MongoDB' : 'SQLite'})`));
}

module.exports = app;
