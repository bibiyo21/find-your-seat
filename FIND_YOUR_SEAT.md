# 🪑 Find Your Seat - Feature Documentation

## Overview

"Find Your Seat" is a guest-facing feature that allows wedding guests to:
1. Search for their name
2. Find their assigned table and seat
3. Confirm their seating arrangement

## Routes

### 1. **Event Selection Page**
```
GET http://localhost:3000/checkin
```

**Purpose:** Guests select which event they're attending

**Page Layout:**
```
┌─────────────────────────────────┐
│     ♥ Find Your Seat            │
│     Select Your Event           │
├─────────────────────────────────┤
│ [Search Input]                  │
│ Available Events:               │
│ • Ibrahem And Sheila Wedding    │
│ • Another Wedding               │
└─────────────────────────────────┘
```

---

### 2. **Find Your Seat Page**
```
GET http://localhost:3000/checkin/{eventId}
```

**Examples:**
```
http://localhost:3000/checkin/1
http://localhost:3000/checkin/2
```

**Purpose:** Guests search for their name and find their seating

**Page Layout:**
```
┌─────────────────────────────────┐
│     ♥ Find Your Seat            │
│     Ibrahem And Sheila Wedding  │
├─────────────────────────────────┤
│ Find Your Name                  │
│ [Search Input]                  │
│ Search Results:                 │
│ • John Smith (Table 6)          │
│ • Jane Doe (Table 5)            │
│                                 │
│ Your Seating:                   │
│ ┌─────────────────────────────┐ │
│ │ John Smith                  │ │
│ │ Table: 6                    │ │
│ │ Seat: 3                     │ │
│ │ Seats at Table: 8           │ │
│ │ [Confirm Button]            │ │
│ │ [Back to Search]            │ │
│ └─────────────────────────────┘ │
└─────────────────────────────────┘
```

---

## Features

✅ **Event Selection** - Choose which event to find seating for
✅ **Real-Time Search** - Search for your name as you type
✅ **Instant Results** - See matching guests immediately
✅ **Seating Information** - View your table and seat number
✅ **Confirmation** - Confirm your seating arrangement
✅ **Mobile Responsive** - Works on all devices
✅ **Beautiful Design** - Modern, easy-to-use interface
✅ **Duplicate Prevention** - Can't confirm twice

---

## User Flow

### Flow 1: Guest Scans QR Code
```
1. Guest scans QR code
   ↓
2. Lands on: http://localhost:3000/checkin/1
   ↓
3. Searches for their name
   ↓
4. Clicks their name from results
   ↓
5. Sees their table and seat
   ↓
6. Clicks "Confirm"
   ↓
7. Sees confirmation message
```

### Flow 2: Guest Uses Generic Link
```
1. Guest visits: http://localhost:3000/checkin
   ↓
2. Sees list of available events
   ↓
3. Searches and selects their event
   ↓
4. Redirected to: http://localhost:3000/checkin/{eventId}
   ↓
5. Searches for their name
   ↓
6. Clicks their name
   ↓
7. Sees their table and seat
   ↓
8. Clicks "Confirm"
   ↓
9. Sees confirmation message
```

---

## API Endpoints

### 1. Get All Events
```
GET /api/checkin/events/list
```

**Response:**
```json
[
  {
    "id": 1,
    "name": "Ibrahem And Sheila Wedding"
  }
]
```

---

### 2. Search for Guests
```
GET /api/checkin/{eventId}/guest?q={name}
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
    "name": "John Smith",
    "table_number": "6",
    "seat_number": 3,
    "seats": 8,
    "checked_in": 0
  }
]
```

---

### 3. Confirm Seating
```
POST /api/checkin/{eventId}/guest/{guestId}
```

**Example:**
```
POST /api/checkin/1/guest/42
```

**Response (First Confirmation):**
```json
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

**Response (Duplicate Confirmation):**
```json
{
  "already_checked_in": true,
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

---

## QR Code Integration

Each event has a unique QR code that contains the event-specific URL:

**QR Code for Event 1 contains:**
```
http://localhost:3000/checkin/1
```

When guests scan the QR code, they're taken directly to the "Find Your Seat" page for that event.

---

## Files Involved

### Frontend
- `public/checkin-select.html` - Event selection page
- `public/checkin-select.js` - Event selection logic
- `public/checkin.html` - Find your seat page
- `public/checkin.js` - Find your seat logic
- `public/checkin-style.css` - Styling

### Backend Routes
- `GET /checkin` - Event selection page
- `GET /checkin/:eventId` - Find your seat page
- `GET /api/checkin/events/list` - Get all events
- `GET /api/checkin/:eventId/guest` - Search guests
- `POST /api/checkin/:eventId/guest/:guestId` - Confirm seating

---

## Testing

### Test Event Selection Page
```bash
curl http://localhost:3000/checkin
```

### Test Find Your Seat Page
```bash
curl http://localhost:3000/checkin/1
```

### Test Get Events
```bash
curl http://localhost:3000/api/checkin/events/list
```

### Test Search Guests
```bash
curl "http://localhost:3000/api/checkin/1/guest?q=john"
```

### Test Confirm Seating
```bash
curl -X POST http://localhost:3000/api/checkin/1/guest/42 \
  -H "Content-Type: application/json"
```

---

## Browser Links

**Event Selection:**
```
http://localhost:3000/checkin
```

**Event 1 - Find Your Seat:**
```
http://localhost:3000/checkin/1
```

**Event 2 - Find Your Seat:**
```
http://localhost:3000/checkin/2
```

---

## Summary

✅ **Two Routes:**
- `http://localhost:3000/checkin` - Select event
- `http://localhost:3000/checkin/{eventId}` - Find your seat

✅ **Three API Endpoints:**
- Get all events
- Search guests
- Confirm seating

✅ **Fully Functional:**
- Real-time search
- Mobile responsive
- Beautiful UI
- QR code ready

All features are tested and ready to use! 🎉
