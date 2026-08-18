const express = require("express");
const multer = require("multer");
const XLSX = require("xlsx");
const path = require("path");
const fs = require("fs");
const QRCode = require("qrcode");

// Determine which database to use
const USE_MONGODB = process.env.MONGODB_URI ? true : false;

let db;
let mongoClient;

// MongoDB imports (only if using MongoDB)
let MongoClient, ObjectId;
if (USE_MONGODB) {
  const mongodb = require("mongodb");
  MongoClient = mongodb.MongoClient;
  ObjectId = mongodb.ObjectId;
}

// SQLite imports (only if using SQLite)
let Database;
if (!USE_MONGODB) {
  Database = require("better-sqlite3");
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
function initSQLite() {
  const dbPath = path.join(__dirname, "wedding.sqlite");
  db = new Database(dbPath);
  
  // Create tables
  db.exec(`
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
  
  return db;
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
      events = database.prepare("SELECT id, name FROM events").all();
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
        e.table_count = database.prepare("SELECT COUNT(*) as count FROM tables WHERE event_id = ?").get(e.id).count;
        e.guest_count = database.prepare("SELECT COUNT(*) as count FROM guests WHERE event_id = ?").get(e.id).count;
        e.seat_count = database.prepare("SELECT SUM(seats) as total FROM tables WHERE event_id = ?").get(e.id).total || 0;
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
      const stmt = database.prepare("INSERT INTO events (name) VALUES (?)");
      result = stmt.run(name);
      res.json({id: result.lastInsertRowid.toString(), name});
    }
  } catch (e) {
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
      event = database.prepare("SELECT id, name, created_at FROM events WHERE id = ?").get(req.params.id);
      if (!event) return res.status(404).json({error:"Event not found"});
      
      tables = database.prepare("SELECT id, event_id, table_number, seats FROM tables WHERE event_id = ?").all(req.params.id);
      guests = database.prepare("SELECT id, event_id, name, table_number, seat_number, created_at FROM guests WHERE event_id = ?").all(req.params.id);
      
      res.json({
        event,
        tables,
        guests
      });
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
      database.prepare("DELETE FROM guests WHERE event_id = ?").run(eventId);
      database.prepare("DELETE FROM tables WHERE event_id = ?").run(eventId);
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
        database.prepare("INSERT INTO tables (event_id, table_number, seats) VALUES (?, ?, ?)").run(eventId, table, count);
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
        database.prepare("INSERT INTO guests (event_id, name, table_number, seat_number) VALUES (?, ?, ?, ?)").run(eventId, g.name, g.table, g.seat);
      }
    }

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
      database.prepare("UPDATE tables SET seats = ? WHERE id = ? AND event_id = ?").run(seats, req.params.tableId, req.params.id);
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
      database.prepare("UPDATE guests SET table_number = ?, seat_number = ? WHERE id = ? AND event_id = ?").run(table, seat, guestId, eventId);
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
      guests = database.prepare("SELECT id, event_id, name, table_number, seat_number FROM guests WHERE event_id = ? AND name LIKE ? LIMIT 20").all(eventId, `%${q}%`);
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
      event = database.prepare("SELECT id, name FROM events WHERE id = ?").get(eventId);
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
      events = database.prepare("SELECT id, name FROM events").all();
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
      guests = database.prepare("SELECT id, name, table_number, seat_number FROM guests WHERE event_id = ? AND name LIKE ? LIMIT 20").all(eventId, `%${q}%`);
      guests = guests.map(g => ({...g, seats: 0, checked_in: 0}));
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
      guest = database.prepare("SELECT id, name, table_number, seat_number FROM guests WHERE id = ? AND event_id = ?").get(guestId, eventId);
    }
    
    if (!guest) return res.status(404).json({error:"Guest not found"});
    
    let existing;
    if (USE_MONGODB) {
      existing = await database.collection("check_ins").findOne({guest_id: guestId});
    } else {
      existing = database.prepare("SELECT id FROM check_ins WHERE guest_id = ?").get(guestId);
    }
    if (existing) return res.json({already_checked_in: true, guest});
    
    if (USE_MONGODB) {
      await database.collection("check_ins").insertOne({
        event_id: eventId,
        guest_id: guestId,
        checked_in_at: new Date().toISOString()
      });
    } else {
      database.prepare("INSERT INTO check_ins (event_id, guest_id) VALUES (?, ?)").run(eventId, guestId);
    }
    
    res.json({checked_in: true, guest});
  } catch (e) {
    res.status(500).json({error: e.message});
  }
});

app.listen(PORT, () => console.log(`Wedding Seating Planner: http://localhost:${PORT} (${USE_MONGODB ? 'MongoDB' : 'SQLite'})`));
