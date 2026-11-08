# Site family tree

`site/site-map.html` is the source of the static, clickable site map. It keeps all 40 previously listed destinations and adds the two real dashboard parent routes for Security master and Historical charts. Nested lists and native disclosures work without JavaScript; all six category branches start open, with the two subsection lists collapsed.

`site-map.js` adds local text filtering, ancestor-path reveal, expand/collapse, reset and disclosure restoration after clearing a search or printing. It never changes navigation, storage, market data or source records. The initial map does not make network requests for its data. Individual destination links keep their previous behavior, including the CPF calculator's new tab.

Presentation uses the verified V3 Earth & Slate structural surfaces. The six existing sitemap navigation-family accent colours are retained as navigation, not new content classifications. Eleven clearly mapped subject nodes use the exact V1.2 Merged semantic text/chip pair from `site/data/colour-templates-v3.json`; all text/backdrop pairs meet 4.5:1. Icons inherit each node's text colour. Narrow screens use a single connected column; keyboard focus and forced-colour styles remain visible.

Validation:

- `python -m unittest discover -s scripts -p 'test_site_map.py'` checks destination retention, real parent routes, source-page existence, disclosures, accessibility, exact semantic mappings and contrast. It also runs the dependency-free interaction tests.
- `node scripts/test_site_map_interactions.cjs` checks search, ancestor reveal, Unicode, no-result recovery, repeated actions, disclosure-state restoration, Escape, print restoration and filtered connector placement.
- Browser verification should cover desktop and narrow viewports, link clicks, Back/Forward, repeated open/close and no-JavaScript navigation. DOM tests are not a claim of visual browser coverage.
