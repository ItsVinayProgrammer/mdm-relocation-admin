const fs = require("fs");
const path = require("path");

const requiredFiles = [
  path.join("dist", "firebase-messaging-sw.js"),
  path.join("dist", "manifest.webmanifest"),
  path.join("dist", "mdm-logo.png"),
];

const missing = requiredFiles.filter((filePath) => !fs.existsSync(filePath));

if (missing.length > 0) {
  console.error("Missing required PWA output files:");
  missing.forEach((filePath) => console.error(`- ${filePath}`));
  process.exit(1);
}

console.log("PWA asset verification passed.");
