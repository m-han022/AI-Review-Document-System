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
AUTH_FAILURE_ERROR_COUNT = 999


def _is_rate_limit_error(error_msg: str) -> bool:
    return "429" in error_msg or "rate limit" in error_msg or "quota" in error_msg


def _is_auth_error(error_msg: str) -> bool:
    return (
        "401" in error_msg
        or "unauthenticated" in error_msg
        or "invalid authentication credentials" in error_msg
    )


def _is_transient_service_error(error_msg: str) -> bool:
    transient_markers = (
        "503",
        "unavailable",
        "high demand",
        "deadline exceeded",
        "timed out",
        "timeout",
        "internal",
    )
    return any(marker in error_msg for marker in transient_markers)


def _key_label(key: Optional[str]) -> str:
    if not key:
        return "key[none]"
    try:
        index = GEMINI_API_KEYS.index(key) + 1
    except ValueError:
        index = 0
    suffix = key[-6:] if len(key) >= 6 else key
    return f"key[{index}:{suffix}]"


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


def mark_key_auth_failed(key: str):
    """Mark a key as unusable due to authentication failure."""
    if key in _key_usage:
        _key_usage[key]["error_count"] = AUTH_FAILURE_ERROR_COUNT


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
            print(f"[Gemini] Initializing client with {_key_label(self.current_key)}")
            self.client = genai.Client(api_key=self.current_key)
    
    def generate_content(self, model: str, contents: str, config: types.GenerateContentConfig):
        """Generate content with automatic key rotation on rate limit."""
        key_count = len(GEMINI_API_KEYS) if GEMINI_API_KEYS else 1
        max_retries = max(key_count, 3)
        auth_failed_keys: list[str] = []
        saw_rate_limit = False
        saw_transient_service_error = False
        last_error: Exception | None = None
        
        for attempt in range(max_retries):
            try:
                if not self.client:
                    raise RuntimeError("No Gemini API keys available")

                print(f"[Gemini] Calling model {model} with {_key_label(self.current_key)}")
                response = self.client.models.generate_content(
                    model=model,
                    contents=contents,
                    config=config
                )

                print(f"[Gemini] Success with {_key_label(self.current_key)}")
                mark_key_success(self.current_key)
                return response
                
            except Exception as e:
                error_msg = str(e).lower()
                last_error = e
                
                if _is_rate_limit_error(error_msg):
                    saw_rate_limit = True
                    print(f"[Gemini] {_key_label(self.current_key)} rate limited, trying next key...")
                    mark_key_error(self.current_key)
                    self._init_client()
                    if attempt < max_retries - 1:
                        time.sleep(2)
                elif _is_auth_error(error_msg):
                    print(f"[Gemini] Authentication failed with {_key_label(self.current_key)}, trying next key...")
                    if self.current_key:
                        auth_failed_keys.append(self.current_key)
                        mark_key_auth_failed(self.current_key)
                    self._init_client()
                    if attempt < max_retries - 1:
                        time.sleep(1)
                elif _is_transient_service_error(error_msg):
                    saw_transient_service_error = True
                    print(f"[Gemini] Temporary service issue with {_key_label(self.current_key)}, retrying... ({e})")
                    mark_key_error(self.current_key)
                    self._init_client()
                    if attempt < max_retries - 1:
                        time.sleep(min(2 * (attempt + 1), 6))
                else:
                    print(f"[Gemini] Request failed with {_key_label(self.current_key)}: {e}")
                    raise
        
        if auth_failed_keys and len(set(auth_failed_keys)) == len(GEMINI_API_KEYS):
            raise RuntimeError(
                "All Gemini API keys failed authentication. "
                "Please verify GEMINI_API_KEYS and the Google AI project/API access."
            )

        if saw_transient_service_error:
            raise RuntimeError(
                "Gemini service is temporarily unavailable or overloaded. "
                "Please try again in a moment."
            ) from last_error

        if saw_rate_limit:
            raise RuntimeError(
                "All Gemini API keys are rate limited. "
                "Please wait 1 minute and try again."
            ) from last_error

        raise RuntimeError("Gemini request failed after retries.") from last_error


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
