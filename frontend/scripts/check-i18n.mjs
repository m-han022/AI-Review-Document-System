import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";

const ROOT = path.resolve(process.cwd());
const DICTIONARY_PATH = path.join(ROOT, "src", "locales", "dictionary.ts");
const SOURCE_ROOT = path.join(ROOT, "src");

function loadTranslations() {
  const raw = fs.readFileSync(DICTIONARY_PATH, "utf8");
  const cjs = raw.replace("export const translations =", "module.exports.translations =");
  const context = { module: { exports: {} } };
  vm.runInNewContext(cjs, context, { filename: DICTIONARY_PATH });
  return context.module.exports.translations;
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
  return /Ã.|Ä.|áº.|â€”|�/.test(text);
}

const translations = loadTranslations();
const vi = flatten(translations.vi);
const ja = flatten(translations.ja);
const viKeys = [...vi.keys()];
const jaKeys = new Set(ja.keys());
const missingInJa = viKeys.filter((k) => !jaKeys.has(k));
const missingInVi = [...ja.keys()].filter((k) => !vi.has(k));

const usedKeys = extractUsedKeys(listTsxFiles(SOURCE_ROOT));
const missingUsedKeys = [...usedKeys].filter((k) => !vi.has(k) || !ja.has(k));

const viMojibake = viKeys.filter((k) => typeof vi.get(k) === "string" && hasMojibake(String(vi.get(k))));
const jaMojibake = [...ja.keys()].filter((k) => typeof ja.get(k) === "string" && hasMojibake(String(ja.get(k))));

const hasError = missingInJa.length || missingInVi.length || missingUsedKeys.length;

console.log(`Missing in ja: ${missingInJa.length}`);
console.log(`Missing in vi: ${missingInVi.length}`);
console.log(`Used keys missing in dictionary: ${missingUsedKeys.length}`);
console.log(`Potential mojibake vi: ${viMojibake.length}`);
console.log(`Potential mojibake ja: ${jaMojibake.length}`);

if (missingInJa.length) console.log(`- Sample missing in ja: ${missingInJa.slice(0, 10).join(", ")}`);
if (missingInVi.length) console.log(`- Sample missing in vi: ${missingInVi.slice(0, 10).join(", ")}`);
if (missingUsedKeys.length) console.log(`- Sample used missing: ${missingUsedKeys.slice(0, 10).join(", ")}`);
if (viMojibake.length) console.log(`- Sample vi mojibake: ${viMojibake.slice(0, 10).join(", ")}`);
if (jaMojibake.length) console.log(`- Sample ja mojibake: ${jaMojibake.slice(0, 10).join(", ")}`);

if (viMojibake.length || jaMojibake.length) {
  console.log("Warning: potential mojibake detected. Please review listed keys.");
}

if (hasError) {
  process.exit(1);
}
