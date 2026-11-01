"""Freshness validation for candidate snapshots before future publication."""
from datetime import datetime, timedelta, timezone

MAX_AGE = timedelta(hours=24)


def is_fresh(snapshot, now=None):
    if not isinstance(snapshot, dict) or snapshot.get('schema_version') != 1:
        return False
    if not isinstance(snapshot.get('nodes'), list):
        return False
    now = now or datetime.now(timezone.utc)
    try:
        timestamp = datetime.fromisoformat(snapshot['updated_at'].replace('Z', '+00:00'))
        if timestamp.tzinfo is None or now.tzinfo is None:
            return False
        age = now - timestamp
        return timedelta(0) <= age < MAX_AGE
    except (KeyError, ValueError, TypeError, AttributeError):
        return False
