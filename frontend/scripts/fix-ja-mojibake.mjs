import fs from "node:fs";
import path from "node:path";

const filePath = path.resolve("src/locales/dictionary.ts");
const src = fs.readFileSync(filePath, "utf8");

const jaStart = src.indexOf("\n  ja: {");
if (jaStart < 0) {
  console.error("ja block not found");
  process.exit(1);
}

let i = jaStart;
while (i < src.length && src[i] !== "{") i++;
if (i >= src.length) {
  console.error("ja block brace not found");
  process.exit(1);
}

const blockOpen = i;
let depth = 0;
let inString = false;
let escaped = false;
let blockClose = -1;

for (let p = blockOpen; p < src.length; p++) {
  const ch = src[p];
  if (inString) {
    if (escaped) {
      escaped = false;
    } else if (ch === "\\") {
      escaped = true;
    } else if (ch === '"') {
      inString = false;
    }
    continue;
  }

  if (ch === '"') {
    inString = true;
    continue;
  }

  if (ch === "{") depth++;
  if (ch === "}") {
    depth--;
    if (depth === 0) {
      blockClose = p;
      break;
    }
  }
}

if (blockClose < 0) {
  console.error("ja block close not found");
  process.exit(1);
}

const before = src.slice(0, blockOpen + 1);
const jaBlock = src.slice(blockOpen + 1, blockClose);
const after = src.slice(blockClose);

const mojibakeHint = /[ÃÂãåæçèéêìîïðñòóôõöùúûüýþÿ]/;
const jpChar = /[\u3040-\u30ff\u3400-\u9fff]/g;

function scoreJp(s) {
  const m = s.match(jpChar);
  return m ? m.length : 0;
}

function maybeRepair(content) {
  if (!mojibakeHint.test(content)) return content;
  const repaired = Buffer.from(content, "latin1").toString("utf8");
  if (!repaired || repaired.includes("\uFFFD")) return content;

  const oldScore = scoreJp(content);
  const newScore = scoreJp(repaired);
  if (newScore > oldScore) return repaired;

  if (newScore > 0 && content.includes("ã")) return repaired;
  return content;
}

let changed = 0;
const repairedBlock = jaBlock.replace(/"((?:[^"\\]|\\.)*)"/g, (full, inner) => {
  const unescaped = inner
    .replace(/\\n/g, "\n")
    .replace(/\\r/g, "\r")
    .replace(/\\t/g, "\t")
    .replace(/\\"/g, '"')
    .replace(/\\\\/g, "\\");

  const fixed = maybeRepair(unescaped);
  if (fixed === unescaped) return full;

  changed++;
  const escapedFixed = fixed
    .replace(/\\/g, "\\\\")
    .replace(/"/g, '\\"')
    .replace(/\n/g, "\\n")
    .replace(/\r/g, "\\r")
    .replace(/\t/g, "\\t");
  return `"${escapedFixed}"`;
});

const out = before + repairedBlock + after;
fs.writeFileSync(filePath, out, "utf8");
console.log(`Repaired strings: ${changed}`);
