import json
import os

def fix_mojibake(text):
    if not isinstance(text, str):
        return text
    try:
        # Check if it contains characters that look like mojibake
        # (mostly Latin-1 chars that should be UTF-8)
        # We check for 'å' which is E5, very common in Japanese UTF-8
        if 'å' in text or 'æ' in text or 'ä' in text:
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
    json_path = r"f:\00.work\01.brycen\workspace\AI-Review-Document-System\frontend\translations.json"
    with open(json_path, 'r', encoding='utf-8') as f:
        data = json.load(f)
    
    vi = process_obj(data.get('vi', {}))
    ja = process_obj(data.get('ja', {}))
    
    output_dir = r"f:\00.work\01.brycen\workspace\AI-Review-Document-System\frontend\src\locales"
    
    with open(os.path.join(output_dir, 'vi.json'), 'w', encoding='utf-8') as f:
        json.dump(vi, f, indent=2, ensure_ascii=False)
        
    with open(os.path.join(output_dir, 'ja.json'), 'w', encoding='utf-8') as f:
        json.dump(ja, f, indent=2, ensure_ascii=False)
        
    print("Successfully created vi.json and ja.json with fixed encoding.")

if __name__ == "__main__":
    main()
