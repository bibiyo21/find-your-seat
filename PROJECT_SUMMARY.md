# 🎊 Wedding Seating Planner - Complete Project Summary

## 📋 Project Overview

**Wedding Seating Planner** is a full-stack web application for managing wedding guest seating arrangements. It allows event organizers to create events, import guest lists, manage table assignments, and generate QR codes for guest check-in.

**Live App:** https://find-your-seat-fx1uk67d9-flow-stack-digital.vercel.app

---

## 🏗️ Architecture

### Tech Stack
- **Frontend:** HTML, CSS, JavaScript (vanilla)
- **Backend:** Node.js + Express.js
- **Database:** MongoDB Atlas
- **Hosting:** Vercel (serverless)
- **File Upload:** Multer (memory storage for Vercel compatibility)
- **Excel Import:** XLSX library
- **QR Code Generation:** QRCode library

### Database Schema

**Collections:**
- `events` - Wedding events
- `guests` - Guest information with seating assignments
- `tables` - Table configurations
- `check_ins` - Guest check-in records

---

## ✨ Features

### 1. Event Management
- ✅ Create new events
- ✅ View all events with statistics
- ✅ Event details page with tables and guests
- ✅ Delete/manage events

### 2. Guest Management
- ✅ Import guests from Excel files (.xlsx, .xls, .csv)
- ✅ Auto-detect columns: name, table, seat
- ✅ Assign guests to tables and seats
- ✅ Search and filter guests
- ✅ Edit guest seating assignments

### 3. Table Management
- ✅ Auto-create tables from Excel import
- ✅ Configure seat counts per table
- ✅ View guest distribution across tables

### 4. Find Your Seat Feature
- ✅ Public guest lookup page (`/events/{id}`)
- ✅ Guests can search by name
- ✅ Display seating information
- ✅ QR code for easy access

### 5. QR Code Generation
- ✅ Generate QR codes for each event
- ✅ QR codes link to guest lookup page
- ✅ Download high-resolution QR codes (1000x1000px)
- ✅ Perfect for printing

---

## 🚀 Deployment

### Vercel Setup
- **Project:** find-your-seat
- **Team:** flow-stack-digital
- **URL:** https://find-your-seat-fx1uk67d9-flow-stack-digital.vercel.app

### Environment Variables
```
MONGODB_URI=<your-mongodb-connection-string>
```

### Key Fixes Applied
1. **Multer Memory Storage** - Uses memory storage instead of disk (Vercel serverless compatibility)
2. **Excel Buffer Parsing** - Uses buffer instead of file path for Excel import
3. **ObjectId Validation** - Validates MongoDB ObjectIds before use to prevent errors

---

## 📍 Routes

### Frontend Routes
- `/` - Event management dashboard
- `/find-your-seat` - Events list for public access
- `/events/{id}` - Guest lookup/Find Your Seat page

### API Routes

**Event Management:**
- `GET /api/events` - List all events
- `POST /api/events` - Create new event
- `GET /api/events/{id}` - Get event details
- `PUT /api/events/{id}/tables/{tableId}` - Update table seats
- `PUT /api/events/{id}/guests/{guestId}` - Update guest seating
- `POST /api/events/{id}/import` - Import Excel file
- `GET /api/events/{id}/search` - Search guests
- `GET /api/events/{id}/qr` - Generate QR code

**Guest Lookup:**
- `GET /api/events/{eventId}/guest` - Search guests for public lookup
- `POST /api/events/{eventId}/guest/{guestId}` - Record guest check-in

---

## 🎯 Recent Enhancements

### 1. Route Restructuring
- Changed `/find-your-seat/{eventId}` to `/events/{id}`
- Simplified and more intuitive URL structure
- Updated all API endpoints accordingly

### 2. Clickable Event Cards
- Event cards are now fully clickable
- Added cursor pointer for better UX
- Redirects to event details page

### 3. QR Code Download
- Added "⬇ Download QR Code" button
- Generates high-resolution 1000x1000px PNG
- Unique filename with event ID
- Perfect for printing

### 4. ObjectId Validation
- Added `safeObjectId()` helper function
- Validates MongoDB ObjectId format before use
- Prevents "input must be a 24 character hex string" errors
- Better error handling across all routes

### 5. Vercel Deployment Fixes
- Fixed multer directory creation error
- Implemented memory storage for file uploads
- Updated Excel parsing to use buffers
- App now fully compatible with Vercel serverless

---

## 📊 File Structure

```
wedding-seating-planner/
├── server.js                 # Express backend
├── package.json             # Dependencies
├── vercel.json              # Vercel config
├── public/
│   ├── index.html           # Event management page
│   ├── app.js               # Event management logic
│   ├── checkin.html         # Guest lookup page
│   ├── checkin.js           # Guest lookup logic
│   ├── checkin-select.html  # Events list page
│   ├── checkin-select.js    # Events list logic
│   ├── style.css            # Styling
│   └── checkin-style.css    # Guest lookup styling
├── .gitignore
└── PROJECT_SUMMARY.md       # This file
```

---

## 🔧 Development

### Local Setup
```bash
# Install dependencies
npm install

# Start development server
npm start

# Server runs on http://localhost:3000
```

### Database
- Uses MongoDB Atlas
- Connection string stored in `MONGODB_URI` environment variable
- Collections auto-created on first run

### Testing Locally
1. Create an event
2. Import sample Excel file
3. Verify guests appear
4. Test Find Your Seat feature
5. Download QR code

---

## 🐛 Known Issues & Fixes

### Issue: "input must be a 24 character hex string"
**Cause:** Invalid MongoDB ObjectId format
**Fix:** Added ObjectId validation with `safeObjectId()` helper

### Issue: Multer directory creation error on Vercel
**Cause:** Vercel serverless doesn't support persistent file storage
**Fix:** Switched to memory storage for multer

### Issue: Excel import failing on Vercel
**Cause:** File path doesn't exist with memory storage
**Fix:** Changed to buffer-based parsing with `XLSX.read()`

---

## 📈 Performance

- **Frontend:** Vanilla JavaScript (no frameworks, minimal bundle)
- **Backend:** Express.js with async/await
- **Database:** MongoDB with indexed queries
- **Hosting:** Vercel edge network for fast global delivery
- **File Uploads:** Memory storage (no disk I/O)

---

## 🔐 Security

- ✅ Input validation on all routes
- ✅ ObjectId validation prevents injection
- ✅ Error messages don't expose sensitive info
- ✅ CORS headers configured
- ✅ No secrets in code (uses environment variables)

---

## 📱 Browser Support

- ✅ Chrome/Edge (latest)
- ✅ Firefox (latest)
- ✅ Safari (latest)
- ✅ Mobile browsers

---

## 🎓 How to Use

### For Event Organizers

1. **Create Event**
   - Click "+ New Event"
   - Enter event name
   - Click "Create Event"

2. **Import Guests**
   - Click "Import Excel"
   - Select Excel file with columns: Name, Table, Seat
   - Guests and tables auto-created

3. **Manage Seating**
   - Adjust seat counts per table
   - Assign guests to tables/seats
   - Search for specific guests

4. **Share with Guests**
   - Download QR code
   - Print and display at event
   - Or share `/events/{id}` link

### For Guests

1. **Find Your Seat**
   - Scan QR code or visit link
   - Search for your name
   - View your table and seat number

---

## 🚀 Deployment Checklist

- ✅ Code pushed to GitHub
- ✅ Vercel project created
- ✅ MongoDB Atlas database configured
- ✅ MONGODB_URI environment variable set
- ✅ Multer memory storage configured
- ✅ ObjectId validation implemented
- ✅ QR code download feature added
- ✅ Routes updated to `/events/{id}`
- ✅ Event cards made clickable
- ✅ All tests passing

---

## 📞 Support

- **GitHub:** https://github.com/bibiyo21/find-your-seat
- **Vercel Dashboard:** https://vercel.com/flow-stack-digital/find-your-seat
- **MongoDB Atlas:** https://cloud.mongodb.com

---

## 📝 Version History

### Latest (Current)
- ✅ QR code download feature
- ✅ Route restructuring to `/events/{id}`
- ✅ Clickable event cards
- ✅ ObjectId validation
- ✅ Vercel deployment fixes

### Previous Versions
- Event management system
- Excel import functionality
- Guest lookup feature
- QR code generation
- Find Your Seat feature

---

## 🎉 Project Status

**Status:** ✅ **PRODUCTION READY**

All features implemented and tested. App is live and ready for use!

---

**Last Updated:** August 18, 2026
**Deployed:** Vercel (Automatic)
**Database:** MongoDB Atlas
**Status:** 🟢 Live & Operational

---

*Built with ❤️ for wedding planning*
