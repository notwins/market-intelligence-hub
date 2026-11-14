/* Dependency-free DOM-contract tests. Browser layout is a separate verification. */
'use strict';
const fs = require('node:fs'), vm = require('node:vm'), assert = require('node:assert/strict');
class Element {
  constructor(tag, attrs = {}, parent = null) {
    this.tag = tag; this.attrs = attrs; this.parentElement = parent; this.children = []; this.text = '';
    this.hidden = Object.hasOwn(attrs, 'hidden'); this.open = Object.hasOwn(attrs, 'open'); this.value = ''; this.events = {};
    this.classes = new Set((attrs.class || '').split(' '));
    this.classList = {toggle: (name, on) => on ? this.classes.add(name) : this.classes.delete(name)};
  }
  get textContent() { return this.text + this.children.map(n => n.textContent).join(' '); }
  set textContent(value) { this.text = value; this.children = []; }
  matches(selector) {
    if (selector.endsWith(':not([hidden])')) return !this.hidden && this.matches(selector.replace(':not([hidden])', ''));
    return selector[0] === '.' ? this.classes.has(selector.slice(1)) : this.tag === selector;
  }
  querySelectorAll(selector) {
    if (selector.startsWith(':scope > ')) return this.children.filter(n => n.matches(selector.slice(9)));
    return this.children.flatMap(n => [...(n.matches(selector) ? [n] : []), ...n.querySelectorAll(selector)]);
  }
  querySelector(selector) { return this.querySelectorAll(selector)[0] || null; }
  closest(selector) { return this.matches(selector) ? this : this.parentElement?.closest(selector) || null; }
  addEventListener(type, fn) { this.events[type] = fn; }
  focus() { this.focused = true; }
}
const root = new Element('document'); let current = root;
const html = fs.readFileSync('site/site-map.html', 'utf8');
for (const token of html.match(/<!--[\s\S]*?-->|<![^>]*>|<[^>]+>|[^<]+/g)) {
  if (token.startsWith('<!')) continue;
  if (token.startsWith('</')) { current = current.parentElement; continue; }
  if (token.startsWith('<')) {
    const tag = token.match(/^<([\w-]+)/)[1];
    const attrs = {}; for (const match of token.slice(tag.length + 1).matchAll(/([\w:-]+)(?:="([^"]*)")?/g)) attrs[match[1]] = match[2] || '';
    const node = new Element(tag, attrs, current); current.children.push(node);
    if (!['meta', 'link', 'input', 'br', 'hr', 'img'].includes(tag) && !token.endsWith('/>')) current = node;
  } else current.text += token.replaceAll('&amp;', '&').replaceAll('&lt;', '<').replaceAll('&gt;', '>');
}
const ids = new Map();
function all(n) { return [n, ...n.children.flatMap(all)]; }
for (const n of all(root)) if (n.attrs.id) ids.set(n.attrs.id, n);
const doc = {querySelector: s => root.querySelector(s), getElementById: id => ids.get(id)};
const globals = {};
vm.runInNewContext(fs.readFileSync('site/site-map.js', 'utf8'), {document: doc, addEventListener: (name, fn) => {globals[name] = fn;}});
const input = ids.get('map-search'), status = ids.get('map-status'), families = root.querySelectorAll('.family-branch'), details = root.querySelectorAll('details');
const nodes = root.querySelectorAll('.map-node');
const click = id => ids.get(id).events.click();
const search = value => {input.value = value; input.events.input();};
assert(status.textContent.startsWith('44 destinations'));
assert.equal(details.filter(d => d.open).length, 6);
assert.equal(root.querySelector('.map-controls').hidden, false);
click('collapse-all'); assert(details.every(d => !d.open));
search('CPF'); assert(status.textContent.startsWith('3 matching destinations'));
assert.equal(families.filter(n => !n.hidden).length, 2);
assert.equal(families.filter(n => !n.hidden)[1].classes.has('right-branch'), true);
assert(families.filter(n => !n.hidden).every(n => n.querySelector('details').open));
click('clear-search'); assert(input.focused); assert.equal(input.value, ''); assert(details.every(d => !d.open)); assert(nodes.every(n => !n.hidden));
click('expand-all'); assert(details.every(d => d.open));
search('225'); assert(status.textContent.startsWith('1 matching destination'));
const target = nodes.find(n => n.querySelector(':scope > .map-link').attrs.href === 'v4.html#history/si');
assert(!target.hidden); assert(!target.parentElement.closest('.map-node').hidden);
assert(target.parentElement.closest('details').open);
search('  ＣＰＦ  '); assert(status.textContent.startsWith('3 matching destinations'));
search('<script>alert(1)</script>'); assert(status.textContent.startsWith('0 matching destinations')); assert.equal(ids.get('no-results').hidden, false);
search('zzzzzz'); click('reset-map'); assert(nodes.every(n => !n.hidden)); assert.equal(details.filter(d => d.open).length, 6);
search('search'); assert(families.some(n => !n.hidden));
let prevented = false; input.events.keydown({key: 'Escape', preventDefault() { prevented = true; }}); assert(prevented); assert.equal(input.value, '');
click('collapse-all'); globals.beforeprint(); assert(details.every(d => d.open)); globals.afterprint(); assert(details.every(d => !d.open));
search('CPF'); click('expand-all'); assert.equal(input.value, ''); assert(nodes.every(n => !n.hidden)); assert(details.every(d => d.open));
click('reset-map'); assert.equal(details.filter(d => d.open).length, 6);
console.log('PASS sitemap: all 44 links, search/ancestor reveal, no-match recovery, Unicode, repeat/reset, keyboard clear, restore disclosure state, print restoration and visible-branch connectors.');
