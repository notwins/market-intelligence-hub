"""Neutral labels for mutable public catalogues; never rewrite source archives.

Only the project owner's full name and known legacy project labels are covered.
Other people's names, link destinations, IDs and preservation receipts stay intact.
"""
import re

_RULES = [
    (r"\bPrepared for Winston Ng\b", "Prepared for general readership"),
    (r"\bThis is Winston Ng[’']s personal portfolio view\b", "This is an independent personal portfolio view"),
    (r"\bWinston Ng[’']s\b", "the project maintainer’s"),
    (r"\bWinston Ng\b", "the project maintainer"),
    (r"\bWinston[’']s public watchlist\b", "Market Intel public watchlist"),
    (r"\bWinston[’']s thoughts\b", "Independent research"),
    (r"\bWinston[’']s research article\b", "Independent research article"),
]
_DISPLAY_FIELDS = {
    "title", "text", "summary", "description", "label", "note", "name",
    "excerpt", "snippet", "subtitle", "undated_titles",
}


def public_text(value):
    for pattern, replacement in _RULES:
        value = re.sub(pattern, replacement, value, flags=re.IGNORECASE)
    return value


def public_display_payload(value, field=None):
    """Return a copy with display text cleaned; preserve all other metadata."""
    if isinstance(value, dict):
        return {key: public_display_payload(item, key) for key, item in value.items()}
    if isinstance(value, list):
        return [public_display_payload(item, field) for item in value]
    if isinstance(value, str) and field in _DISPLAY_FIELDS:
        return public_text(value)
    return value
