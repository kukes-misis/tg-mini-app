import os

# Telegram Bot Token
BOT_TOKEN = os.getenv("BOT_TOKEN", "8869708665:AAGbvrKDDw5nhQ-Bt9YKf7kL3NimYvZYjaM")

# Public WebApp URL hosted on GitHub Pages
WEBAPP_URL = os.getenv("WEBAPP_URL", "https://kukes-misis.github.io/tg-mini-app/")

# Allowed Admin Usernames (case-insensitive)
ADMIN_USERNAMES = ["qqeaux", "eccdk"]

# Allowed Admin User IDs
ADMIN_USER_IDS = [5847598677]

# Fallback Admin Chat ID
ADMIN_ID = os.getenv("ADMIN_ID", "5847598677")

def is_admin(username: str | None, user_id: int | None = None) -> bool:
    if user_id and (user_id in ADMIN_USER_IDS or str(user_id) == str(ADMIN_ID)):
        return True
    if username and username.lower().replace("@", "") in ADMIN_USERNAMES:
        return True
    return False
