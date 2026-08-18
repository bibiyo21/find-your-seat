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

const upload = multer({ dest: path.join(__dirname, "uploads") });

app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

const normalize = s => String(s ?? "").trim().toLowerCase().replace(/[^a-z0-9]/g, "");

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
    
    const event = await database.collection("events").findOne({_id: new ObjectId(req.params.id)});
    if (!event) return res.status(404).json({error:"Event not found"});
    
    const tables = await database.collection("tables").find({event_id: new ObjectId(req.params.id)}).toArray();
    const guests = await database.collection("guests").find({event_id: new ObjectId(req.params.id)}).toArray();
    
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
    const eventId = req.params.id;
    if (!req.file) return res.status(400).json({error:"Excel file is required"});
    
    const wb = XLSX.readFile(req.file.path, {cellDates:true});
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
    const eventObjectId = new ObjectId(eventId);
    
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
    await database.collection("guests").deleteMany({event_id: eventObjectId});
    await database.collection("tables").deleteMany({event_id: eventObjectId});
    
    // Insert tables
    for (const [table, count] of counts) {
      await database.collection("tables").insertOne({
        event_id: eventObjectId,
        table_number: table,
        seats: count
      });
    }
    
    // Insert guests
    for (const g of parsed) {
      await database.collection("guests").insertOne({
        event_id: eventObjectId,
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
    const seats = Math.max(0, Number(req.body.seats));
    if (!Number.isInteger(seats)) return res.status(400).json({error:"Seats must be an integer"});
    
    const database = await connectDB();
    
    await database.collection("tables").updateOne(
      {_id: new ObjectId(req.params.tableId), event_id: new ObjectId(req.params.id)},
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
    const table = String(req.body.table_number ?? "").trim();
    const seat = req.body.seat_number == null || req.body.seat_number === "" ? null : Number(req.body.seat_number);
    
    const database = await connectDB();
    
    await database.collection("guests").updateOne(
      {_id: new ObjectId(req.params.guestId), event_id: new ObjectId(req.params.id)},
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
    const q = String(req.query.q || "").trim();
    if (!q) return res.json([]);
    
    const database = await connectDB();
    
    const guests = await database.collection("guests").find({
      event_id: new ObjectId(req.params.id),
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
    const database = await connectDB();
    
    const event = await database.collection("events").findOne({_id: new ObjectId(req.params.id)});
    if (!event) return res.status(404).json({error:"Event not found"});
    
    const qrUrl = `${req.protocol}://${req.get('host')}/find-your-seat/${req.params.id}`;
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

app.get("/api/find-your-seat/events/list", async (req,res) => {
  try {
    const database = await connectDB();
    const events = await database.collection("events").find({}).toArray();
    res.json(events.map(e => ({id: e._id.toString(), name: e.name})));
  } catch (e) {
    res.status(500).json({error: e.message});
  }
});

app.get("/find-your-seat/:eventId", (req,res) => {
  res.sendFile(path.join(__dirname, "public", "checkin.html"));
});

app.get("/api/find-your-seat/:eventId/guest", async (req,res) => {
  try {
    const eventId = req.params.eventId;
    const q = String(req.query.q || "").trim();
    if (!q) return res.json([]);
    
    const database = await connectDB();
    
    const guests = await database.collection("guests").find({
      event_id: new ObjectId(eventId),
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

app.post("/api/find-your-seat/:eventId/guest/:guestId", async (req,res) => {
  try {
    const database = await connectDB();
    
    const guest = await database.collection("guests").findOne({
      _id: new ObjectId(req.params.guestId),
      event_id: new ObjectId(req.params.eventId)
    });
    
    if (!guest) return res.status(404).json({error:"Guest not found"});
    
    const existing = await database.collection("check_ins").findOne({guest_id: new ObjectId(req.params.guestId)});
    if (existing) return res.json({already_checked_in: true, guest});
    
    await database.collection("check_ins").insertOne({
      event_id: new ObjectId(req.params.eventId),
      guest_id: new ObjectId(req.params.guestId),
      checked_in_at: new Date().toISOString()
    });
    
    res.json({checked_in: true, guest});
  } catch (e) {
    res.status(500).json({error: e.message});
  }
});

app.listen(PORT, () => console.log(`Wedding Seating Planner: http://localhost:${PORT}`));
