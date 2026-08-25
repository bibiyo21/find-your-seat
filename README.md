# Wedding Seating Planner

A small JavaScript/Node.js wedding seating planner using SQLite and Excel import.

## Requirements
- Node.js 18+ (Node 20+ recommended)
- npm

## Run
```bash
npm install
npm start   # or: npm run dev
```

Open http://localhost:3000

There's a single server, `server.js` (also used for deployment, see `vercel.json`):
- `npm start` uses MongoDB if `MONGODB_URI` is set (via the environment or a `.env` file — copy `.env.example` to `.env` and fill it in), and otherwise automatically falls back to a local SQLite file (`wedding.sqlite`, created automatically).
- `npm run dev` always uses that local SQLite file, ignoring `MONGODB_URI`, so you can develop locally without touching your production database.

## Excel import

The first worksheet is imported.

Required columns:
- `Name` (or Guest Name / Full Name)
- `Table` (or Table Number / Table No)

Optional:
- `Seat` (or Seat Number)

### Important: seat capacity
The initial seat capacity for each table is **derived from the number of guest rows assigned to that table**.

Example:

| Name | Table |
|---|---|
| Alice | 1 |
| Bob | 1 |
| Charlie | 1 |
| David | 2 |
| Emma | 2 |

This creates:
- Table 1 = 3 seats
- Table 2 = 2 seats

You can manually change a table's seat capacity afterward.

## Current MVP
- Create multiple wedding events
- SQLite or MongoDB persistence (`server.js` supports both; set `MONGODB_URI` to use MongoDB, otherwise it falls back to a local SQLite file)
- Excel/XLSX/CSV import
- Automatically derive table seat capacity from imported rows
- Guest list
- Table list
- Guest search
- Basic guest seat lookup
- Manual table capacity adjustment
- Optional seat numbers from Excel
- QR code per event + public "Find Your Seat" guest lookup page
- Drag-and-drop floor plan: round/rectangle tables, draggable Main Door and Stage markers, drag guests between tables (or off a table to unassign them)
- Manually add tables (default 8 seats) in addition to Excel import
- Door-to-table wayfinding guide shown to guests on the public check-in page once they find their seat
- Export guest/table list to Excel
- Print-ready seating chart page (use the browser's "Print to PDF" for a PDF export)

## Next features I'd add
- Guest groups and plus-ones
- Seating constraints and auto-arrangement

## Testing
An automated integration test suite lives in `test/` (uses Node's built-in test runner, no extra dependencies) and exercises both backends through real HTTP requests against a spawned server process.

```bash
npm test
```

- **SQLite tests** always run, against a disposable temp `.sqlite` file (your real `wedding.sqlite` is never touched).
- **MongoDB tests** are skipped unless `TEST_MONGODB_URI` is set, since they need a real MongoDB connection:
  ```bash
  TEST_MONGODB_URI="mongodb://localhost:27017" npm test
  ```
  The suite creates and deletes its own disposable event, so it's safe to point at a shared/production URI too — it won't leave residue behind.

The suite covers: creating/deleting events, adding tables (including the default-8-seats and decimal-seat-count edge cases), duplicate table number rejection, floor plan position/shape updates, door/stage layout updates, Excel import/export, guest search and reassignment, deleting a table (which unassigns its guests), QR code generation, and the print page. It also asserts that all ids returned by the API are strings on both backends, since the frontend relies on that for its drag-and-drop id comparisons.
