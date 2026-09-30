import os
import base64

# Try loading from local .env if available
_env_file = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", ".env")
if os.path.exists(_env_file):
    try:
        with open(_env_file, "r", encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if line and not line.startswith("#") and "=" in line:
                    k, v = line.split("=", 1)
                    os.environ.setdefault(k.strip(), v.strip())
    except Exception:
        pass

def _resolve_token(env_var: str, fallback_b64: str) -> str:
    val = os.getenv(env_var)
    if val and val.strip():
        return val.strip()
    try:
        return base64.b64decode(fallback_b64.encode("utf-8")).decode("utf-8").strip()
    except Exception:
        return ""

# Main Client-facing Customer Telegram Bot
BOT_TOKEN = _resolve_token("BOT_TOKEN", "ODg2OTcwODY2NTpBQUdidnJLRER3NW5oUS1CdDlZS2Y3a0wzTmltWXZaWWphTQ==")

# Dedicated Admin / Dispatcher Telegram Bot
ADMIN_BOT_TOKEN = _resolve_token("ADMIN_BOT_TOKEN", "ODgxMTk5NDQ5NTpBQUVUNzFNcG1RbDRqdG5PSVo1OTRlbTMxcHB4OXI0eUFSSQ==")

# Admin Login & Password
ADMIN_LOGIN = os.getenv("ADMIN_LOGIN", "1")
ADMIN_PASSWORD = os.getenv("ADMIN_PASSWORD", "1")

# Public WebApp URL hosted on GitHub Pages (Client Restaurant)
WEBAPP_URL = os.getenv("WEBAPP_URL", "https://kukes-misis.github.io/tg-mini-app/")
