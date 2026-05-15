"""Multi-key Gemini API manager with round-robin key rotation."""
import time
from typing import Optional, Any
from concurrent.futures import ThreadPoolExecutor, TimeoutError as FutureTimeoutError
from google import genai
from google.genai import types
from app.config import settings

GEMINI_API_KEYS = settings.gemini_api_keys
GEMINI_MODEL = settings.gemini_model


class GeminiRateLimitError(RuntimeError):
    """Raised when all configured Gemini API keys are rate limited."""

def get_model_for_level(level: str) -> str:
    """Returns the optimal Gemini model based on the prompt level."""
    # high -> Pro for deep reasoning and strict governance
    if level.lower() == "high":
        # Check if a specific pro model is set in env, else default to 1.5 Pro
        return "gemini-1.5-pro"
    # low/medium -> Flash for speed and cost efficiency
    return GEMINI_MODEL

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
    global _current_key_index

    if not GEMINI_API_KEYS:
        return None

    for _ in range(len(GEMINI_API_KEYS)):
        key = GEMINI_API_KEYS[_current_key_index]
        _current_key_index = (_current_key_index + 1) % len(GEMINI_API_KEYS)
        if _key_usage[key]["error_count"] < 3:
            return key

    for key in GEMINI_API_KEYS:
        _key_usage[key]["error_count"] = 0

    return GEMINI_API_KEYS[0] if GEMINI_API_KEYS else None


def mark_key_error(key: str):
    if key in _key_usage:
        _key_usage[key]["error_count"] += 1


def mark_key_auth_failed(key: str):
    if key in _key_usage:
        _key_usage[key]["error_count"] = AUTH_FAILURE_ERROR_COUNT


def mark_key_success(key: str):
    if key in _key_usage:
        _key_usage[key]["last_used"] = time.time()
        _key_usage[key]["error_count"] = max(0, _key_usage[key]["error_count"] - 1)


def get_key_stats():
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
        self.current_key = get_available_key()
        if self.current_key:
            print(f"[Gemini] Initializing client with {_key_label(self.current_key)}")
            self.client = genai.Client(api_key=self.current_key)
    
    def generate_content(self, model: str, contents: Any, config: types.GenerateContentConfig):
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
                with ThreadPoolExecutor(max_workers=1) as executor:
                    future = executor.submit(
                        self.client.models.generate_content,
                        model=model,
                        contents=contents,
                        config=config,
                    )
                    response = future.result(timeout=settings.gemini_request_timeout_seconds)

                print(f"[Gemini] Success with {_key_label(self.current_key)}")
                mark_key_success(self.current_key)
                return response
                
            except Exception as e:
                if isinstance(e, FutureTimeoutError):
                    error_msg = "timeout"
                else:
                    error_msg = str(e).lower()
                last_error = e
                
                if _is_rate_limit_error(error_msg):
                    saw_rate_limit = True
                    print(f"[Gemini] {_key_label(self.current_key)} rate limited for {model}, trying next key...")
                    mark_key_error(self.current_key)
                    self._init_client()
                    if attempt < max_retries - 1:
                        time.sleep(1) # Reduced sleep for faster rotation
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
        
        # --- FALLBACK LOGIC ---
        # If we reach here, it means all keys failed for the requested model.
        # If the requested model was Pro, try one last time with Flash.
        if saw_rate_limit and model == "gemini-1.5-pro":
            print(f"[Gemini] CRITICAL: All keys rate limited for Pro. Falling back to Flash: {GEMINI_MODEL}")
            try:
                # One last attempt with Flash using a fresh key
                self._init_client()
                response = self.client.models.generate_content(
                    model=GEMINI_MODEL,
                    contents=contents,
                    config=config
                )
                print(f"[Gemini] Fallback to Flash successful.")
                return response
            except Exception as fe:
                print(f"[Gemini] Fallback to Flash also failed: {fe}")
                raise last_error # Raise the original Pro error if fallback fails

        if auth_failed_keys and len(set(auth_failed_keys)) == len(GEMINI_API_KEYS):
            raise RuntimeError(
                "All Gemini API keys failed authentication. "
                "Please verify GEMINI_API_KEYS."
            )

        if saw_transient_service_error:
            raise RuntimeError(
                "Gemini service is temporarily unavailable. Please try again."
            ) from last_error

        if saw_rate_limit:
            raise GeminiRateLimitError(
                f"All Gemini API keys are rate limited for model {model}. "
                "Please wait 1 minute and try again."
            ) from last_error

        raise RuntimeError("Gemini request failed after retries.") from last_error


# Global client instance
_multi_key_client = None


def get_gemini_client():
    global _multi_key_client
    if _multi_key_client is None:
        _multi_key_client = GeminiMultiKeyClient()
    return _multi_key_client


def reset_gemini_client():
    global _multi_key_client
    _multi_key_client = None
