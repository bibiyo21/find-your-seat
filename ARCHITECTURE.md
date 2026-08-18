# 🏗️ QR Code Check-In Architecture

## System Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                    Wedding Seating Planner                      │
│                   QR Code Check-In System                       │
└─────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────┐
│                      EVENT ORGANIZER                             │
│                                                                  │
│  1. Opens event in management interface                         │
│  2. Sees QR code in "Event Check-In" panel                      │
│  3. Shares QR code with guests (print/email/display)           │
└──────────────────────────────────────────────────────────────────┘
                              ↓
┌──────────────────────────────────────────────────────────────────┐
│                         QR CODE                                  │
│                                                                  │
│  Contains: http://localhost:3000/checkin/[EVENT_ID]            │
└──────────────────────────────────────────────────────────────────┘
                              ↓
┌──────────────────────────────────────────────────────────────────┐
│                         GUEST                                    │
│                                                                  │
│  1. Scans QR code with phone camera                            │
│  2. Lands on check-in page                                     │
│  3. Types their name                                           │
│  4. Sees search results                                        │
│  5. Clicks their name                                          │
│  6. Clicks "Check In"                                          │
│  7. Sees confirmation with seating info                        │
└──────────────────────────────────────────────────────────────────┘
```

## Data Flow Diagram

```
FRONTEND (Browser)                  BACKEND (Node.js/Express)      DATABASE (SQLite)
─────────────────────────────────────────────────────────────────────────────────

Guest opens check-in page
    │
    ├─→ GET /checkin/:eventId ──────────→ Serve checkin.html
    │
    └─→ Load event name
        │
        └─→ GET /api/events/:id ────────→ Query events table
                                         ↓
                                    Return event data

Guest types name
    │
    └─→ GET /api/checkin/:eventId/guest?q=name
        │
        └─→ Search guests table ────────→ Query guests WHERE name LIKE ?
                                         ↓
                                    Return matching guests

Guest clicks "Check In"
    │
    └─→ POST /api/checkin/:eventId/guest/:guestId
        │
        ├─→ Check if already checked in
        │   └─→ Query check_ins table
        │
        └─→ If not checked in:
            └─→ INSERT into check_ins table ──→ Record check-in
                                              ↓
                                         Return success
```

## File Structure

```
wedding-seating-planner/
│
├── server.js                          # Express server with API endpoints
│   ├── GET /api/events/:id/qr         # Generate QR code
│   ├── GET /checkin/:eventId          # Serve check-in page
│   ├── GET /api/checkin/:eventId/guest # Search guests
│   └── POST /api/checkin/:eventId/guest/:guestId # Record check-in
│
├── package.json                       # Dependencies (includes qrcode)
│
├── wedding.sqlite                     # SQLite database
│   ├── events table
│   ├── guests table
│   ├── tables table
│   └── check_ins table (NEW)
│
└── public/
    ├── index.html                     # Main event management page
    │   └── QR code display panel (NEW)
    │
    ├── app.js                         # Main app logic
    │   └── loadQRCode() function (NEW)
    │
    ├── style.css                      # Main styling
    │
    ├── checkin.html (NEW)             # Check-in landing page
    ├── checkin.js (NEW)               # Check-in page logic
    └── checkin-style.css (NEW)        # Check-in page styling
```

## Database Schema

```
EVENTS TABLE
┌─────────────────────────────────────┐
│ id (PK)                             │
│ name                                │
│ created_at                          │
└─────────────────────────────────────┘
           ↓ (1:N)
GUESTS TABLE
┌─────────────────────────────────────┐
│ id (PK)                             │
│ event_id (FK)                       │
│ name                                │
│ table_number                        │
│ seat_number                         │
│ created_at                          │
└─────────────────────────────────────┘
           ↓ (1:N)
CHECK_INS TABLE (NEW)
┌─────────────────────────────────────┐
│ id (PK)                             │
│ event_id (FK)                       │
│ guest_id (FK)                       │
│ checked_in_at                       │
└─────────────────────────────────────┘
```

## API Endpoints

### 1. Generate QR Code
```
GET /api/events/:id/qr

Request:
  GET http://localhost:3000/api/events/1/qr

Response:
  {
    "qrCode": "data:image/png;base64,...",
    "url": "http://localhost:3000/checkin/1"
  }
```

### 2. Get Check-In Page
```
GET /checkin/:eventId

Request:
  GET http://localhost:3000/checkin/1

Response:
  HTML page with check-in interface
```

### 3. Search Guests
```
GET /api/checkin/:eventId/guest?q=<name>

Request:
  GET http://localhost:3000/api/checkin/1/guest?q=john

Response:
  [
    {
      "id": 42,
      "name": "John Smith",
      "table_number": "6",
      "seat_number": 3,
      "seats": 8,
      "checked_in": 0
    }
  ]
```

### 4. Record Check-In
```
POST /api/checkin/:eventId/guest/:guestId

Request:
  POST http://localhost:3000/api/checkin/1/guest/42
  Content-Type: application/json

Response:
  {
    "checked_in": true,
    "guest": {
      "id": 42,
      "event_id": 1,
      "name": "John Smith",
      "table_number": "6",
      "seat_number": 3,
      "created_at": "2026-08-18 14:24:54"
    }
  }
```

## Component Interaction

```
┌─────────────────────────────────────────────────────────────┐
│                    Event Management Page                    │
│                                                             │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  Event Check-In Panel                                │  │
│  │                                                      │  │
│  │  [QR Code Image]                                    │  │
│  │  [Check-in Link]                                    │  │
│  │                                                      │  │
│  │  Loaded by: loadQRCode()                            │  │
│  │  Data from: GET /api/events/:id/qr                 │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                          ↓ (Guest scans QR)
┌─────────────────────────────────────────────────────────────┐
│                    Check-In Landing Page                    │
│                                                             │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  Event Name                                          │  │
│  │  [Search Input]                                      │  │
│  │  [Search Results]                                    │  │
│  │                                                      │  │
│  │  Guest Details (after selection):                   │  │
│  │  ├─ Name                                            │  │
│  │  ├─ Table                                           │  │
│  │  ├─ Seat                                            │  │
│  │  └─ [Check In Button]                              │  │
│  │                                                      │  │
│  │  Powered by:                                        │  │
│  │  ├─ checkin.html (structure)                        │  │
│  │  ├─ checkin.js (logic)                              │  │
│  │  └─ checkin-style.css (styling)                     │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

## Request/Response Flow

```
1. LOAD CHECK-IN PAGE
   Browser: GET /checkin/1
   Server: Serve checkin.html
   Browser: Load checkin.js and checkin-style.css
   Browser: GET /api/events/1 (load event name)
   Server: Return event data

2. SEARCH FOR GUEST
   Browser: GET /api/checkin/1/guest?q=john
   Server: Query guests table
   Server: Return matching guests
   Browser: Display results

3. SELECT GUEST
   Browser: Display guest details
   Browser: Show table and seat info

4. CHECK IN
   Browser: POST /api/checkin/1/guest/42
   Server: Check if already checked in
   Server: If not, INSERT into check_ins
   Server: Return success
   Browser: Show confirmation

5. DUPLICATE CHECK-IN
   Browser: POST /api/checkin/1/guest/42 (again)
   Server: Find existing check-in
   Server: Return already_checked_in flag
   Browser: Show "Already checked in" message
```

## Security Flow

```
┌─────────────────────────────────────┐
│  Guest Search Request               │
│  GET /api/checkin/:eventId/guest    │
└─────────────────────────────────────┘
           ↓
┌─────────────────────────────────────┐
│  Validate Event ID                  │
│  (Ensure event exists)              │
└─────────────────────────────────────┘
           ↓
┌─────────────────────────────────────┐
│  Validate Search Query              │
│  (Trim and sanitize)                │
└─────────────────────────────────────┘
           ↓
┌─────────────────────────────────────┐
│  Query Database                     │
│  (Parameterized query)              │
└─────────────────────────────────────┘
           ↓
┌─────────────────────────────────────┐
│  Limit Results                      │
│  (Max 20 results)                   │
└─────────────────────────────────────┘
           ↓
┌─────────────────────────────────────┐
│  Return Results                     │
│  (JSON response)                    │
└─────────────────────────────────────┘
```

## Performance Considerations

```
Search Performance:
├─ Real-time search with 200ms debounce
├─ Parameterized queries prevent SQL injection
├─ Limited to 20 results per search
└─ Indexed guest names for fast lookup

Check-In Performance:
├─ Single INSERT per check-in
├─ Duplicate check prevents multiple inserts
├─ Timestamps recorded automatically
└─ Fast lookup by guest_id

QR Code Generation:
├─ Generated on-demand
├─ Cached in browser (localStorage optional)
├─ Data URL format for direct display
└─ No external API calls
```

## Scalability

```
Current Architecture:
├─ Single SQLite database
├─ Local data storage
├─ No external dependencies (except qrcode library)
└─ Suitable for events up to 1000+ guests

Future Improvements:
├─ Add database indexing on guest names
├─ Implement caching for QR codes
├─ Add check-in statistics dashboard
├─ Support multiple concurrent check-ins
└─ Export check-in reports
```

## Error Handling

```
Possible Errors:

1. Event Not Found
   Request: GET /api/events/999/qr
   Response: 404 - Event not found

2. Guest Not Found
   Request: POST /api/checkin/1/guest/999
   Response: 404 - Guest not found

3. Invalid Input
   Request: GET /api/checkin/1/guest?q=
   Response: 200 - Empty array

4. Database Error
   Response: 500 - Internal server error
   (Logged to console)

5. QR Code Generation Error
   Response: 500 - QR code generation failed
```

---

This architecture ensures:
✅ Clean separation of concerns
✅ Secure data handling
✅ Fast performance
✅ Easy maintenance
✅ Scalability for future enhancements
