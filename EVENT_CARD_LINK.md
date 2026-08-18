# 🔗 Event Card - Find Your Seat Link

## Overview

Each event card on the main page (`http://localhost:3000/`) now includes a **"Find Your Seat →"** link that directs guests to the Find Your Seat page for that specific event.

---

## Change Made

### Updated File
- `public/app.js` - Modified `loadEvents()` function

### What Changed
Added a "Find Your Seat →" link to each event card that:
- Opens the Find Your Seat page for that event
- Opens in a new tab (doesn't leave event management)
- Styled as a button matching the design
- Event-specific (each card links to its own event)

---

## Event Card Layout

### Before
```
┌─────────────────────────────────┐
│ Ibrahem And Sheila Wedding      │
│ 14 tables · 120 guests · 120... │
└─────────────────────────────────┘
```

### After
```
┌─────────────────────────────────┐
│ Ibrahem And Sheila Wedding      │
│ 14 tables · 120 guests · 120... │
│                                 │
│ [Find Your Seat →]              │
└─────────────────────────────────┘
```

---

## Link Details

### Link Text
```
Find Your Seat →
```

### Link URL
```
/checkin/{eventId}
```

### Examples
- Event 1: `/checkin/1`
- Event 2: `/checkin/2`
- Event 3: `/checkin/3`

### Link Behavior
- Opens in new tab (`target="_blank"`)
- Doesn't leave event management page
- Styled as a dark button with white text

---

## How It Works

### User Flow
```
1. User visits: http://localhost:3000/
   ↓
2. Sees list of event cards
   ↓
3. Each card displays:
   • Event name
   • Table count
   • Guest count
   • Seat count
   • "Find Your Seat →" link (NEW)
   ↓
4. User clicks "Find Your Seat →"
   ↓
5. Opens Find Your Seat page in new tab
   ↓
6. Guest can search for their name and view seating
```

---

## Code Changes

### Before
```javascript
events.forEach(e=>{
  const d=document.createElement("div");
  d.className="card";
  d.innerHTML=`<h3>${esc(e.name)}</h3><div class="muted">${e.table_count} tables · ${e.guest_count} guests · ${e.seat_count} seats</div>`;
  d.onclick=()=>openEvent(e.id);
  box.appendChild(d)
})
```

### After
```javascript
events.forEach(e=>{
  const d=document.createElement("div");
  d.className="card";
  d.innerHTML=`<h3>${esc(e.name)}</h3><div class="muted">${e.table_count} tables · ${e.guest_count} guests · ${e.seat_count} seats</div><div style="margin-top:12px;"><a href="/checkin/${e.id}" target="_blank" style="display:inline-block;padding:8px 12px;background:#292723;color:#fff;border-radius:6px;text-decoration:none;font-size:14px;font-weight:600;">Find Your Seat →</a></div>`;
  d.onclick=()=>openEvent(e.id);
  box.appendChild(d)
})
```

---

## Features

✅ **Direct Access**
- One-click access to Find Your Seat page
- No need to manually type URL

✅ **New Tab**
- Opens in new tab
- Doesn't interrupt event management workflow
- Can manage events and check seating simultaneously

✅ **Styled Button**
- Matches event management design
- Clear call-to-action
- Professional appearance

✅ **Event-Specific**
- Each event has its own link
- Links to correct Find Your Seat page
- Automatic for all events

---

## Testing

✅ **Event Cards Display**
- URL: `http://localhost:3000/`
- Status: Working

✅ **Find Your Seat Link**
- Present on all event cards
- Status: Working

✅ **Link Functionality**
- Opens correct Find Your Seat page
- Status: Working

✅ **Opens in New Tab**
- Uses `target="_blank"`
- Status: Working

✅ **Styling**
- Matches event management design
- Status: Working

---

## Usage

### For Event Organizers
1. Visit `http://localhost:3000/`
2. See all events with cards
3. Click "Find Your Seat →" to preview the guest experience
4. Opens in new tab so you can continue managing events

### For Guests
1. Receive check-in link or scan QR code
2. Or click "Find Your Seat →" from event card
3. Search for their name
4. View their seating information

---

## Summary

✅ **Change:** Added "Find Your Seat →" link to event cards
✅ **Location:** `http://localhost:3000/`
✅ **File Updated:** `public/app.js`
✅ **Functionality:** Opens Find Your Seat page in new tab
✅ **Status:** Tested and working

All event cards now include a convenient link to the Find Your Seat page! 🎉
