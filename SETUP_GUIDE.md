# 🚀 Setup Guide - SQLite Local / MongoDB Production

## Overview

This app uses:
- **Local Development:** SQLite (no setup needed)
- **Production (Vercel):** MongoDB Atlas

---

## Local Development Setup

### Step 1: Install Dependencies

```bash
npm install
```

This installs:
- `better-sqlite3` - SQLite database
- `mongodb` - MongoDB driver (for production)
- All other dependencies

### Step 2: Start Development Server

```bash
npm start
```

The app will:
- ✅ Automatically use SQLite locally
- ✅ Create `wedding.sqlite` file in project root
- ✅ Auto-create all tables on first run
- ✅ Run on http://localhost:3000

### Step 3: Test Locally

1. Visit http://localhost:3000
2. Create an event
3. Import Excel file
4. Test all features

---

## How It Works

### Database Detection

The app automatically detects which database to use:

```javascript
const USE_MONGODB = process.env.MONGODB_URI ? true : false;
```

**Local (No MONGODB_URI set):**
- Uses SQLite
- Creates `wedding.sqlite` file
- No configuration needed

**Production (MONGODB_URI set):**
- Uses MongoDB Atlas
- Requires `MONGODB_URI` environment variable
- Set in Vercel dashboard

---

## Production Deployment (Vercel)

### Step 1: Set Environment Variable

In Vercel Dashboard:
1. Go to Project Settings
2. Click "Environment Variables"
3. Add: `MONGODB_URI=mongodb+srv://...`

### Step 2: Deploy

```bash
git push origin main
```

Vercel automatically:
- Detects `MONGODB_URI` is set
- Switches to MongoDB mode
- Deploys your app

---

## File Structure

```
wedding-seating-planner/
├── server.js          # Original MongoDB-only version
├── server-dual.js     # NEW: SQLite local + MongoDB production
├── package.json       # Updated with better-sqlite3
├── wedding.sqlite     # Created locally (SQLite database)
└── ...
```

---

## Switching Between Versions

### Use SQLite + MongoDB Dual Mode (Recommended)

```bash
# Rename the dual-mode server
mv server.js server-mongodb.js
mv server-dual.js server.js

# Install dependencies
npm install

# Start (uses SQLite locally)
npm start
```

### Use MongoDB Only (Original)

```bash
# Keep original server.js
# Make sure MONGODB_URI is set
export MONGODB_URI=mongodb+srv://...

npm start
```

---

## Local SQLite Database

### View Data

```bash
# Install sqlite3 CLI
brew install sqlite3  # macOS

# Open database
sqlite3 wedding.sqlite

# View tables
.tables

# View events
SELECT * FROM events;

# View guests
SELECT * FROM guests;

# Exit
.quit
```

### Backup Database

```bash
# Copy database file
cp wedding.sqlite wedding.sqlite.backup

# Or export to JSON
sqlite3 wedding.sqlite ".mode json" "SELECT * FROM events;" > events.json
```

### Reset Database

```bash
# Delete database file
rm wedding.sqlite

# Restart server - new database created automatically
npm start
```

---

## Environment Variables

### Local Development

No environment variables needed! SQLite works out of the box.

### Production (Vercel)

```
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/wedding-planner
```

---

## Troubleshooting

### "better-sqlite3" build error

**Solution:**
```bash
# Rebuild native modules
npm rebuild better-sqlite3

# Or reinstall
npm install --save better-sqlite3
```

### SQLite database locked

**Solution:**
- Close any other connections to the database
- Restart the server

### MongoDB connection error on Vercel

**Solution:**
- Verify `MONGODB_URI` is set in Vercel
- Check connection string is correct
- Verify MongoDB cluster is running

### Data not persisting locally

**Solution:**
- Check `wedding.sqlite` file exists
- Verify file has write permissions
- Try resetting database: `rm wedding.sqlite`

---

## Development Workflow

```bash
# 1. Install dependencies
npm install

# 2. Start development server (uses SQLite)
npm start

# 3. Open browser
# http://localhost:3000

# 4. Create events, import Excel, test features

# 5. When ready to deploy
git add .
git commit -m "Your changes"
git push origin main

# 6. Vercel automatically deploys with MongoDB
```

---

## Comparison

| Feature | Local (SQLite) | Production (MongoDB) |
|---------|---|---|
| Setup | Automatic | Requires MONGODB_URI |
| Performance | Very fast | Network latency |
| Data Persistence | File-based | Cloud-based |
| Backup | Manual | Automatic |
| Scalability | Limited | Unlimited |
| Cost | Free | Free tier available |

---

## Key Features

✅ **Zero Configuration Locally** - Just run `npm start`
✅ **Automatic Database Selection** - Based on environment variables
✅ **Same API** - Code works with both databases
✅ **Easy Deployment** - Just set MONGODB_URI on Vercel
✅ **Fast Development** - SQLite is very fast locally
✅ **Production Ready** - MongoDB for scalability

---

## Next Steps

1. Run `npm install`
2. Run `npm start`
3. Visit http://localhost:3000
4. Start developing!

When ready to deploy:
1. Set `MONGODB_URI` in Vercel
2. Push to GitHub
3. Vercel deploys automatically

---

**Happy developing! 🎉**
