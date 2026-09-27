import os

# Telegram Bot Token
BOT_TOKEN = os.getenv("BOT_TOKEN", "8869708665:AAGbvrKDDw5nhQ-Bt9YKf7kL3NimYvZYjaM")

# Public WebApp URL hosted on GitHub Pages
WEBAPP_URL = os.getenv("WEBAPP_URL", "https://kukes-misis.github.io/tg-mini-app/")

# The ONLY allowed Admin Username - strictly @qqeaux forever
ADMIN_USERNAMES = ["qqeaux"]

# Optional Admin Chat ID override via environment variable on Render
raw_admin_id = os.getenv("ADMIN_CHAT_ID", "").strip()
DEFAULT_ADMIN_CHAT_ID = "" if raw_admin_id == "5847598677" else raw_admin_id

def is_admin(username: str | None, user_id: int | None = None) -> bool:
    # Strictly @qqeaux is the only admin forever
    if username and username.lower().replace("@", "").strip() == "qqeaux":
        return True
    return False

