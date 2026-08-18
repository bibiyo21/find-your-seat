# Wedding Seating Planner - QR Code Check-In Feature

## Overview
This enhancement adds a QR code-based guest check-in system to the Wedding Seating Planner. Guests can now scan a QR code or visit a direct link to search for their name and check in to the event.

## Features Added

### 1. QR Code Generation
- **Endpoint**: `GET /api/events/:id/qr`
- Generates a unique QR code for each event
- QR code links to the event's check-in landing page
- Returns both QR code image (as Data URL) and the check-in URL

### 2. Check-In Landing Page
- **Route**: `/checkin/:eventId`
- Beautiful, mobile-friendly interface
- Guests can search for their name in real-time
- Displays seating information (table, seat number)
- One-click check-in functionality
- Visual feedback for successful check-ins and duplicate attempts

### 3. Guest Check-In API
- **Search Endpoint**: `GET /api/checkin/:eventId/guest?q=<name>`
  - Real-time guest search by name
  - Returns guest details including table, seat, and check-in status
  - Limits results to 20 matches

- **Check-In Endpoint**: `POST /api/checkin/:eventId/guest/:guestId`
  - Records guest check-in with timestamp
  - Prevents duplicate check-ins
  - Returns guest information and check-in status

### 4. Check-In Tracking
- New database table `check_ins` tracks:
  - Event ID
  - Guest ID
  - Check-in timestamp
  - Automatic cascade deletion with events

### 5. Event Management UI Enhancement
- QR code display panel in event management interface
- Shows QR code image and clickable check-in link
- Easy sharing with guests

## Database Schema

### New Table: check_ins
```sql
CREATE TABLE check_ins (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  event_id INTEGER NOT NULL,
  guest_id INTEGER NOT NULL,
  checked_in_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(event_id) REFERENCES events(id) ON DELETE CASCADE,
  FOREIGN KEY(guest_id) REFERENCES guests(id) ON DELETE CASCADE
);
```

## Files Modified/Created

### Modified Files
- `server.js` - Added QR code generation and check-in endpoints
- `public/index.html` - Added QR code display panel
- `public/app.js` - Added QR code loading functionality

### New Files
- `public/checkin.html` - Check-in landing page
- `public/checkin.js` - Check-in page logic
- `public/checkin-style.css` - Check-in page styling

### Dependencies Added
- `qrcode` - QR code generation library

## How to Use

### For Event Organizers
1. Create or open an event in the Wedding Seating Planner
2. Import guest list via Excel
3. Scroll to the "Event Check-In" panel
4. Share the QR code with guests (print, display, or email the link)

### For Guests
1. Scan the QR code with their phone camera
2. Or visit the check-in link directly
3. Type their name in the search box
4. Select their name from the results
5. Click "Check In" to confirm
6. See their table and seat assignment

## API Examples

### Get QR Code
```bash
curl http://localhost:3000/api/events/1/qr
```

Response:
```json
{
  "qrCode": "data:image/png;base64,...",
  "url": "http://localhost:3000/checkin/1"
}
```

### Search for Guest
```bash
curl "http://localhost:3000/api/checkin/1/guest?q=john"
```

Response:
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

### Check In Guest
```bash
curl -X POST http://localhost:3000/api/checkin/1/guest/42 \
  -H "Content-Type: application/json"
```

Response:
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

## Features

### Check-In Page
- ✅ Real-time name search with debouncing
- ✅ Mobile-responsive design
- ✅ Visual feedback for check-ins
- ✅ Duplicate check-in prevention
- ✅ Display of table and seat information
- ✅ Beautiful, modern UI with animations

### Event Management
- ✅ QR code display in event details
- ✅ Direct check-in link
- ✅ Integration with existing guest list

### Data Tracking
- ✅ Check-in timestamps
- ✅ Duplicate prevention
- ✅ Guest information retrieval

## Future Enhancements
- Check-in statistics dashboard (show who's checked in)
- Bulk check-in via QR code scanning
- Email/SMS notifications for check-ins
- Check-in confirmation messages
- Admin panel to view check-in status
- Export check-in reports

## Testing

The feature has been tested with:
- QR code generation
- Guest search functionality
- Check-in recording
- Duplicate check-in prevention
- Mobile responsiveness
- API endpoints

All endpoints are working correctly and the check-in page is fully functional.
