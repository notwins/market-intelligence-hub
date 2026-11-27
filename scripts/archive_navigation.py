"""Add the shared Hub navigation to a served HTML document without rewriting its body."""
import re

NAVIGATION = b'<script defer data-mih-archive-navigation src="/market-intelligence-hub/archive-navigation.js"></script>'
INSERT_BEFORE = (
    re.compile(rb'</head\s*>', re.IGNORECASE),
    re.compile(rb'</body\s*>', re.IGNORECASE),
    re.compile(rb'</html\s*>', re.IGNORECASE),
)


def decorate(original):
    if NAVIGATION in original:
        raise ValueError('Archive navigation is already present')
    for pattern in INSERT_BEFORE:
        tag = pattern.search(original)
        if tag:
            return original[:tag.start()] + NAVIGATION + original[tag.start():]
    return original + NAVIGATION


def restore(deployed):
    """Require one exact insertion at the renderer's chosen position."""
    if deployed.count(NAVIGATION) != 1:
        raise ValueError('Expected one shared archive navigation script')
    original = deployed.replace(NAVIGATION, b'', 1)
    if decorate(original) != deployed:
        raise ValueError('Shared archive navigation script is out of position')
    return original
