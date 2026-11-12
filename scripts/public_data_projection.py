"""Deterministic public-data privacy projection; source editions stay unchanged."""
import json
import re
from pathlib import Path
from urllib.parse import unquote, urlsplit
from import_hourly_news import source_report_key


def private_url(value):
    if not isinstance(value, str):
        return False
    try:
        url = urlsplit(value)
        host = (url.hostname or '').lower().rstrip('.')
        path = unquote(url.path)
        return (host in ('chatgpt.com', 'chat.openai.com') and
                any(path == '/' + part or path.startswith('/' + part + '/')
                    for part in ('c', 'g', 'space', 'library')))
    except ValueError:
        return False


def eligible(relative):
    path = Path(relative)
    return (relative in ('v2-data.js', 'data/hourly-news.json') or
            path.parent.as_posix() in ('data/hourly-archive', 'data/v2') and path.suffix == '.json')


def public_value(value):
    if isinstance(value, list):
        return [public_value(x) for x in value]
    if isinstance(value, dict):
        result = {key: public_value(child) for key, child in value.items()}
        # Keep legacy hourly deduplication identity without its private origin.
        if 'stories' in value and 'report_at' in value and private_url(value.get('original_url')):
            result['source_report_key'] = value.get('source_report_key') or source_report_key(value['original_url'])
        return result
    return None if private_url(value) else value


def projected_bytes(relative, raw):
    if not eligible(relative):
        return raw
    text = raw.decode('utf-8')
    if relative == 'v2-data.js':
        prefix = 'window.MI_V2_DATA='
        if not text.strip().startswith(prefix) or not text.strip().endswith(';'):
            raise ValueError('Unexpected V2 data wrapper')
        value = json.loads(text.strip()[len(prefix):-1])
    else:
        value = json.loads(text)
    result = public_value(value)
    if result == value:
        return raw
    if relative == 'v2-data.js':
        return ('window.MI_V2_DATA=' + json.dumps(result, ensure_ascii=False, separators=(',', ':')) + ';\n').encode('utf-8')
    return (json.dumps(result, ensure_ascii=False, indent=2) + '\n').encode('utf-8')


def stage(site):
    changed = []
    for path in Path(site).rglob('*'):
        if not path.is_file():
            continue
        relative = path.relative_to(site).as_posix()
        if eligible(relative):
            before = path.read_bytes()
            after = projected_bytes(relative, before)
            if before != after:
                path.write_bytes(after)
                changed.append(relative)
    # Fail closed if another public text asset starts leaking a private origin.
    for path in Path(site).rglob('*'):
        if not path.is_file():
            continue
        try:
            text = path.read_text(encoding='utf-8')
        except UnicodeError:
            continue
        for url in re.findall(r'https?://[^\s<>"\']+', text):
            if private_url(url):
                raise ValueError('Private origin remains in public asset: ' + path.relative_to(site).as_posix())
    return sorted(changed)
