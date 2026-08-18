# 🎫 Check-In Routes Documentation

## Available Routes

### 1. **Generic Check-In Page (Event Selection)**
```
GET http://localhost:3000/checkin
```

**Purpose:** Landing page where guests can select which event they're checking in to.

**Page Layout:**
```
┌─────────────────────────────────────┐
│     ♥ Wedding Check-In              │
│     Select Your Event               │
├─────────────────────────────────────┤
│ Search events...                    │
│ [Search Input]                      │
│                                     │
│ Available Events:                   │
│ ┌─────────────────────────────────┐ │
│ │ Ibrahem And Sheila Wedding      │ │
│ │ Click to check in               │ │
│ └─────────────────────────────────┘ │
└─────────────────────────────────────┘
```

**Features:**
- ✅ Lists all available events
- ✅ Search/filter events by name
- ✅ Click event to proceed to check-in
- ✅ Mobile-responsive design

---

### 2. **Event-Specific Check-In Page**
```
GET http://localhost:3000/checkin/{eventId}
```

**Examples:**
```
http://localhost:3000/checkin/1
http://localhost:3000/checkin/2
http://localhost:3000/checkin/3
```

**Purpose:** Check-in page for a specific event where guests search for their name and check in.

**Page Layout:**
```
┌─────────────────────────────────────┐
│     ♥ Wedding Check-In              │
│     Ibrahem And Sheila Wedding      │
├─────────────────────────────────────┤
│ Find Your Name                      │
│ [Search Input]                      │
│                                     │
│ Search Results:                     │
│ ┌─────────────────────────────────┐ │
│ │ John Smith                      │ │
│ │ Table 6 · Seat 3                │ │
│ └─────────────────────────────────┘ │
│                                     │
│ Guest Details (after selection):    │
│ ┌─────────────────────────────────┐ │
│ │ John Smith                      │ │
│ │ Table: 6                        │ │
│ │ Seat: 3                         │ │
│ │ Seats at Table: 8               │ │
│ │ [Check In Button]               │ │
│ │ [Back to Search Button]         │ │
│ └─────────────────────────────────┘ │
└─────────────────────────────────────┘
```

**Features:**
- ✅ Event name displayed
- ✅ Real-time guest search
- ✅ Shows table and seat information
- ✅ One-click check-in
- ✅ Duplicate check-in prevention
- ✅ Mobile-responsive design

---

## API Endpoints

### 1. **Get All Events (for event selection)**
```
GET /api/checkin/events/list
```

**Response:**
```json
[
  {
    "id": 1,
    "name": "Ibrahem And Sheila Wedding"
  },
  {
    "id": 2,
    "name": "Another Wedding"
  }
]
```

---

### 2. **Search Guests in Event**
```
GET /api/checkin/{eventId}/guest?q={searchQuery}
```

**Example:**
```
GET /api/checkin/1/guest?q=john
```

**Response:**
```json
[
  {
    "id": 42,
    "name": "2LT John Rey Robin, PAF",
    "table_number": "6",
    "seat_number": null,
    "seats": 8,
    "checked_in": 0
  }
]
```

---

### 3. **Record Guest Check-In**
```
POST /api/checkin/{eventId}/guest/{guestId}
```

**Example:**
```
POST /api/checkin/1/guest/42
Content-Type: application/json
```

**Response (First Check-In):**
```json
{
  "checked_in": true,
  "guest": {
    "id": 42,
    "event_id": 1,
    "name": "2LT John Rey Robin, PAF",
    "table_number": "6",
    "seat_number": null,
    "created_at": "2026-08-18 14:24:54"
  }
}
```

**Response (Duplicate Check-In):**
```json
{
  "already_checked_in": true,
  "guest": {
    "id": 42,
    "event_id": 1,
    "name": "2LT John Rey Robin, PAF",
    "table_number": "6",
    "seat_number": null,
    "created_at": "2026-08-18 14:24:54"
  }
}
```

---

## Usage Flow

### Flow 1: Guest Scans QR Code
```
1. Guest scans QR code
   ↓
2. QR code contains: http://localhost:3000/checkin/1
   ↓
3. Guest lands on event-specific check-in page
   ↓
4. Guest searches for their name
   ↓
5. Guest clicks their name
   ↓
6. Guest clicks "Check In"
   ↓
7. Check-in recorded with timestamp
   ↓
8. Guest sees confirmation
```

### Flow 2: Guest Uses Generic Link
```
1. Guest visits: http://localhost:3000/checkin
   ↓
2. Guest sees list of available events
   ↓
3. Guest searches and selects their event
   ↓
4. Guest redirected to: http://localhost:3000/checkin/{eventId}
   ↓
5. Guest searches for their name
   ↓
6. Guest clicks their name
   ↓
7. Guest clicks "Check In"
   ↓
8. Check-in recorded with timestamp
   ↓
9. Guest sees confirmation
```

---

## Files Involved

### Frontend Files
- `public/checkin-select.html` - Event selection page
- `public/checkin-select.js` - Event selection logic
- `public/checkin.html` - Event-specific check-in page
- `public/checkin.js` - Check-in page logic
- `public/checkin-style.css` - Shared styling

### Backend Routes
- `GET /checkin` - Event selection page
- `GET /checkin/:eventId` - Event-specific check-in page
- `GET /api/checkin/events/list` - List all events
- `GET /api/checkin/:eventId/guest` - Search guests
- `POST /api/checkin/:eventId/guest/:guestId` - Record check-in

---

## Testing the Routes

### Test 1: Visit Event Selection Page
```bash
curl http://localhost:3000/checkin
```

### Test 2: Visit Event-Specific Check-In Page
```bash
curl http://localhost:3000/checkin/1
```

### Test 3: Get All Events
```bash
curl http://localhost:3000/api/checkin/events/list
```

### Test 4: Search for a Guest
```bash
curl "http://localhost:3000/api/checkin/1/guest?q=john"
```

### Test 5: Check In a Guest
```bash
curl -X POST http://localhost:3000/api/checkin/1/guest/42 \
  -H "Content-Type: application/json"
```

---

## URL Examples

### For Event 1 (Ibrahem And Sheila Wedding)
```
http://localhost:3000/checkin/1
```

### For Event 2
```
http://localhost:3000/checkin/2
```

### Generic Check-In (Select Event First)
```
http://localhost:3000/checkin
```

---

## QR Code Generation

The QR code generated for each event contains the event-specific check-in URL:

```
QR Code for Event 1 contains:
http://localhost:3000/checkin/1

QR Code for Event 2 contains:
http://localhost:3000/checkin/2
```

When guests scan the QR code, they're taken directly to their event's check-in page.

---

## Summary

✅ **Generic Route:** `http://localhost:3000/checkin` - Event selection
✅ **Event-Specific Route:** `http://localhost:3000/checkin/{eventId}` - Check-in page
✅ **API Endpoints:** 3 new endpoints for events, search, and check-in
✅ **Mobile Responsive:** Both pages work on all devices
✅ **QR Code Ready:** QR codes contain the event-specific URL

All routes are fully functional and tested! 🎉
