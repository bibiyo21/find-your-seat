#!/usr/bin/env node
// Runs the Express API (server.js) and the Next.js frontend together so
// http://localhost:3000 serves the frontend (proxying /api/* to the API on
// :3001, per frontend/next.config.js). `dev` uses hot-reload dev servers;
// `start` builds the frontend once, then runs both in production mode.
const { spawnSync, spawn } = require("child_process");
const path = require("path");

const mode = process.argv[2];
if (mode !== "dev" && mode !== "start") {
  console.error("Usage: node scripts/run.js <dev|start>");
  process.exit(1);
}

const root = path.join(__dirname, "..");

if (mode === "start") {
  const build = spawnSync("npm", ["--prefix", "frontend", "run", "build"], {
    cwd: root,
    stdio: "inherit",
    shell: true,
  });
  if (build.status !== 0) process.exit(build.status || 1);
}

const apiEnv = { ...process.env };
if (mode === "dev") apiEnv.MONGODB_URI = "";

const children = [
  spawn("node", ["server.js"], { cwd: root, stdio: "inherit", env: apiEnv }),
  spawn("npm", ["--prefix", "frontend", "run", mode === "dev" ? "dev" : "start"], {
    cwd: root,
    stdio: "inherit",
    shell: true,
  }),
];

let shuttingDown = false;
function shutdown(code) {
  if (shuttingDown) return;
  shuttingDown = true;
  for (const child of children) child.kill();
  process.exit(code);
}

for (const child of children) {
  child.on("exit", (code) => shutdown(code || 0));
}
process.on("SIGINT", () => shutdown(0));
process.on("SIGTERM", () => shutdown(0));
