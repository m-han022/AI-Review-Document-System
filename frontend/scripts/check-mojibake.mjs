import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(process.cwd(), "..");
const TARGETS = [
  "frontend/src/locales",
  "frontend/src/constants",
  "README.md",
  "AGENTS.md",
];

const EXT_ALLOW = new Set([".json", ".ts", ".tsx", ".md", ".txt"]);
// Detect common UTF-8-as-Windows-1252 mojibake sequences only.
const BAD_PATTERN = /(Ãƒ[\x80-\xBF]|Ã‚[\x80-\xBF]|Ã¢[\x80-\xBF]{2}|Ã°Å¸[\x80-\xBF]{2}|\uFFFD)/;
const BAD_PLACEHOLDER_PATTERN = /\?{3,}/;

function walk(absPath, out = []) {
  const stat = fs.statSync(absPath);
  if (stat.isDirectory()) {
    for (const entry of fs.readdirSync(absPath)) {
      walk(path.join(absPath, entry), out);
    }
    return out;
  }
  if (EXT_ALLOW.has(path.extname(absPath).toLowerCase())) out.push(absPath);
  return out;
}

const hits = [];
for (const rel of TARGETS) {
  const abs = path.join(ROOT, rel);
  if (!fs.existsSync(abs)) continue;
  const files = walk(abs);
  for (const file of files) {
    const text = fs.readFileSync(file, "utf8");
    const lines = text.split(/\r?\n/);
    for (let i = 0; i < lines.length; i += 1) {
      const line = lines[i];
      // Allow explicit documentation lines that intentionally mention mojibake markers.
      if (line.includes("dáº¥u hiá»‡u mojibake") || line.includes("mojibake")) continue;
      if (BAD_PATTERN.test(line)) {
        hits.push(`${path.relative(ROOT, file)}:${i + 1}: ${line.slice(0, 140)}`);
        break;
      }
      if (file.includes(`${path.sep}src${path.sep}locales${path.sep}`) && BAD_PLACEHOLDER_PATTERN.test(line)) {
        hits.push(`${path.relative(ROOT, file)}:${i + 1}: placeholder ??? detected`);
        break;
      }
    }
  }
}

if (hits.length) {
  console.error("Mojibake detected:");
  hits.slice(0, 100).forEach((h) => console.error(`- ${h}`));
  process.exit(1);
}

console.log("Mojibake check passed.");
