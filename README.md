# Wedding Seating Planner

A small JavaScript/Node.js wedding seating planner using SQLite and Excel import.

## Requirements
- Node.js 18+ (Node 20+ recommended)
- npm

## Run
```bash
npm install
npm start
```

Open http://localhost:3000

The SQLite database is created automatically as `wedding.sqlite`.

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
- SQLite persistence
- Excel/XLSX/CSV import
- Automatically derive table seat capacity from imported rows
- Guest list
- Table list
- Guest search
- Basic guest seat lookup
- Manual table capacity adjustment
- Optional seat numbers from Excel

## Next features I'd add
- Drag-and-drop floor plan
- Visual round/rectangle tables
- Drag guests between tables
- QR code per event
- Public guest lookup URL
- Print-ready seating chart
- Export to PDF/Excel
- Guest groups and plus-ones
- Seating constraints and auto-arrangement
