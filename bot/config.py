import os

# Main Client-facing Customer Telegram Bot
BOT_TOKEN = os.getenv("BOT_TOKEN", "8869708665:AAGbvrKDDw5nhQ-Bt9YKf7kL3NimYvZYjaM")

# Dedicated Admin / Dispatcher Telegram Bot
ADMIN_BOT_TOKEN = os.getenv("ADMIN_BOT_TOKEN", "8811994495:AAF7yFLkd5SIWwcYawCVMq5Im7moKnHla64")

# Admin Login & Password
ADMIN_LOGIN = os.getenv("ADMIN_LOGIN", "1")
ADMIN_PASSWORD = os.getenv("ADMIN_PASSWORD", "1")

# Public WebApp URL hosted on GitHub Pages (Client Restaurant)
WEBAPP_URL = os.getenv("WEBAPP_URL", "https://kukes-misis.github.io/tg-mini-app/")
