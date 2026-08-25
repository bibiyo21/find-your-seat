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
- `sql.js` - SQLite database (pure JavaScript)
- `mongodb` - MongoDB driver (for production)
- All other dependencies

### Step 2: Start Development Server

**For SQLite (Local Development):**
```bash
npm run dev
```

The app will:
- ✅ Use SQLite locally
- ✅ Create `wedding.sqlite` file in project root
- ✅ Auto-create all tables on first run
- ✅ Run on http://localhost:3000

**For MongoDB (Production Testing):**
```bash
npm start
```

Requires `MONGODB_URI` environment variable to be set.

### Step 3: Test Locally

1. Visit http://localhost:3000
2. Create an event
3. Import Excel file
4. Test all features

---

## How It Works

### One Server, Two Modes

The app has a single server file, `server.js`, that automatically picks its database based on the environment:

**`npm run dev` (Development)**
- Always uses SQLite via sql.js, regardless of `MONGODB_URI`
- No external database needed
- Perfect for local development

**`npm start` (Production)**
- Uses MongoDB Atlas if `MONGODB_URI` is set (via the environment or a `.env` file)
- Falls back to the same local SQLite file if `MONGODB_URI` isn't set
- Used for production and Vercel deployment

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

### Use SQLite (Development)

```bash
npm run dev
```

### Use MongoDB (Production)

```bash
# Set MongoDB URI
export MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/wedding-planner

# Start server
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
npm run dev

# 3. Open browser
# http://localhost:3000

# 4. Create events, import Excel, test features

# 5. When ready to deploy
git add .
git commit -m "Your changes"
git push origin main

# 6. Vercel automatically deploys with MongoDB (npm start)
```

## Production Workflow

```bash
# 1. Set MongoDB URI in Vercel dashboard
# MONGODB_URI=mongodb+srv://...

# 2. Push to GitHub
git push origin main

# 3. Vercel automatically:
# - Runs server.js, which detects the MONGODB_URI environment variable
# - Deploys with MongoDB
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
