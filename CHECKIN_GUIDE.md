# Guest Check-In Feature - Quick Start Guide

## What's New?

Your Wedding Seating Planner now includes a **QR Code Check-In System** that lets guests quickly find their seating and check in to your event!

## For Event Organizers

### Step 1: View Your Event
1. Open the Wedding Seating Planner
2. Click on your event to open it
3. Scroll down to see the new "Event Check-In" panel

### Step 2: Share the QR Code
You'll see a QR code in the "Event Check-In" panel. You can:
- **Print it** and display at your venue entrance
- **Email the link** to guests
- **Display it** on screens at the event
- **Share on social media** before the event

### Step 3: Track Check-Ins
Guests who scan the QR code will be able to:
- Search for their name
- See their table and seat assignment
- Check in with one click

---

## For Guests

### How to Check In

#### Option 1: Scan the QR Code
1. Open your phone camera
2. Point it at the QR code
3. Tap the notification that appears
4. You'll be taken to the check-in page

#### Option 2: Use the Direct Link
1. Ask the event organizer for the check-in link
2. Click the link on your phone
3. You'll be taken to the check-in page

### On the Check-In Page

1. **Search for Your Name**
   - Type your first or last name in the search box
   - Results will appear as you type

2. **Select Your Name**
   - Click on your name from the results
   - You'll see your table and seat information

3. **Check In**
   - Click the "Check In" button
   - You'll see a confirmation message
   - Your seating information will be displayed

### What You'll See

After checking in, you'll see:
- ✓ Your full name
- ✓ Your table number
- ✓ Your seat number (if assigned)
- ✓ Total seats at your table
- ✓ A confirmation message

---

## Technical Details

### Check-In URL Format
```
http://your-domain.com/checkin/[EVENT_ID]
```

### QR Code Contains
The QR code encodes the check-in URL for your specific event.

### Data Collected
- Guest name
- Check-in timestamp
- Table and seat information

### Privacy
- Check-in data is stored locally in your database
- No data is shared with third parties
- Only accessible through your event management interface

---

## Troubleshooting

### "No guests found"
- Make sure you've imported your guest list via Excel
- Check that guest names are spelled correctly
- Try searching by first name or last name

### "Already checked in"
- You've already checked in to this event
- If this is an error, contact the event organizer

### QR Code Not Working
- Make sure you're using a phone with a camera
- Try using the direct link instead
- Check that you have internet connection

### Can't Find Your Name
- Ask the event organizer to verify your name in the guest list
- Try different spelling variations
- Contact the event organizer for assistance

---

## Features

✅ **Real-time Search** - Find your name instantly as you type
✅ **Mobile Friendly** - Works perfectly on phones and tablets
✅ **One-Click Check-In** - Simple and fast
✅ **Duplicate Prevention** - Can't check in twice
✅ **Seating Information** - See your table and seat assignment
✅ **Beautiful Design** - Modern, easy-to-use interface

---

## Questions?

Contact your event organizer for:
- The check-in link or QR code
- Help finding your name
- Questions about your seating assignment
