const express = require("express");
const multer = require("multer");
const XLSX = require("xlsx");
const path = require("path");
const fs = require("fs");
const QRCode = require("qrcode");
const initSqlJs = require("sql.js");

// Determine which database to use
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
const PORT = process.env.PORT || 3000;
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
  
  const dbPath = path.join(__dirname, "wedding.sqlite");
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
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    
    CREATE TABLE IF NOT EXISTS tables (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      event_id INTEGER NOT NULL,
      table_number TEXT,
      seats INTEGER,
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
  
  // Save database to file
  saveSQLiteDB();
  
  return db;
}

// Save SQLite database to file
function saveSQLiteDB() {
  if (!USE_MONGODB && db) {
    const data = db.export();
    const buffer = Buffer.from(data);
    fs.writeFileSync(path.join(__dirname, "wedding.sqlite"), buffer);
  }
}

// Use memory storage for Vercel (serverless environment)
const upload = multer({ storage: multer.memoryStorage() });

app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

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

// Get all events
app.get("/api/events", async (req,res) => {
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
      events = result.length > 0 ? result[0].values.map(v => ({id: v[0], name: v[1], table_count: 0, guest_count: 0, seat_count: 0})) : [];
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
app.post("/api/events", async (req,res) => {
  try {
    const {name} = req.body;
    if (!name) return res.status(400).json({error:"Event name is required"});
    
    const database = await initDB();
    
    let result;
    if (USE_MONGODB) {
      result = await database.collection("events").insertOne({name, created_at: new Date().toISOString()});
      res.json({id: result.insertedId.toString(), name});
    } else {
      try {
        database.run(`INSERT INTO events (name) VALUES (?)`, [name]);
        const idResult = database.exec("SELECT last_insert_rowid() as id");
        const id = idResult && idResult.length > 0 && idResult[0].values && idResult[0].values.length > 0 ? idResult[0].values[0][0] : null;
        if (!id) throw new Error("Failed to get inserted ID");
        saveSQLiteDB();
        res.json({id: id.toString(), name});
      } catch (sqlError) {
        console.error("SQL Error:", sqlError);
        throw sqlError;
      }
    }
  } catch (e) {
    console.error("Create event error:", e);
    res.status(500).json({error: e.message});
  }
});

// Get event details
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
        event: {id: event._id.toString(), name: event.name, created_at: event.created_at},
        tables: tables.map(t => ({...t, id: t._id.toString(), event_id: t.event_id.toString()})),
        guests: guests.map(g => ({...g, id: g._id.toString(), event_id: g.event_id.toString()}))
      });
    } else {
      const eventResult = database.exec(`SELECT id, name, created_at FROM events WHERE id = ${req.params.id}`);
      if (eventResult.length === 0 || eventResult[0].values.length === 0) return res.status(404).json({error:"Event not found"});
      
      event = {id: eventResult[0].values[0][0], name: eventResult[0].values[0][1], created_at: eventResult[0].values[0][2]};
      
      const tableResult = database.exec(`SELECT id, event_id, table_number, seats FROM tables WHERE event_id = ${req.params.id}`);
      tables = tableResult.length > 0 ? tableResult[0].values.map(v => ({id: v[0], event_id: v[1], table_number: v[2], seats: v[3]})) : [];
      
      const guestResult = database.exec(`SELECT id, event_id, name, table_number, seat_number, created_at FROM guests WHERE event_id = ${req.params.id}`);
      guests = guestResult.length > 0 ? guestResult[0].values.map(v => ({id: v[0], event_id: v[1], name: v[2], table_number: v[3], seat_number: v[4], created_at: v[5]})) : [];
      
      res.json({event, tables, guests});
    }
  } catch (e) {
    res.status(500).json({error: e.message});
  }
});

// Import Excel
app.post("/api/events/:id/import", upload.single("file"), async (req,res) => {
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
      if (USE_MONGODB) {
        await database.collection("tables").insertOne({
          event_id: eventId,
          table_number: table,
          seats: count
        });
      } else {
        database.run(`INSERT INTO tables (event_id, table_number, seats) VALUES (?, ?, ?)`, [eventId, table, count]);
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

// Update table seats
app.put("/api/events/:id/tables/:tableId", async (req,res) => {
  try {
    const seats = Math.max(0, Number(req.body.seats));
    if (!Number.isInteger(seats)) return res.status(400).json({error:"Seats must be an integer"});
    
    const database = await initDB();
    
    if (USE_MONGODB) {
      const eventId = safeObjectId(req.params.id);
      const tableId = safeObjectId(req.params.tableId);
      if (!eventId || !tableId) return res.status(400).json({error:"Invalid ID format"});
      
      await database.collection("tables").updateOne(
        {_id: tableId, event_id: eventId},
        {$set: {seats}}
      );
    } else {
      database.run(`UPDATE tables SET seats = ? WHERE id = ? AND event_id = ?`, [seats, req.params.tableId, req.params.id]);
      saveSQLiteDB();
    }
    
    res.json({ok:true});
  } catch (e) {
    res.status(500).json({error: e.message});
  }
});

// Update guest
app.put("/api/events/:id/guests/:guestId", async (req,res) => {
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
app.get("/api/events/:id/search", async (req,res) => {
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
      guests = result.length > 0 ? result[0].values.map(v => ({id: v[0], event_id: v[1], name: v[2], table_number: v[3], seat_number: v[4]})) : [];
    }
    
    res.json(guests);
  } catch (e) {
    res.status(500).json({error: e.message});
  }
});

// QR Code generation
app.get("/api/events/:id/qr", async (req,res) => {
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
    
    const qrUrl = `${req.protocol}://${req.get('host')}/events/${req.params.id}`;
    const qrCode = await QRCode.toDataURL(qrUrl);
    res.json({qrCode, url: qrUrl});
  } catch (e) {
    res.status(500).json({error: e.message});
  }
});

// Find Your Seat routes
app.get("/find-your-seat", (req,res) => {
  res.sendFile(path.join(__dirname, "public", "checkin-select.html"));
});

// Get all events (for Find Your Seat page)
app.get("/api/events/list", async (req,res) => {
  try {
    const database = await initDB();
    
    let events;
    if (USE_MONGODB) {
      events = await database.collection("events").find({}).toArray();
      events = events.map(e => ({id: e._id.toString(), name: e.name}));
    } else {
      const result = database.exec("SELECT id, name FROM events");
      events = result.length > 0 ? result[0].values.map(v => ({id: v[0], name: v[1]})) : [];
    }
    
    res.json(events);
  } catch (e) {
    res.status(500).json({error: e.message});
  }
});

app.get("/events/:id", (req,res) => {
  res.sendFile(path.join(__dirname, "public", "checkin.html"));
});

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
      guests = result.length > 0 ? result[0].values.map(v => ({id: v[0], name: v[1], table_number: v[2], seat_number: v[3], seats: 0, checked_in: 0})) : [];
    }
    
    res.json(guests);
  } catch (e) {
    res.status(500).json({error: e.message});
  }
});

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

app.listen(PORT, () => console.log(`Wedding Seating Planner: http://localhost:${PORT} (${USE_MONGODB ? 'MongoDB' : 'SQLite'})`));
