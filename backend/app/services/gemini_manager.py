"""
Multi-key Gemini API manager for rotating between multiple API keys.
This helps bypass the 20 requests/minute limit per key.
"""
import time
from typing import Optional
from google import genai
from google.genai import types
from app.config import settings

GEMINI_API_KEYS = settings.gemini_api_keys
GEMINI_MODEL = settings.gemini_model

# Track key usage
_key_usage = {key: {"last_used": 0, "error_count": 0} for key in GEMINI_API_KEYS}
_current_key_index = 0


def get_available_key() -> Optional[str]:
    """Get the next available API key using round-robin.
    
    Returns:
        API key or None if no keys available
    """
    global _current_key_index
    
    if not GEMINI_API_KEYS:
        return None
    
    # Try each key
    for _ in range(len(GEMINI_API_KEYS)):
        key = GEMINI_API_KEYS[_current_key_index]
        _current_key_index = (_current_key_index + 1) % len(GEMINI_API_KEYS)
        
        # Check if key had too many errors
        if _key_usage[key]["error_count"] < 3:
            return key
    
    # All keys have errors, reset and try again
    for key in GEMINI_API_KEYS:
        _key_usage[key]["error_count"] = 0
    
    return GEMINI_API_KEYS[0] if GEMINI_API_KEYS else None


def mark_key_error(key: str):
    """Mark a key as having an error."""
    if key in _key_usage:
        _key_usage[key]["error_count"] += 1


def mark_key_success(key: str):
    """Mark a key as successful."""
    if key in _key_usage:
        _key_usage[key]["last_used"] = time.time()
        _key_usage[key]["error_count"] = max(0, _key_usage[key]["error_count"] - 1)


def get_key_stats():
    """Get statistics for all keys."""
    return {
        "total_keys": len(GEMINI_API_KEYS),
        "key_status": {
            f"key_{i+1}": {
                "last_used": _key_usage.get(key, {}).get("last_used", 0),
                "error_count": _key_usage.get(key, {}).get("error_count", 0),
                "healthy": _key_usage.get(key, {}).get("error_count", 0) < 3,
            }
            for i, key in enumerate(GEMINI_API_KEYS)
        }
    }


class GeminiMultiKeyClient:
    """Client that rotates between multiple Gemini API keys."""
    
    def __init__(self):
        self.current_key = None
        self.client = None
        self._init_client()
    
    def _init_client(self):
        """Initialize with the next available key."""
        self.current_key = get_available_key()
        if self.current_key:
            self.client = genai.Client(api_key=self.current_key)
    
    def generate_content(self, model: str, contents: str, config: types.GenerateContentConfig):
        """Generate content with automatic key rotation on rate limit."""
        max_retries = len(GEMINI_API_KEYS) if GEMINI_API_KEYS else 1
        
        for attempt in range(max_retries):
            try:
                if not self.client:
                    raise RuntimeError("No Gemini API keys available")
                
                response = self.client.models.generate_content(
                    model=model,
                    contents=contents,
                    config=config
                )
                
                mark_key_success(self.current_key)
                return response
                
            except Exception as e:
                error_msg = str(e).lower()
                
                # Check if it's a rate limit error (429)
                if "429" in error_msg or "rate limit" in error_msg or "quota" in error_msg:
                    print(f"[Gemini] Key {attempt+1} rate limited, trying next key...")
                    mark_key_error(self.current_key)
                    
                    # Try next key
                    self._init_client()
                    
                    # Wait a bit before retry
                    if attempt < max_retries - 1:
                        time.sleep(2)
                else:
                    # Other error, don't retry
                    raise
        
        # All keys exhausted
        raise RuntimeError(
            "All Gemini API keys are rate limited. "
            "Please wait 1 minute and try again."
        )


# Global client instance
_multi_key_client = None


def get_gemini_client():
    """Get or create the multi-key Gemini client."""
    global _multi_key_client
    if _multi_key_client is None:
        _multi_key_client = GeminiMultiKeyClient()
    return _multi_key_client


def reset_gemini_client():
    """Reset the client (useful for testing)."""
    global _multi_key_client
    _multi_key_client = None
