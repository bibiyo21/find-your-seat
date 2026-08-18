# ⚡ Quick Vercel Deployment (5 Minutes)

## TL;DR - Deploy in 5 Steps

### Step 1: Prepare Git Repository

```bash
cd /Users/ibrahemsotejo/Documents/wedding-seating-planner
git init
git add .
git commit -m "Initial commit: Wedding Seating Planner"
```

### Step 2: Create GitHub Repository

1. Go to https://github.com/new
2. Create repository: `wedding-seating-planner`
3. Copy the commands provided

### Step 3: Push to GitHub

```bash
git remote add origin https://github.com/YOUR_USERNAME/wedding-seating-planner.git
git branch -M main
git push -u origin main
```

### Step 4: Deploy to Vercel

1. Go to https://vercel.com/dashboard
2. Click "Add New..." → "Project"
3. Click "Import Git Repository"
4. Select your repository
5. Click "Deploy"

### Step 5: Done! 🎉

Your app is now live at: `https://wedding-seating-planner-xxxxx.vercel.app`

---

## What's Already Set Up

✅ `vercel.json` - Configuration file
✅ `.gitignore` - Git ignore rules
✅ `package.json` - Dependencies
✅ `server.js` - Express server
✅ `public/` - Frontend files

---

## Important Notes

### ⚠️ Database Limitation

SQLite data is **temporary** on Vercel:
- Data resets when function restarts
- Good for demos/testing
- Not for production

### ✅ For Production

Use a cloud database:
- MongoDB (free tier)
- PostgreSQL
- Firebase

See `VERCEL_DEPLOYMENT_GUIDE.md` for details.

---

## Your Deployment URL

After deployment, you'll get a URL like:

```
https://wedding-seating-planner-xxxxx.vercel.app
```

Share this with guests!

---

## Redeploy After Changes

```bash
git add .
git commit -m "Your changes"
git push origin main
```

Vercel automatically redeploys! 🚀

---

## Troubleshooting

**Build fails?**
- Check build logs in Vercel dashboard
- Verify all files are committed

**Pages not loading?**
- Check `vercel.json` configuration
- Verify `public/` directory exists

**Database errors?**
- Expected - SQLite is temporary on Vercel
- Use cloud database for production

---

## Next Steps

1. Follow the 5 steps above
2. Test your deployed app
3. Share URL with guests
4. For production, set up a cloud database

**Questions?** See `VERCEL_DEPLOYMENT_GUIDE.md` for detailed guide.

Happy deploying! 🎊
