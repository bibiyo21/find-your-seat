const express = require("express");
const multer = require("multer");
const XLSX = require("xlsx");
const { MongoClient, ObjectId } = require("mongodb");
const path = require("path");
const fs = require("fs");
const QRCode = require("qrcode");

const app = express();
const PORT = process.env.PORT || 3000;
const MONGODB_URI = process.env.MONGODB_URI;

let db;

// MongoDB connection
async function connectDB() {
  if (db) return db;
  
  if (!MONGODB_URI) {
    throw new Error("MONGODB_URI environment variable is not set");
  }
  
  const client = new MongoClient(MONGODB_URI);
  await client.connect();
  db = client.db("wedding-planner");
  
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

// Use memory storage for Vercel (serverless environment)
const upload = multer({ storage: multer.memoryStorage() });

app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

const normalize = s => String(s ?? "").trim().toLowerCase().replace(/[^a-z0-9]/g, "");

// Helper to safely create ObjectId
function safeObjectId(id) {
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
    const database = await connectDB();
    const events = await database.collection("events").find({}).toArray();
    
    const result = await Promise.all(events.map(async (e) => {
      const guestCount = await database.collection("guests").countDocuments({event_id: e._id});
      const tableCount = await database.collection("tables").countDocuments({event_id: e._id});
      const tables = await database.collection("tables").find({event_id: e._id}).toArray();
      const seatCount = tables.reduce((a, t) => a + (t.seats || 0), 0);
      
      return {
        id: e._id.toString(),
        name: e.name,
        created_at: e.created_at,
        guest_count: guestCount,
        seat_count: seatCount,
        table_count: tableCount
      };
    }));
    
    res.json(result);
  } catch (e) {
    res.status(500).json({error: e.message});
  }
});

// Create event
app.post("/api/events", async (req,res) => {
  try {
    const name = String(req.body.name || "").trim();
    if (!name) return res.status(400).json({error:"Event name is required"});
    
    const database = await connectDB();
    const result = await database.collection("events").insertOne({
      name,
      created_at: new Date().toISOString()
    });
    
    res.json({id: result.insertedId.toString(), name});
  } catch (e) {
    res.status(500).json({error: e.message});
  }
});

// Get event details
app.get("/api/events/:id", async (req,res) => {
  try {
    const database = await connectDB();
    
    const eventId = safeObjectId(req.params.id);
    if (!eventId) return res.status(400).json({error:"Invalid event ID format"});
    
    const event = await database.collection("events").findOne({_id: eventId});
    if (!event) return res.status(404).json({error:"Event not found"});
    
    const tables = await database.collection("tables").find({event_id: eventId}).toArray();
    const guests = await database.collection("guests").find({event_id: eventId}).toArray();
    
    res.json({
      event: {id: event._id.toString(), name: event.name, created_at: event.created_at},
      tables: tables.map(t => ({...t, id: t._id.toString(), event_id: t.event_id.toString()})),
      guests: guests.map(g => ({...g, id: g._id.toString(), event_id: g.event_id.toString()}))
    });
  } catch (e) {
    res.status(500).json({error: e.message});
  }
});

// Import Excel
app.post("/api/events/:id/import", upload.single("file"), async (req,res) => {
  try {
    const eventId = safeObjectId(req.params.id);
    if (!eventId) return res.status(400).json({error:"Invalid event ID format"});
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

    const database = await connectDB();
    
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
    await database.collection("guests").deleteMany({event_id: eventId});
    await database.collection("tables").deleteMany({event_id: eventId});
    
    // Insert tables
    for (const [table, count] of counts) {
      await database.collection("tables").insertOne({
        event_id: eventId,
        table_number: table,
        seats: count
      });
    }
    
    // Insert guests
    for (const g of parsed) {
      await database.collection("guests").insertOne({
        event_id: eventId,
        name: g.name,
        table_number: g.table,
        seat_number: g.seat,
        created_at: new Date().toISOString()
      });
    }

    res.json({imported: parsed.length, tables: counts.size, seatTotals: [...counts.values()].reduce((a,b)=>a+b,0)});
    
    fs.unlink(req.file.path, ()=>{});
  } catch (e) {
    res.status(400).json({error: e.message});
    if (req.file) fs.unlink(req.file.path, ()=>{});
  }
});

// Update table seats
app.put("/api/events/:id/tables/:tableId", async (req,res) => {
  try {
    const eventId = safeObjectId(req.params.id);
    const tableId = safeObjectId(req.params.tableId);
    if (!eventId || !tableId) return res.status(400).json({error:"Invalid ID format"});
    
    const seats = Math.max(0, Number(req.body.seats));
    if (!Number.isInteger(seats)) return res.status(400).json({error:"Seats must be an integer"});
    
    const database = await connectDB();
    
    await database.collection("tables").updateOne(
      {_id: tableId, event_id: eventId},
      {$set: {seats}}
    );
    
    res.json({ok:true});
  } catch (e) {
    res.status(500).json({error: e.message});
  }
});

// Update guest
app.put("/api/events/:id/guests/:guestId", async (req,res) => {
  try {
    const eventId = safeObjectId(req.params.id);
    const guestId = safeObjectId(req.params.guestId);
    if (!eventId || !guestId) return res.status(400).json({error:"Invalid ID format"});
    
    const table = String(req.body.table_number ?? "").trim();
    const seat = req.body.seat_number == null || req.body.seat_number === "" ? null : Number(req.body.seat_number);
    
    const database = await connectDB();
    
    await database.collection("guests").updateOne(
      {_id: guestId, event_id: eventId},
      {$set: {table_number: table, seat_number: Number.isFinite(seat) ? seat : null}}
    );
    
    res.json({ok:true});
  } catch (e) {
    res.status(500).json({error: e.message});
  }
});

// Search guests
app.get("/api/events/:id/search", async (req,res) => {
  try {
    const eventId = safeObjectId(req.params.id);
    if (!eventId) return res.status(400).json({error:"Invalid event ID format"});
    
    const q = String(req.query.q || "").trim();
    if (!q) return res.json([]);
    
    const database = await connectDB();
    
    const guests = await database.collection("guests").find({
      event_id: eventId,
      name: {$regex: q, $options: "i"}
    }).limit(20).toArray();
    
    res.json(guests.map(g => ({...g, id: g._id.toString(), event_id: g.event_id.toString()})));
  } catch (e) {
    res.status(500).json({error: e.message});
  }
});

// QR Code generation
app.get("/api/events/:id/qr", async (req,res) => {
  try {
    const eventId = safeObjectId(req.params.id);
    if (!eventId) return res.status(400).json({error:"Invalid event ID format"});
    
    const database = await connectDB();
    
    const event = await database.collection("events").findOne({_id: eventId});
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
    const database = await connectDB();
    const events = await database.collection("events").find({}).toArray();
    res.json(events.map(e => ({id: e._id.toString(), name: e.name})));
  } catch (e) {
    res.status(500).json({error: e.message});
  }
});

app.get("/events/:id", (req,res) => {
  res.sendFile(path.join(__dirname, "public", "checkin.html"));
});

app.get("/api/events/:eventId/guest", async (req,res) => {
  try {
    const eventId = safeObjectId(req.params.eventId);
    if (!eventId) return res.status(400).json({error:"Invalid event ID format"});
    
    const q = String(req.query.q || "").trim();
    if (!q) return res.json([]);
    
    const database = await connectDB();
    
    const guests = await database.collection("guests").find({
      event_id: eventId,
      name: {$regex: q, $options: "i"}
    }).limit(20).toArray();
    
    res.json(guests.map(g => ({
      id: g._id.toString(),
      name: g.name,
      table_number: g.table_number,
      seat_number: g.seat_number,
      seats: 0,
      checked_in: 0
    })));
  } catch (e) {
    res.status(500).json({error: e.message});
  }
});

app.post("/api/events/:eventId/guest/:guestId", async (req,res) => {
  try {
    const eventId = safeObjectId(req.params.eventId);
    const guestId = safeObjectId(req.params.guestId);
    if (!eventId || !guestId) return res.status(400).json({error:"Invalid ID format"});
    
    const database = await connectDB();
    
    const guest = await database.collection("guests").findOne({
      _id: guestId,
      event_id: eventId
    });
    
    if (!guest) return res.status(404).json({error:"Guest not found"});
    
    const existing = await database.collection("check_ins").findOne({guest_id: guestId});
    if (existing) return res.json({already_checked_in: true, guest});
    
    await database.collection("check_ins").insertOne({
      event_id: eventId,
      guest_id: guestId,
      checked_in_at: new Date().toISOString()
    });
    
    res.json({checked_in: true, guest});
  } catch (e) {
    res.status(500).json({error: e.message});
  }
});

app.listen(PORT, () => console.log(`Wedding Seating Planner: http://localhost:${PORT}`));
