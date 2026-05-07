import json
import os

def fix_mojibake(text):
    if not isinstance(text, str):
        return text
    try:
        # Check for mojibake pattern
        if 'å' in text or 'æ' in text or 'ä' in text:
            # Re-encode to bytes using latin-1 and decode as utf-8
            return text.encode('latin-1').decode('utf-8')
    except:
        pass
    return text

def process_obj(obj):
    if isinstance(obj, dict):
        return {k: process_obj(v) for k, v in obj.items()}
    elif isinstance(obj, list):
        return [process_obj(i) for i in obj]
    else:
        return fix_mojibake(obj)

def main():
    json_path = "translations.json"
    
    # Handle UTF-16 (BOM) or UTF-8
    with open(json_path, 'rb') as f:
        raw = f.read()
    
    if raw.startswith(b'\xff\xfe'):
        content = raw.decode('utf-16')
    elif raw.startswith(b'\xef\xbb\xbf'):
        content = raw.decode('utf-8-sig')
    else:
        content = raw.decode('utf-8', errors='replace')
        
    data = json.loads(content)
    
    output_dir = "src/locales"
    
    vi = process_obj(data.get('vi', {}))
    ja = process_obj(data.get('ja', {}))
    
    with open(os.path.join(output_dir, 'vi.json'), 'w', encoding='utf-8') as f:
        json.dump(vi, f, indent=2, ensure_ascii=False)
        
    with open(os.path.join(output_dir, 'ja.json'), 'w', encoding='utf-8') as f:
        json.dump(ja, f, indent=2, ensure_ascii=False)
        
    print("Done.")

if __name__ == "__main__":
    main()
