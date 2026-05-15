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
const BAD_PATTERN = /(Ã.|Â.|â..|ðŸ|\uFFFD)/;

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
      if (BAD_PATTERN.test(lines[i])) {
        hits.push(`${path.relative(ROOT, file)}:${i + 1}: ${lines[i].slice(0, 140)}`);
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
