from __future__ import annotations

import os
from pathlib import Path


BACK_DIR = Path(__file__).resolve().parents[1]
ENV_PATH = BACK_DIR / ".env"


def load_env_file(path: Path = ENV_PATH) -> None:
    """Load a simple KEY=VALUE .env file without overriding existing env vars."""
    if not path.exists():
        return

    for raw_line in path.read_text(encoding="utf-8").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue

        key, value = line.split("=", 1)
        key = key.strip()
        value = value.strip().strip('"').strip("'")
        os.environ.setdefault(key, value)


def mysql_config() -> dict[str, object]:
    load_env_file()
    return {
        "host": os.getenv("MYSQL_HOST") or os.getenv("DB_HOST") or "localhost",
        "port": int(os.getenv("MYSQL_PORT", "3306")),
        "user": os.getenv("MYSQL_USER"),
        "password": os.getenv("MYSQL_PASSWORD"),
        "database": (
            os.getenv("MYSQL_DATABASE")
            or os.getenv("MYSQL_DB_NAME")
            or os.getenv("DB_NAME")
            or "gestao_metas"
        ),
    }


def app_encryption_key_hex() -> str:
    load_env_file()
    return os.getenv("APP_ENCRYPTION_KEY") or ("0" * 64)
