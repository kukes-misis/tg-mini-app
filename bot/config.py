import os

# Telegram Bot Token
BOT_TOKEN = os.getenv("BOT_TOKEN", "8869708665:AAGbvrKDDw5nhQ-Bt9YKf7kL3NimYvZYjaM")

# Public WebApp URL hosted on GitHub Pages
WEBAPP_URL = os.getenv("WEBAPP_URL", "https://kukes-misis.github.io/tg-mini-app/")

# Allowed Admin Usernames (case-insensitive)
ADMIN_USERNAMES = ["qqeaux"]

# Fallback Admin Chat ID
ADMIN_ID = os.getenv("ADMIN_ID", "")

def is_admin(username: str | None, user_id: int | None = None) -> bool:
    if username and username.lower().replace("@", "") in ADMIN_USERNAMES:
        return True
    if str(user_id) == str(ADMIN_ID) and ADMIN_ID:
        return True
    return False
