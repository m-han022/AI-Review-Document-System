import json
import re
import os

def extract_translations():
    path = r"f:\00.work\01.brycen\workspace\AI-Review-Document-System\frontend\src\locales\dictionary.ts"
    with open(path, 'r', encoding='utf-8') as f:
        lines = f.readlines()

    # We'll use a simple state machine to extract vi and ja blocks
    vi_data = {}
    ja_data = {}
    
    current_lang = None
    buffer = ""
    
    # This is still a bit risky with regex on complex objects.
    # Better approach: use node to require it and dump it.
    
    node_script = """
import { translations } from './src/locales/dictionary.ts';
import fs from 'fs';

function fixMojibake(obj) {
  if (typeof obj === 'string') {
    try {
      // Check if it looks like mojibake (contains non-ascii chars that could be interpreted as latin-1)
      if (/[\\u0080-\\u00FF]/.test(obj)) {
        const buf = Buffer.from(obj, 'binary');
        return buf.toString('utf8');
      }
    } catch (e) {}
    return obj;
  }
  if (Array.isArray(obj)) return obj.map(fixMojibake);
  if (obj !== null && typeof obj === 'object') {
    const next = {};
    for (const k in obj) next[k] = fixMojibake(obj[k]);
    return next;
  }
  return obj;
}

fs.writeFileSync('src/locales/vi.json', JSON.stringify(fixMojibake(translations.vi), null, 2));
fs.writeFileSync('src/locales/ja.json', JSON.stringify(fixMojibake(translations.ja), null, 2));
"""
    # But node can't directly import .ts files without a loader.
    # I'll just use a python script that cleans up the file to be valid JSON.
    pass

def clean_ts_to_json(content, start_marker):
    # Find the start of the object
    start_idx = content.find(start_marker)
    if start_idx == -1: return None
    
    # Find the matching closing brace
    # This is simplified: assumes the block ends with "  },"
    end_idx = content.find("\n  },", start_idx)
    if end_idx == -1:
        # Try finding the very last brace
        end_idx = content.rfind("}")
    
    obj_str = content[start_idx + len(start_marker) : end_idx + 1]
    
    # Basic cleanup to make it look more like JSON
    # 1. Remove comments
    obj_str = re.sub(r'//.*', '', obj_str)
    # 2. Quote keys
    obj_str = re.sub(r'(\w+):', r'"\1":', obj_str)
    # 3. Handle trailing commas
    obj_str = re.sub(r',\s*}', '}', obj_str)
    obj_str = re.sub(r',\s*\]', ']', obj_str)
    
    try:
        data = json.loads(obj_str)
        return data
    except Exception as e:
        print(f"Error parsing {start_marker}: {e}")
        # Debug: print a bit of the string
        # print(obj_str[:200])
        return None

def fix_mojibake(obj):
    if isinstance(obj, str):
        try:
            # Check if it has the "å" pattern
            if any(ord(c) > 127 for c in obj):
                return obj.encode('latin-1').decode('utf-8')
        except:
            pass
        return obj
    if isinstance(obj, dict):
        return {k: fix_mojibake(v) for k, v in obj.items()}
    if isinstance(obj, list):
        return [fix_mojibake(i) for i in obj]
    return obj

def main():
    path = r"f:\00.work\01.brycen\workspace\AI-Review-Document-System\frontend\src\locales\dictionary.ts"
    with open(path, 'r', encoding='utf-8') as f:
        content = f.read()

    vi = clean_ts_to_json(content, "vi: {")
    ja = clean_ts_to_json(content, "ja: {")
    
    if vi:
        with open(r"f:\00.work\01.brycen\workspace\AI-Review-Document-System\frontend\src\locales\vi.json", 'w', encoding='utf-8') as f:
            json.dump(vi, f, indent=2, ensure_ascii=False)
        print("Created vi.json")
        
    if ja:
        ja_fixed = fix_mojibake(ja)
        with open(r"f:\00.work\01.brycen\workspace\AI-Review-Document-System\frontend\src\locales\ja.json", 'w', encoding='utf-8') as f:
            json.dump(ja_fixed, f, indent=2, ensure_ascii=False)
        print("Created ja.json")

if __name__ == "__main__":
    main()
