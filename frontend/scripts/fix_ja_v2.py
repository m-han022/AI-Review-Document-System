import json
import os

def fix_mojibake(text):
    if not isinstance(text, str):
        return text
    
    # Common mojibake characters in this file
    # å¾…æ©Ÿä¸­ (待機中)
    # Σ╜£µêÉ (作成)
    # τ╖¿Θ¢å (編集)
    
    # We can try to decode as UTF-8 from various encodings
    try:
        # Try encoding as cp1252 (common on Windows) and decoding as utf-8
        return text.encode('cp1252').decode('utf-8')
    except:
        try:
            # Try latin-1
            return text.encode('latin-1').decode('utf-8')
        except:
            return text

def process_obj(obj):
    if isinstance(obj, dict):
        return {k: process_obj(v) for k, v in obj.items()}
    elif isinstance(obj, list):
        return [process_obj(i) for i in obj]
    else:
        return fix_mojibake(obj)

def main():
    path = "src/locales/ja.json"
    with open(path, 'r', encoding='utf-8') as f:
        data = json.load(f)
    
    fixed = process_obj(data)
    
    with open(path, 'w', encoding='utf-8') as f:
        json.dump(fixed, f, indent=2, ensure_ascii=False)
    
    print("Done.")

if __name__ == "__main__":
    main()
