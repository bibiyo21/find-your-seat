# 🚀 Vercel Deployment Guide - Wedding Seating Planner

## Overview

This guide will help you deploy the Wedding Seating Planner to Vercel. Vercel is a serverless platform that makes it easy to deploy Node.js applications.

---

## Prerequisites

Before you start, make sure you have:

1. **Git** - Version control system
2. **GitHub Account** - To host your repository
3. **Vercel Account** - Free account at https://vercel.com
4. **Node.js** - Already installed locally

---

## Step 1: Prepare Your Project for Vercel

### 1.1 Create a `vercel.json` Configuration File

Create a new file `vercel.json` in the root directory:

```json
{
  "version": 2,
  "builds": [
    {
      "src": "server.js",
      "use": "@vercel/node"
    },
    {
      "src": "public/**/*",
      "use": "@vercel/static"
    }
  ],
  "routes": [
    {
      "src": "/public/(.*)",
      "dest": "/public/$1"
    },
    {
      "src": "/(.*)",
      "dest": "/server.js"
    }
  ],
  "env": {
    "NODE_ENV": "production"
  }
}
```

### 1.2 Update `package.json`

Make sure your `package.json` has the correct start script:

```json
{
  "name": "wedding-seating-planner",
  "version": "1.0.0",
  "private": true,
  "description": "Wedding seating planner with Excel import and SQLite storage",
  "main": "server.js",
  "scripts": {
    "start": "node server.js",
    "dev": "node server.js"
  },
  "dependencies": {
    "better-sqlite3": "^11.10.0",
    "express": "^5.1.0",
    "multer": "^2.0.2",
    "xlsx": "^0.18.5",
    "qrcode": "^1.5.4"
  }
}
```

### 1.3 Create `.gitignore`

Create a `.gitignore` file to exclude unnecessary files:

```
node_modules/
uploads/
wedding.sqlite
.env
.DS_Store
*.log
```

---

## Step 2: Push to GitHub

### 2.1 Initialize Git Repository

```bash
cd /Users/ibrahemsotejo/Documents/wedding-seating-planner
git init
git add .
git commit -m "Initial commit: Wedding Seating Planner"
```

### 2.2 Create GitHub Repository

1. Go to https://github.com/new
2. Create a new repository named `wedding-seating-planner`
3. Do NOT initialize with README, .gitignore, or license

### 2.3 Push to GitHub

```bash
git remote add origin https://github.com/YOUR_USERNAME/wedding-seating-planner.git
git branch -M main
git push -u origin main
```

Replace `YOUR_USERNAME` with your actual GitHub username.

---

## Step 3: Deploy to Vercel

### 3.1 Connect Vercel to GitHub

1. Go to https://vercel.com/dashboard
2. Click "Add New..." → "Project"
3. Click "Import Git Repository"
4. Select your `wedding-seating-planner` repository
5. Click "Import"

### 3.2 Configure Project Settings

**Project Name:** `wedding-seating-planner` (or your preferred name)

**Framework Preset:** `Other` (since it's a custom Node.js app)

**Root Directory:** `./` (leave as default)

**Build Command:** Leave empty (Vercel will auto-detect)

**Output Directory:** Leave empty

**Environment Variables:** (Skip for now, we'll add them if needed)

### 3.3 Deploy

Click "Deploy" and wait for the deployment to complete.

Once deployed, you'll get a URL like: `https://wedding-seating-planner-xxxxx.vercel.app`

---

## Step 4: Important Considerations

### 4.1 Database Persistence Issue

**⚠️ Important:** SQLite databases on Vercel are ephemeral (temporary). This means:
- Data will be lost when the function restarts
- Not suitable for production use with persistent data

### 4.2 Solutions for Production

#### Option 1: Use a Cloud Database (Recommended)

Replace SQLite with a cloud database like:
- **MongoDB** (Free tier available)
- **PostgreSQL** (Vercel Postgres)
- **Firebase** (Google's platform)

#### Option 2: Use Vercel KV (Redis)

Vercel offers KV storage for caching and temporary data.

#### Option 3: Use Vercel Postgres

Vercel's managed PostgreSQL database:

```bash
vercel env pull
```

Then update your code to use PostgreSQL instead of SQLite.

---

## Step 5: Alternative - Deploy with Database

### 5.1 Using MongoDB (Recommended for Beginners)

1. **Create MongoDB Account:**
   - Go to https://www.mongodb.com/cloud/atlas
   - Sign up for free
   - Create a cluster

2. **Get Connection String:**
   - In MongoDB Atlas, click "Connect"
   - Choose "Connect your application"
   - Copy the connection string

3. **Add to Vercel Environment Variables:**
   - In Vercel dashboard, go to Settings → Environment Variables
   - Add: `MONGODB_URI` = your connection string

4. **Update server.js** to use MongoDB instead of SQLite

### 5.2 Using Vercel Postgres

1. **Add Postgres Database:**
   - In Vercel dashboard, go to Storage
   - Click "Create Database"
   - Select "Postgres"

2. **Vercel will provide connection details**

3. **Update server.js** to use Postgres

---

## Step 6: Deploy with Current Setup (Temporary Data)

If you want to deploy as-is for demo purposes:

### 6.1 Deployment Steps

1. Create `vercel.json` (as shown in Step 1.1)
2. Push to GitHub
3. Import to Vercel
4. Deploy

### 6.2 Limitations

- Data resets when the function restarts
- Good for demos and testing
- Not suitable for production

---

## Step 7: Custom Domain (Optional)

### 7.1 Add Custom Domain

1. In Vercel dashboard, go to your project
2. Click "Settings" → "Domains"
3. Click "Add Domain"
4. Enter your domain name
5. Follow instructions to update DNS records

### 7.2 Example Domains

- `wedding-seating.com`
- `seating-planner.com`
- `your-name-wedding.com`

---

## Step 8: Environment Variables (Optional)

### 8.1 Add Environment Variables

In Vercel dashboard:

1. Go to Settings → Environment Variables
2. Add variables as needed:

```
NODE_ENV=production
PORT=3000
```

### 8.2 Access in Code

```javascript
const port = process.env.PORT || 3000;
const env = process.env.NODE_ENV;
```

---

## Step 9: Monitoring and Logs

### 9.1 View Logs

In Vercel dashboard:

1. Go to your project
2. Click "Deployments"
3. Click on a deployment
4. Click "Runtime Logs" to see real-time logs

### 9.2 Monitor Performance

- Check "Analytics" tab for traffic and performance
- Monitor error rates
- Check response times

---

## Step 10: Troubleshooting

### Issue: Build Fails

**Solution:**
1. Check build logs in Vercel
2. Make sure all dependencies are in `package.json`
3. Verify `server.js` is in root directory
4. Check for syntax errors

### Issue: Database Connection Error

**Solution:**
1. Verify database connection string
2. Check environment variables are set
3. Ensure database is accessible from Vercel

### Issue: Static Files Not Loading

**Solution:**
1. Verify `public` directory exists
2. Check `vercel.json` routes configuration
3. Ensure files are committed to Git

### Issue: Port Already in Use

**Solution:**
1. Vercel automatically assigns a port
2. Don't hardcode port in code
3. Use `process.env.PORT || 3000`

---

## Step 11: Update and Redeploy

### 11.1 Make Changes Locally

```bash
# Make changes to your code
git add .
git commit -m "Update feature"
git push origin main
```

### 11.2 Automatic Redeploy

Vercel automatically redeploys when you push to GitHub!

### 11.3 Manual Redeploy

In Vercel dashboard:
1. Go to Deployments
2. Click "Redeploy" on any deployment

---

## Step 12: Production Checklist

Before going live:

- [ ] Test all features locally
- [ ] Set up database (if needed)
- [ ] Configure environment variables
- [ ] Add custom domain (optional)
- [ ] Test on deployed URL
- [ ] Set up error monitoring
- [ ] Configure backups (if using database)
- [ ] Test mobile responsiveness
- [ ] Check performance metrics

---

## Quick Deployment Summary

### For Demo/Testing (Current Setup)

```bash
# 1. Create vercel.json
# 2. Push to GitHub
# 3. Import to Vercel
# 4. Deploy
```

### For Production (With Database)

```bash
# 1. Set up MongoDB or PostgreSQL
# 2. Update server.js for database
# 3. Create vercel.json
# 4. Add environment variables
# 5. Push to GitHub
# 6. Import to Vercel
# 7. Deploy
```

---

## Useful Links

- **Vercel Documentation:** https://vercel.com/docs
- **Node.js on Vercel:** https://vercel.com/docs/functions/nodejs
- **Environment Variables:** https://vercel.com/docs/projects/environment-variables
- **Custom Domains:** https://vercel.com/docs/concepts/projects/domains
- **MongoDB Atlas:** https://www.mongodb.com/cloud/atlas
- **Vercel Postgres:** https://vercel.com/postgres

---

## Support

For issues or questions:

1. Check Vercel documentation
2. Review deployment logs
3. Check GitHub repository
4. Contact Vercel support

---

## Next Steps

1. Create `vercel.json` file
2. Push to GitHub
3. Deploy to Vercel
4. Test your deployed application
5. Share your URL with guests!

**Happy deploying!** 🚀
