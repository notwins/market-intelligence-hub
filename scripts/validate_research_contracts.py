"""Fail-closed V3 contract checks for new research HTML, not an editorial fact checker."""
import argparse
from datetime import datetime
from html.parser import HTMLParser
import json
import hashlib
from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[1]
CONTRACT_ID = 'mih-research-contract'
VOID = {'area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'param', 'source', 'track', 'wbr'}


def require(condition, message):
    if not condition:
        raise ValueError(message)


class Document(HTMLParser):
    def __init__(self, text):
        super().__init__(convert_charrefs=True)
        self.nodes, self.stack, self.contracts = [], [], []
        self.feed(text)
        self.by_id = {}
        for node in self.nodes:
            key = node['attrs'].get('id')
            if key:
                require(key not in self.by_id, 'Duplicate HTML id: ' + key)
                self.by_id[key] = node

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        node = {'tag': tag, 'attrs': attrs, 'text': '', 'parents': list(self.stack)}
        node['hidden'] = (tag in {'script', 'style', 'template'} or 'hidden' in attrs or
                          attrs.get('aria-hidden') == 'true' or
                          bool(re.search(r'display\s*:\s*none|visibility\s*:\s*hidden', attrs.get('style', ''), re.I)) or
                          any(p['hidden'] for p in self.stack))
        self.nodes.append(node)
        if tag == 'script' and attrs.get('id') == CONTRACT_ID:
            require(attrs.get('type') == 'application/json', 'Contract must be application/json')
            self.contracts.append(node)
        if tag not in VOID:
            self.stack.append(node)

    def handle_startendtag(self, tag, attrs):
        self.handle_starttag(tag, attrs)
        if tag not in VOID:
            self.handle_endtag(tag)

    def handle_endtag(self, tag):
        for i in range(len(self.stack) - 1, -1, -1):
            if self.stack[i]['tag'] == tag:
                del self.stack[i:]
                break

    def handle_data(self, text):
        if self.stack and self.stack[-1]['tag'] == 'script':
            self.stack[-1]['text'] += text
        elif not any(n['hidden'] for n in self.stack):
            for node in self.stack:
                node['text'] += text

    def visible(self, key, parent=None):
        require(isinstance(key, str) and key in self.by_id, 'Missing visible label id: ' + str(key))
        node = self.by_id[key]
        require(not node['hidden'] and node['text'].strip(), 'Empty/hidden label: ' + key)
        require(not re.search(r'\b(TODO|TBD|PLACEHOLDER)\b|\[REPLACE', node['text'], re.I), 'Unfinished label: ' + key)
        if parent is not None:
            require(parent in node['parents'], 'Label must be inside its chart/card: ' + key)
        return node


def object_keys(value, allowed, label):
    require(isinstance(value, dict), label + ' must be an object')
    require(not (set(value) - set(allowed)), label + ' has unknown/override fields: ' + ', '.join(sorted(set(value) - set(allowed))))


def nonempty(value):
    return (isinstance(value, str) and bool(value.strip()) and
            not re.search(r'\b(TODO|TBD|PLACEHOLDER)\b|\[REPLACE', value, re.I))


def unique_object(pairs):
    result = {}
    for key, value in pairs:
        require(key not in result, 'Duplicate contract key: ' + key)
        result[key] = value
    return result


def validate_document(text, standard):
    doc = Document(text)
    require(len(doc.contracts) == 1, 'Exactly one mih-research-contract is required')
    c = json.loads(doc.contracts[0]['text'], object_pairs_hook=unique_object)
    object_keys(c, ['version','theme','route','route_rationale','user_choice_reference','presentation_tokens','cutoff','cutoff_id','title_id','takeaways',
                    'source_ids','limitations_id','semantic_tags','visuals','cards','no_visuals_reason',
                    'no_cards_reason','editorial_review'], 'Contract')
    require(c.get('version') == 3, 'Contract version must be 3')
    themes = {t['id']: t for t in standard['themes']}
    routes = {r['id']: r for r in standard['routes']}
    require(c.get('theme') in themes, 'Unknown V3 theme')
    if c.get('route') == 'explicit-user-choice':
        require(nonempty(c.get('user_choice_reference')), 'Explicit user choice requires a nonprivate approval reference')
    else:
        require(c.get('route') in routes and routes[c['route']]['themeId'] == c['theme'], 'Invalid V3 route/theme combination')
    require(nonempty(c.get('route_rationale')), 'Route rationale required; do not infer identity from theme')
    require(c.get('presentation_tokens') == themes[c['theme']]['tokens'], 'Presentation tokens must match exact V3 theme')
    cutoff = datetime.fromisoformat(c.get('cutoff', '').replace('Z', '+00:00'))
    require(cutoff.tzinfo is not None, 'Research cutoff requires timezone')
    doc.visible(c.get('title_id'))
    cutoff_label = doc.visible(c.get('cutoff_id'))
    require(c['cutoff'] in cutoff_label['text'], 'Visible cutoff must include exact dated/timezone cutoff')
    doc.visible(c.get('limitations_id'))
    require(isinstance(c.get('takeaways'), list) and 1 <= len(c['takeaways']) <= 5, 'Require 1–5 takeaways')
    for key in c['takeaways']:
        doc.visible(key)
    require(isinstance(c.get('source_ids'), list) and c['source_ids'], 'Require source links')
    for key in c['source_ids']:
        node = doc.visible(key)
        require(node['tag'] == 'a' and re.match(r'^https?://[^/\s]+', node['attrs'].get('href','')), 'Source must be a visible HTTP(S) link')
    tags = {t['id']: t for t in standard['tags']}
    require(isinstance(c.get('semantic_tags'), list), 'semantic_tags must be an explicit list (empty if unmapped)')
    declared = set()
    for tag in c['semantic_tags']:
        object_keys(tag, ['id','element_id','light','dark','lightChip','darkChip','context'], 'Semantic tag')
        require(tag.get('id') in tags, 'Unknown/unapproved semantic tag')
        require(nonempty(tag.get('context')), 'Tag requires disambiguating context')
        for field in ('light','dark','lightChip','darkChip'):
            require(tag.get(field) == tags[tag['id']][field], 'Illegal semantic colour override: ' + field)
        node = doc.visible(tag.get('element_id'))
        require(node['attrs'].get('data-mih-semantic') == tag['id'], 'Semantic marker mismatch')
        # Catch explicit inline colour overrides too. External/computed CSS still
        # needs rendering review; a declaration is not proof of painted pixels.
        inline = node['attrs'].get('style', '')
        for property_name, allowed in [('color', {tag['light'], tag['dark']}),
                                       ('background-color', {tag['lightChip'], tag['darkChip']})]:
            match = re.search(r'(?:^|;)\s*' + property_name + r'\s*:\s*([^;!]+)', inline, re.I)
            if match:
                require(match.group(1).strip().upper() in allowed,
                        'Illegal inline semantic colour override: ' + property_name)
        require(tag['element_id'] not in declared, 'Duplicate semantic element declaration')
        declared.add(tag['element_id'])
    require({n['attrs'].get('id') for n in doc.nodes if 'data-mih-semantic' in n['attrs']} == declared,
            'Every semantic marker must be declared; no guessed tags')
    registered = set()
    for collection in ('visuals','cards'):
        rows = c.get(collection)
        require(isinstance(rows, list), collection + ' must be a list')
        if not rows:
            require(nonempty(c.get('no_' + collection + '_reason')), 'Explain absent ' + collection)
        for row in rows:
            fields = ['id','title_id','date_id','units_id','source_id','finding_id','limitations_id']
            if collection == 'visuals':
                fields += ['kind','instrument_id','how_to_read_id']
            object_keys(row, fields, collection)
            node = doc.visible(row.get('id'))
            require(row['id'] not in registered, 'Duplicate chart/card registration')
            registered.add(row['id'])
            marker = 'data-mih-visual' if collection == 'visuals' else 'data-mih-card'
            require(marker in node['attrs'], 'Missing chart/card marker: ' + row['id'])
            if collection == 'visuals':
                require(row.get('kind') in {'chart','table','diagram','image'}, 'Invalid visual kind')
            for field in fields:
                if field.endswith('_id'):
                    doc.visible(row.get(field), node)
            require(row['source_id'] in c['source_ids'], 'Chart/card source must be registered source link')
    marked = {n['attrs'].get('id') for n in doc.nodes if 'data-mih-visual' in n['attrs'] or 'data-mih-card' in n['attrs']}
    require(marked == registered, 'Unregistered visual/card')
    for node in doc.nodes:
        if node['tag'] in {'svg','canvas','table'}:
            require(any(p['attrs'].get('id') in registered for p in [node] + node['parents']), 'Unregistered SVG/canvas/table')
    review = c.get('editorial_review')
    object_keys(review, ['reviewer','evidence_checked','semantic_context_checked','accessibility_checked'], 'Editorial review')
    require(nonempty(review.get('reviewer')) and not re.search(r'template|replace|todo|tbd', review['reviewer'], re.I), 'Named editorial reviewer required')
    require(all(review.get(k) is True for k in ('evidence_checked','semantic_context_checked','accessibility_checked')), 'Editorial review incomplete')
    return c


def generated_watchlist_compatibility(site, relative, content):
    """Recognize only exact output of the existing non-V3 report generator.

    This is not a V3 compliance attestation. Arbitrary HTML in data/ is never
    exempt, and a receipt alone cannot turn an authored report into generated
    content. Existing suite checks still validate archive/index/review linkage.
    """
    match = re.fullmatch(r'data/watchlist/reports/(watchlist-\d{8}T\d{6}Z(?:-r[1-9][0-9]*)?)\.html', relative)
    if not match:
        return False
    from watchlist_report import render_report
    edition_id = match.group(1)
    archive = site / 'data/watchlist/archive' / (edition_id + '.json')
    receipt_path = site / 'data/watchlist/report-index.json'
    require(archive.is_file() and receipt_path.is_file(), 'Generated report requires archive and receipt: ' + relative)
    edition = json.loads(archive.read_text(encoding='utf-8'))
    require(edition.get('id') == edition_id, 'Generated report archive ID mismatch')
    # render_report invokes the existing strict edition/privacy/financial validator.
    require(content == render_report(edition).encode('utf-8'), 'Generated report differs from approved renderer: ' + relative)
    receipts = json.loads(receipt_path.read_text(encoding='utf-8')).get('reports', [])
    matches = [r for r in receipts if r.get('edition_id') == edition_id]
    require(len(matches) == 1, 'Generated report requires exactly one matching receipt')
    receipt = matches[0]
    require(receipt.get('path') == relative and receipt.get('as_of') == edition['as_of'] and
            receipt.get('sha256') == hashlib.sha256(content).hexdigest(), 'Generated report receipt mismatch')
    return True


def validate_site(site, baseline=None):
    site = Path(site)
    baseline = baseline or json.loads((ROOT/'scripts/research_contract_legacy.json').read_text())
    legacy = set(baseline['paths'])
    standard = json.loads((site/'data/colour-templates-v3.json').read_text())
    checked, generated_compatibility = [], []
    for path in sorted(site.rglob('*.html')):
        relative = path.relative_to(site).as_posix()
        text = path.read_text(encoding='utf-8')
        # Fixed source inventory, never dynamically grandfather a new path. A
        # legacy page explicitly opting in is checked too. UI pages are not reports.
        opted_in = CONTRACT_ID in text
        research_path = relative.startswith(('research/', 'market-understanding/', 'data/'))
        # Attribute order must not permit article metadata to bypass the gate.
        parsed = Document(text) if relative not in legacy and not research_path else None
        article = parsed is not None and any(n['tag'] == 'meta' and (
            (n['attrs'].get('property') == 'og:type' and n['attrs'].get('content') == 'article') or
            (n['attrs'].get('name') == 'mih-content-type' and n['attrs'].get('content') in {'article','research'})
        ) for n in parsed.nodes)
        if relative not in legacy and not opted_in and generated_watchlist_compatibility(site, relative, path.read_bytes()):
            generated_compatibility.append(relative)
            continue
        if opted_in or (relative not in legacy and (research_path or article)):
            try:
                validate_document(text, standard)
            except (ValueError, TypeError, KeyError, AttributeError) as exc:
                raise ValueError(relative + ': ' + str(exc)) from exc
            checked.append(relative)
    return {'standard': 'V3 presentation / V1.2 semantics', 'checked': checked, 'legacy_count': len(legacy),
            'generated_compatibility_non_v3': generated_compatibility}


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--site', type=Path, default=ROOT/'site')
    print(json.dumps(validate_site(parser.parse_args().site), indent=2))
