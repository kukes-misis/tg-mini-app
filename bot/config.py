import os

# Telegram Bot Token
BOT_TOKEN = os.getenv("BOT_TOKEN", "8869708665:AAGbvrKDDw5nhQ-Bt9YKf7kL3NimYvZYjaM")

# Public WebApp URL hosted on GitHub Pages
WEBAPP_URL = os.getenv("WEBAPP_URL", "https://kukes-misis.github.io/tg-mini-app/")

# The ONLY allowed Admin Username - strictly @qqeaux forever
ADMIN_USERNAMES = ["qqeaux"]

# Permanent Admin Chat ID (can be overridden via env var ADMIN_CHAT_ID on Render)
DEFAULT_ADMIN_CHAT_ID = os.getenv("ADMIN_CHAT_ID", "5847598677")

def is_admin(username: str | None, user_id: int | None = None) -> bool:
    if user_id and str(user_id) == str(DEFAULT_ADMIN_CHAT_ID):
        return True
    if username and username.lower().replace("@", "").strip() == "qqeaux":
        return True
    return False
