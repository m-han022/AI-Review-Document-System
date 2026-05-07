import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";

const ROOT = path.resolve(process.cwd());
const LOCALES_DIR = path.join(ROOT, "src", "locales");
const SOURCE_ROOT = path.join(ROOT, "src");

function loadJson(name) {
  const p = path.join(LOCALES_DIR, `${name}.json`);
  if (!fs.existsSync(p)) return {};
  return JSON.parse(fs.readFileSync(p, "utf8"));
}

function flatten(obj, prefix = "", out = new Map()) {
  Object.entries(obj || {}).forEach(([key, value]) => {
    const next = prefix ? `${prefix}.${key}` : key;
    if (value && typeof value === "object" && !Array.isArray(value)) {
      flatten(value, next, out);
      return;
    }
    out.set(next, value);
  });
  return out;
}

function listTsxFiles(dir, acc = []) {
  for (const name of fs.readdirSync(dir)) {
    const full = path.join(dir, name);
    const stat = fs.statSync(full);
    if (stat.isDirectory()) {
      if (name === "assets") continue;
      listTsxFiles(full, acc);
      continue;
    }
    if (/\.(ts|tsx)$/.test(name)) acc.push(full);
  }
  return acc;
}

function extractUsedKeys(files) {
  const keys = new Set();
  const pattern = /\bt\(\s*["'`]([^"'`]+)["'`]/g;
  files.forEach((file) => {
    const text = fs.readFileSync(file, "utf8");
    let m = pattern.exec(text);
    while (m) {
      keys.add(m[1]);
      m = pattern.exec(text);
    }
  });
  return keys;
}

function hasMojibake(text) {
  // Common mojibake markers like ├íc, ß╗çu, etc.
  return /[├┼╞ß║╗╜╣ç]/.test(text) || /Ã¡|Ã|áº|â€”|\ufffd/.test(text);
}

const viData = loadJson("vi");
const jaData = loadJson("ja");
const enData = loadJson("en");

const vi = flatten(viData);
const ja = flatten(jaData);
const en = flatten(enData);

const viKeys = [...vi.keys()];
const jaKeys = new Set(ja.keys());
const enKeys = new Set(en.keys());

const missingInJa = viKeys.filter((k) => !jaKeys.has(k));
const missingInEn = viKeys.filter((k) => !enKeys.has(k));
const missingInVi = [...ja.keys()].filter((k) => !vi.has(k));

const usedKeys = extractUsedKeys(listTsxFiles(SOURCE_ROOT));
const missingUsedKeys = [...usedKeys].filter((k) => !vi.has(k) || !ja.has(k) || !en.has(k));

const viMojibake = viKeys.filter((k) => typeof vi.get(k) === "string" && hasMojibake(String(vi.get(k))));
const jaMojibake = [...ja.keys()].filter((k) => typeof ja.get(k) === "string" && hasMojibake(String(ja.get(k))));

const hasError = missingInJa.length || missingInEn.length || missingInVi.length || missingUsedKeys.length;

console.log(`Missing in ja: ${missingInJa.length}`);
console.log(`Missing in en: ${missingInEn.length}`);
console.log(`Missing in vi: ${missingInVi.length}`);
console.log(`Used keys missing in locales: ${missingUsedKeys.length}`);
console.log(`Potential mojibake vi: ${viMojibake.length}`);
console.log(`Potential mojibake ja: ${jaMojibake.length}`);

if (viMojibake.length) console.log(`- Sample vi mojibake: ${viMojibake.slice(0, 5).map(k => `${k}: ${vi.get(k)}`).join(", ")}`);
if (jaMojibake.length) console.log(`- Sample ja mojibake: ${jaMojibake.slice(0, 5).map(k => `${k}: ${ja.get(k)}`).join(", ")}`);
if (missingInVi.length) console.log(`- Sample missing in vi: ${missingInVi.slice(0, 10).join(", ")}`);
if (missingUsedKeys.length) console.log(`- Sample used missing: ${missingUsedKeys.slice(0, 10).join(", ")}`);

if (viMojibake.length || jaMojibake.length) {
  console.log("Warning: potential mojibake detected. Please review listed keys.");
}

if (hasError) {
  process.exit(1);
}
