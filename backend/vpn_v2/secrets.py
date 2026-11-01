"""Read credentials from environment or Kaggle Secrets without logging values."""
import os


def load(name):
    value = os.environ.get(name, '').strip()
    if value:
        return value
    try:
        from kaggle_secrets import UserSecretsClient
        return UserSecretsClient().get_secret(name).strip()
    except Exception:
        return ''
