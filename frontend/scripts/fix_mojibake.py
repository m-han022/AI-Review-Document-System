import json

def fix_mojibake(text):
    if not isinstance(text, str):
        return text
    try:
        # Try to fix by encoding as latin-1 and decoding as utf-8
        return text.encode('latin-1').decode('utf-8')
    except (UnicodeEncodeError, UnicodeDecodeError):
        return text

def process_obj(obj):
    if isinstance(obj, dict):
        return {k: process_obj(v) for k, v in obj.items()}
    elif isinstance(obj, list):
        return [process_obj(i) for i in obj]
    else:
        return fix_mojibake(obj)

# Since I don't have ja.json yet, I'll first create it with the escaped content
# and then run this logic.
