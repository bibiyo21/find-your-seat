# ⚡ Quick Start Guide

## Development (SQLite)

```bash
npm install
npm run dev
```

✅ Uses SQLite locally
✅ No setup needed
✅ Fast development
✅ Data saved to `wedding.sqlite`

Visit: http://localhost:3000

---

## Production (MongoDB)

```bash
export MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/wedding-planner
npm install
npm start
```

✅ Uses MongoDB Atlas
✅ For production/Vercel
✅ Requires MONGODB_URI

---

## NPM Scripts

| Command | Database | Use Case |
|---------|----------|----------|
| `npm run dev` | SQLite | Local development |
| `npm start` | MongoDB | Production / Vercel |

---

## File Structure

```
wedding-seating-planner/
├── server.js             # single server: MongoDB if MONGODB_URI is set, otherwise SQLite
├── package.json          # npm scripts
├── wedding.sqlite        # SQLite database (created locally)
└── ...
```

---

## Deployment to Vercel

1. Set `MONGODB_URI` in Vercel environment variables
2. Push to GitHub: `git push origin main`
3. Vercel automatically runs: `npm start` (MongoDB)

---

## Troubleshooting

**Error: "MONGODB_URI is not set"**
- You're running `npm start` without MongoDB
- Use `npm run dev` for local development instead

**Error: "Cannot find module 'sql.js'"**
- Run: `npm install`

**SQLite file not found**
- It's created automatically on first run
- Check `wedding.sqlite` exists in project root

---

**Happy coding! 🚀**
