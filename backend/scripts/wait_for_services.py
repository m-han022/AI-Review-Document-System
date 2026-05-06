import os
import socket
import time


def wait_for(host: str, port: int, timeout_sec: int = 60) -> None:
    start = time.time()
    while time.time() - start < timeout_sec:
        try:
            with socket.create_connection((host, port), timeout=2):
                print(f"[wait] {host}:{port} ready")
                return
        except OSError:
            time.sleep(1)
    raise TimeoutError(f"Timeout waiting for {host}:{port}")


if __name__ == "__main__":
    db_host = os.getenv("DB_HOST", "db")
    db_port = int(os.getenv("DB_PORT", "5432"))
    redis_host = os.getenv("REDIS_HOST", "redis")
    redis_port = int(os.getenv("REDIS_PORT", "6379"))
    backend_host = os.getenv("BACKEND_HOST", "backend")
    backend_port = int(os.getenv("BACKEND_PORT", "8000"))

    wait_for(db_host, db_port, timeout_sec=120)
    wait_for(redis_host, redis_port, timeout_sec=120)

    if os.getenv("WAIT_BACKEND", "false").lower() == "true":
        wait_for(backend_host, backend_port, timeout_sec=120)
