const fs = require("fs");
const path = require("path");

// Get current timestamp
const timestamp = Math.floor(Date.now() / 1000);

console.log(`Updating cache-bust version to: ${timestamp}`);

// Files to update
const files = [
  "public/index.html",
  "public/checkin.html",
  "public/checkin-select.html"
];

files.forEach(file => {
  const filePath = path.join(__dirname, file);
  let content = fs.readFileSync(filePath, "utf8");
  
  // Replace all ?v=NUMBER with ?v=TIMESTAMP
  content = content.replace(/\?v=\d+/g, `?v=${timestamp}`);
  
  fs.writeFileSync(filePath, content, "utf8");
  console.log(`✓ Updated ${file}`);
});

console.log(`\n✅ All files updated with timestamp: ${timestamp}`);
