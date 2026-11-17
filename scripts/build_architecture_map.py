"""Build the public, self-contained Hub blueprint from this checkout only.

No source schedules, content repository, credentials or site inputs are changed.
The optional owner export reads local schedule configuration outside the checkout.
"""
import argparse
from datetime import datetime, timezone
from html import unescape
from html.parser import HTMLParser
import json
from pathlib import Path
import re
import subprocess
from urllib.parse import urljoin, urlsplit, unquote

ROOT = Path(__file__).resolve().parents[1]
HUB = 'https://notwins.github.io/market-intelligence-hub/'
CONTENT = 'https://notwins.github.io/market-intelligence-content/'


class Page(HTMLParser):
    def __init__(self, text):
        super().__init__(); self.title = ''; self.links = []; self.assets = []; self.routes = {}; self.ids = set(); self._title = False; self._route = None; self._route_depth = 0
        self.feed(text)

    def handle_starttag(self, tag, attrs):
        a = dict(attrs)
        if tag == 'title': self._title = True
        if a.get('id'): self.ids.add(a['id'])
        if tag == 'a' and a.get('href'): self.links.append(a['href'])
        if tag == 'script' and a.get('src'): self.assets.append(a['src'])
        if a.get('data-view'):
            key=a['data-view']; self._route = None if self.routes.get(key) else key; self._route_depth = 1
            if self._route: self.routes.setdefault(self._route, '')
        elif self._route: self._route_depth += 1

    def handle_endtag(self, tag):
        if tag == 'title': self._title = False
        if self._route:
            self._route_depth -= 1
            if self._route_depth <= 0: self._route = None

    def handle_data(self, s):
        if self._title: self.title += s
        if self._route: self.routes[self._route] += s


def git(root, *args):
    try: return subprocess.check_output(['git', *args], cwd=root, text=True, encoding='utf-8', stderr=subprocess.DEVNULL).strip()
    except (OSError, subprocess.CalledProcessError): return ''


def cron_in_singapore(expression):
    """Describe fixed daily/weekly UTC crons; leave other syntax explicit."""
    fields = expression.split()
    fallback = {'cron_utc': expression, 'readable_sgt': 'UTC cron: ' + expression + ' (SGT description not inferred)', 'conversion': 'utc-only'}
    if len(fields) != 5: return fallback
    minute, hour, day, month, weekday = fields
    if not minute.isdigit() or not hour.isdigit() or day != '*' or month != '*': return fallback
    minute, hour = int(minute), int(hour)
    if not 0 <= minute < 60 or not 0 <= hour < 24: return fallback
    local_hour, next_day = (hour + 8) % 24, (hour + 8) // 24
    time = f'{local_hour:02d}:{minute:02d} SGT'
    if weekday == '*': label = 'Daily at ' + time
    else:
        names = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
        named = {name[:3].upper(): index for index, name in enumerate(names)}
        if weekday.isdigit() and 0 <= int(weekday) <= 7: index = int(weekday) % 7
        elif weekday.upper() in named: index = named[weekday.upper()]
        else: return fallback
        label = names[(index + next_day) % 7] + ' at ' + time
    return {'cron_utc': expression, 'readable_sgt': label, 'conversion': 'exact'}


def workflow_refresh(root):
    """Read only public workflow trigger declarations; never private schedules.

    The dependency-free reader handles the block-style trigger mapping used by
    this repository. It does not evaluate YAML, expressions or workflow code.
    Unknown cron syntax remains visible in UTC rather than receiving a guess.
    """
    workflow = '.github/workflows/publish.yml'
    triggers = {'push': {'enabled': False, 'branches': []}, 'manual': False, 'schedules': []}
    try: text = (Path(root) / workflow).read_text(encoding='utf-8')
    except OSError: text = ''
    match = re.search(r'''(?m)^(?:on|'on'|"on"):[ \t]*(?:#.*)?$''', text)
    blocks = {}
    if match:
        lines = []
        for line in text[match.end():].splitlines():
            if line.strip() and not line.lstrip().startswith('#') and not line[0].isspace(): break
            lines.append(line)
        meaningful = [line for line in lines if line.strip() and not line.lstrip().startswith('#')]
        indent = min((len(line) - len(line.lstrip()) for line in meaningful), default=2)
        current = None
        for line in lines:
            event = re.match(r'^ {' + str(indent) + r'}([A-Za-z_][A-Za-z0-9_]*):[ \t]*(.*)$', line)
            if event:
                current = event[1]; blocks[current] = [event[2]]
            elif current: blocks[current].append(line)
    if 'push' in blocks:
        triggers['push']['enabled'] = True
        push = '\n'.join(blocks['push'])
        branch = re.search(r'(?m)^\s*branches:\s*\[([^\]\n]*)\]', push)
        if branch:
            triggers['push']['branches'] = [v.strip().strip("\"'") for v in branch[1].split(',') if v.strip()]
        else:
            branch = re.search(r'(?m)^(\s*)branches:[ \t]*(?:#.*)?$', push)
            if branch:
                for line in push[branch.end():].splitlines():
                    if not line.strip() or line.lstrip().startswith('#'): continue
                    item = re.match(r'^\s+-\s+([^#]+?)[ \t]*(?:#.*)?$', line)
                    if not item: break
                    triggers['push']['branches'].append(item[1].strip().strip("\"'"))
    triggers['manual'] = 'workflow_dispatch' in blocks
    schedule = '\n'.join(blocks.get('schedule', []))
    for match in re.finditer(r'''(?m)^\s*-\s*cron:[ \t]*(?:'([^'\n]+)'|"([^"\n]+)"|([^#\n]+))''', schedule):
        expression = next(value for value in match.groups() if value is not None).strip()
        triggers['schedules'].append(cron_in_singapore(expression))
    summary = []
    if triggers['push']['enabled']:
        branches = triggers['push']['branches']
        summary.append(('Push to ' + ', '.join(branches)) if branches else 'Push events')
    if triggers['manual']: summary.append('Manual workflow runs')
    summary.extend(item['readable_sgt'] for item in triggers['schedules'])
    return {
        'new_schedule_required': False,
        'architecture': {
            'workflow': workflow, 'mode': 'existing_ui_build', 'triggers': triggers,
            'summary': '; '.join(summary) if summary else 'Workflow trigger declarations unavailable; cadence not inferred',
            'status': 'Declared workflow; execution not monitored',
            'rebuild': 'Regenerated by the existing UI build; published only after its release succeeds. Scheduled jobs may start late.'
        },
        'research': {
            'mode': 'browser_open_and_manual', 'url': CONTENT + 'data/research-feed.json',
            'summary': 'The browser checks the independent public research feed when the map opens online and on manual refresh. A validated feed indexes report destinations; it does not verify each destination body.'
        },
        'private_automations': {
            'mode': 'declared_configuration', 'rechecked_by_public_build': False, 'live_status': False,
            'summary': 'Publisher/importer cadences are declared configuration. Public builds do not read private scheduler files or recheck enabled state, execution or report publication.'
        }
    }


def build_graph(root=ROOT):
    root = Path(root); site = root / 'site'; nodes = {}; edges = {}; pages = {}; refresh = workflow_refresh(root)
    def node(id, title, type, group, **extra):
        value = {'id':id, 'title':title, 'type':type, 'group':group, 'description':'', 'evidence':[], 'confidence':'source', **extra}
        nodes[id] = value; return id
    def edge(source, target, kind='depends', label='', confidence='source', evidence=''):
        if source != target: edges[(source, target, kind)] = dict(source=source, target=target, kind=kind, label=label or kind, confidence=confidence, evidence=evidence)
    groups = [
        ('site','Website & navigation','pages'), ('research','Research library','pages'), ('history','Historical charts','pages'),
        ('tools','Tools & references','pages'), ('archive','Archive & earlier versions','pages'), ('legal','Legal & transparency','pages'),
        ('providers','Original information sources','source'), ('automation','Publishing & data jobs','automation'), ('data','Feeds & datasets','data'), ('software','Applications & hosting','software')]
    for id, title, typ in groups: node('group:'+id,title,'group',id,description='Expand this district to inspect its pages or dependencies.', category=typ)
    for path in sorted(site.rglob('*.html')):
        rel = path.relative_to(site).as_posix()
        if rel == 'blueprint.html': continue
        p = Page(path.read_text(encoding='utf-8', errors='replace')); pages[rel] = p
        if rel.startswith(('research/','market-understanding/','research-explained/','presentations/')): group='research'
        elif rel.startswith('legal/'): group='legal'
        elif rel.startswith(('tools/','colour-templates','colour-reference','tag-map','external-sources','report-style')): group='tools'
        elif rel.startswith(('v1.','v2.','v3','archive','watchlist-report')): group='archive'
        else: group='site'
        title=re.sub(r'\s+',' ',p.title).strip() or rel
        node('page:'+rel,title,'page',group,url=HUB+rel, path=rel, description='HTML page in the published UI source. Its original dates and qualifications remain with the content.', evidence=['site/'+rel], parent='group:'+group)
        edge('group:'+group,'page:'+rel,'contains','contains')
    for rel in pages:
        folder=rel.rsplit('/',1)[0] if '/' in rel else ''
        parent=folder+'/index.html'
        if folder and parent in pages and rel!=parent:
            id='page:'+rel; old=nodes[id]['parent']; nodes[id]['parent']='page:'+parent
            edges.pop((old,id,'contains'),None); edge('page:'+parent,id,'contains','subpage / companion')
    # Real client-side routes, discovered from desktop/mobile navigation.
    routes = pages.get('v4.html', Page('')).routes
    route_names={'history/beta-shares':'Returns','history/beta2-shares':'Event studies','history/beta3-shares':'Share explorer · price / P/E / P/B','history/beta4-shares':'History pivot'}
    for route, raw in sorted(routes.items()):
        title = route_names.get(route) or re.sub(r'^[^\w]+','',re.sub(r'\s+',' ',raw)).strip() or route
        group='history' if route.startswith('history') else 'site'
        node('route:'+route,title,'section',group,url=HUB+'v4.html#'+route,description='A client-side view within V4; it is not a separate HTML file.',evidence=['site/v4.html data-view='+route],parent='page:v4.html')
        edge('page:v4.html','route:'+route,'contains','section')
        if '/' in route and 'route:'+route.split('/')[0] in nodes:
            parent='route:'+route.split('/')[0]; nodes['route:'+route]['parent']=parent
            edges.pop(('page:v4.html','route:'+route,'contains'),None); edge(parent,'route:'+route,'contains','subsection')
    companies=json.loads((site/'data/earnings-history.json').read_text(encoding='utf-8')).get('companies',[])
    for company in companies:
        ticker=company.get('ticker','')
        if not re.fullmatch(r'[A-Z0-9.\-]{1,15}',ticker): continue
        for suffix,parent,label in [('earnings','route:earnings','Earnings card'),('history/beta3-shares','route:history/beta3-shares','Price / P/E / P/B history')]:
            id='company:'+ticker+':'+suffix
            node(id,company.get('name',ticker)+' · '+label,'section','history' if suffix.startswith('history') else 'site',url=HUB+'v4.html?company='+ticker+'#'+suffix,description='A company-selected destination inside an existing V4 view. Data availability and source dates stay explicit.',evidence=['site/data/earnings-history.json','site/earnings-desk.js','site/v4-share-lab.js'],parent=parent)
            edge(parent,id,'contains','company card')
    def resolve(rel, href):
        if href.startswith(('mailto:','tel:','javascript:','data:')): return None
        u=urlsplit(urljoin(HUB+rel,href))
        if u.netloc!='notwins.github.io' or not u.path.startswith('/market-intelligence-hub/'): return None
        path=unquote(u.path[len('/market-intelligence-hub/'):])
        if path.endswith('/') or not path: path += 'index.html'
        if path=='v4.html' and u.fragment in routes: return 'route:'+u.fragment
        return 'page:'+path if path in pages else None
    for rel,p in pages.items():
        for href in p.links:
            dest=resolve(rel,href)
            if dest: edge('page:'+rel,dest,'navigation','links to',evidence='HTML href')
    # Observed browser modules. Explicit imports are certain; a dataset string in
    # a module is a source-reference candidate, not a proven runtime request.
    for rel,p in pages.items():
        if rel not in ['desk.html','v4.html','index.html','search.html','archive.html','research-feed.html']: continue
        for src in p.assets:
            path=unquote(urlsplit(urljoin(HUB+rel,src)).path.removeprefix('/market-intelligence-hub/'))
            if not (site/path).is_file() or not path.endswith('.js'): continue
            mid='module:'+path
            if mid not in nodes: node(mid,path,'module','software',path=path,description='Browser JavaScript module loaded by a page.',evidence=['site/'+path],parent='group:software')
            edge(mid,'page:'+rel,'renders','loaded by',evidence='script src in site/'+rel)
    datasets={
        'research-feed.json':('Research cards & full-report links','Complete report records, source dates and matching quick reads.','content'),
        'hourly-news.json':('Reuters news editions','Versioned stories, actual source cutoffs and explicit coverage gaps.','content'),
        'news.json':('Reuters headline metadata','Metadata/RSS discovery is distinct from a completed detailed source report.','hub'),
        'history-fed.json':('Fed FX & benchmark history','Monthly exchange-rate and Treasury benchmark history; original observation dates are retained.','hub'),
        'sgs-daily-snapshot.json':('MAS SGS yield & clean-price history','Source-dated 6M/1Y bills and benchmark bonds; missing observations remain missing.','hub'),
        'wsj-treasury-dashboard.json':('Saved WSJ Treasury curve','Dated asked yields on individually quoted securities; not a constant-maturity auction series. No automatic WSJ updater was found.','hub'),
        'earnings-history.json':('Verified company earnings history','Issuer figures and takeaways. Saved research is distinct from current market prices.','hub'),
        'share-history.csv':('Dated BOS share history','Historical prices, valuations and source-row observations.','hub'),
        'beta-shares.json':('Historical total-return enrichment','The immutable supplied Bloomberg equity snapshot for 2019–2025 calendar returns and scoped credit ratings. It is distinct from current BOS YTD.','hub'),
        'desk-data.json':('Main-page desk catalogue','Derived report shelf, company list and saved dashboard projections.','hub'),
        'site-search.json':('Search catalogue','Derived searchable public records; remote content can refresh independently.','hub'),
        'master-v3.json':('Security master reference','Instrument reference and supplied source mappings.','hub'),
        'ust-curves-daily.json':('UST historical curves','Dated historical yield-curve observations.','hub'),
    }
    for name,(title,desc,origin) in datasets.items():
        path=site/'data'/name
        id='data:'+name
        node(id,title,'data','data',url=(CONTENT if origin=='content' else HUB)+'data/'+name,path='data/'+name,description=desc,evidence=['docs/independent-content-deployment.md' if origin=='content' else 'site/data/'+name],parent='group:data',origin=origin)
        if path.is_file() and name.endswith('.json') and origin!='content':
            try:
                d=json.loads(path.read_text(encoding='utf-8')); nodes[id]['dates']={k:d[k] for k in ['checked_at','verified_at','built_at','last_success','last_attempt'] if k in d and isinstance(d[k],(str,type(None)))}
            except (ValueError,OSError): pass
    node('data:prices','Current share prices','data','data',url='https://raw.githubusercontent.com/notwins/market-intelligence-hub/market-prices/manifest.json',description='Separate market-prices branch: hashed latest quotes and dated history. Provider failure retains the last verified close and date.',evidence=['site/share-prices.js','.github/workflows/share-prices.yml'],parent='group:data')
    node('data:bos','Current BOS prices & valuations','data','data',url='https://raw.githubusercontent.com/notwins/market-intelligence-hub/market-prices/bos/manifest.json',description='Separate BOS data feed: exact listing/currency matching, as-of dates and reviewed valuations.',evidence=['site/bos-equity.js','docs/bos-daily-data.md'],parent='group:data')
    providers=[('bloomberg','Supplied Bloomberg equity snapshot','', 'Dated historical total-return and scoped credit snapshot; separate from current BOS prices.'),('reuters','Reuters reporting','https://www.reuters.com/markets/','Original public reporting, verified before a detailed story is imported.'),('issuer','Issuer filings & primary documents','', 'Company earnings releases, filings and original research sources.'),('mas','MAS SGS Closing Levels','https://eservices.mas.gov.sg/statistics/fdanet/SgsBenchmarkIssuePrices.aspx','Singapore benchmark yields, daily closing clean prices and source issue identities.'),('fred','FRED / Federal Reserve','https://fred.stlouisfed.org/','FX and Treasury benchmark observations; data frequency is kept explicit.'),('yahoo','Yahoo Finance','https://finance.yahoo.com/','Completed market closes used by the data-only price workflow.'),('bos','Bank of Singapore','', 'Supplied dated BOS source documents. Source import is separate from public page editing.'),('wsj','WSJ Treasury quote table','https://www.wsj.com/market-data/bonds/treasuries','Saved WSJ asked-yield observations; future automatic refresh is not established.')]
    for id,title,url,desc in providers: node('source:'+id,title,'source','providers',url=url,description=desc,parent='group:providers',evidence=['Source references in public scripts/data'])
    node('source:rss','Google News RSS · Reuters discovery','source','providers',url='https://news.google.com/',description='Headline metadata discovery used by update_news.py. It is not full Reuters wire coverage or a completed detailed report.',parent='group:providers',evidence=['scripts/update_news.py'])
    jobs=[
        ('daily','Daily detailed-report publisher','Completed credit / earnings / election source reports → reviewed complete publications. A missing reply is not a report.','9:00 SGT · local publisher configuration','docs/independent-content-deployment.md'),
        ('hourly','Reuters news publisher','Imports completed source runs and preserves story IDs, corrections, dates and coverage gaps. It does not run substitute reporting.','At :15 hourly · publisher check; source cadence is separate','docs/independent-content-deployment.md'),
        ('sgs','MAS SGS daily importer','Updates source-dated SGS yields and price observations; retained data stays visible on source failure.','19:00 SGT · local importer configuration','SGS_DAILY.md'),
        ('bos','BOS daily importer','Reviews the supplied BOS source then updates the data branch, preserving exact listing identity.','10:00 · local schedule; scheduler timezone not stored in TOML','docs/bos-daily-data.md'),
        ('prices','Daily share closing-price job','Fetches completed Yahoo closes and writes only the market-prices branch.','08:30 SGT · GitHub workflow',' .github/workflows/share-prices.yml'),
        ('hub-build','Hub UI & market-data deployment','UI build, source validation, generated catalogues, integrity checks and GitHub Pages release. Its workflow triggers are read from this checkout. No content-repository checkout or deployment.',refresh['architecture']['summary'],'.github/workflows/publish.yml'),
        ('content-build','Independent content deployment','Complete reports and Reuters metadata deploy separately. It never builds or deploys the Hub UI.','Content main pushes · separate queue','docs/independent-content-deployment.md'),
        ('colour-audit','Publication colour audit','Scheduled public colour/tagging audit; report-only, not a research source.','Saturday 12:00 SGT · GitHub workflow','.github/workflows/weekly-publication-colour-audit.yml'),
    ]
    for id,title,desc,schedule,evidence in jobs: node('job:'+id,title,'automation','automation',description=desc,schedule=schedule,status='Configuration mapped; runtime not monitored',evidence=[evidence.strip()],parent='group:automation')
    sgs_cloud = ((root / 'scripts/sgs_github_refresh.py').is_file() and
                 any(item['cron_utc'] == '0 11 * * *' for item in refresh['architecture']['triggers']['schedules']))
    for id in ['daily', 'hourly', 'bos'] + ([] if sgs_cloud else ['sgs']):
        nodes['job:' + id]['schedule_basis'] = 'Declared configuration; not rechecked by the public build'
        nodes['job:' + id]['status'] = 'Declared cadence; private enabled state and latest execution not inspected'
        nodes['job:' + id]['confidence'] = 'reviewed'
    if sgs_cloud:
        nodes['job:sgs'].update({
            'schedule': '19:00 SGT daily · GitHub Actions',
            'schedule_basis': 'Read from .github/workflows/publish.yml and scripts/sgs_github_refresh.py',
            'status': 'Cloud configuration mapped; inspect Actions for execution',
            'confidence': 'source',
            'url': 'https://github.com/notwins/market-intelligence-hub/actions/workflows/publish.yml',
            'evidence': ['.github/workflows/publish.yml', 'scripts/sgs_github_refresh.py', 'SGS_DAILY.md']})
    node('process:blueprint-build','Blueprint generator','process','software',description='scripts/build_architecture_map.py inventories the UI source and reads its public workflow triggers. The existing UI build runs it; no additional schedule is installed.',evidence=['scripts/build_architecture_map.py','.github/workflows/publish.yml'],parent='group:software')
    node('app:blueprint','Website Blueprint','software','software',url=HUB+'blueprint.html',description='Self-contained map generated with the UI artifact. Opening it online or manually refreshing checks the independent research index. Private task status is not monitored.',evidence=['scripts/blueprint-template.html','site/blueprint.js','site/research-feed.js'],parent='group:software')
    edge('job:hub-build','process:blueprint-build','data','runs existing generator',evidence='.github/workflows/publish.yml')
    edge('process:blueprint-build','app:blueprint','data','generates architecture snapshot',evidence='scripts/build_architecture_map.py')
    edge('data:research-feed.json','app:blueprint','data','browser open / manual index refresh',evidence='site/blueprint.js and shared ResearchFeed validator; destination bodies not checked')
    node('process:source-runs','Completed source report runs','process','automation',description='Reuters scan and credit / earnings / election tasks produce completed replies before the publishers can import them. Their source task state and exact cadence are not established by a publisher schedule.',evidence=['Existing publisher instructions'],status='Source execution not inspected',parent='group:automation')
    for id,title,target in [('credit','Friday Bond & Credit Deep Dive','daily'),('earnings','US Earnings Reuters Daily','daily'),('election','U.S. Election Daily Brief','daily'),('reuters','Reuters news source runs','hourly')]:
        node('source-task:'+id,title,'process','automation',description='Original report-producing task. The publisher must read a genuinely completed reply, verify sources and preserve the exact cutoff. A publisher cadence does not establish this task’s cadence.',evidence=['Existing publisher source definitions; source run UI not inspected'],status='Source schedule and latest completed reply not verified in this map',parent='process:source-runs')
        edge('source-task:'+id,'job:'+target,'data','completed source reply required',confidence='reviewed',evidence='Publisher source contract')
    for id,title,desc,url in [('pages-hub','GitHub Pages · Hub','Public website UI artifact; independent of the content artifact.',HUB),('pages-content','GitHub Pages · Content','Public complete reports, news feeds and immutable edition history.',CONTENT),('browser','Web browser','HTML, CSS, JavaScript and SVG. Settings / shortlist / blueprint notes can stay browser-local.',''),('github','GitHub Actions','Existing build and scheduled market-data workflows.','https://github.com/notwins/market-intelligence-hub/actions'),('codex','Codex local scheduler','Local configured publishers/importers. The local execution environment must be available; configuration is not successful execution.','')]:
        node('app:'+id,title,'software','software',description=desc,url=url,evidence=['Repository workflows and deployment documentation'],parent='group:software')
    access_file=site/'data/blueprint-access.json'
    if access_file.is_file():
        access=json.loads(access_file.read_text(encoding='utf-8'))
        node('app:system-atlas','Public System Atlas','software','tools',url=access['public_url'],description='This generated public architecture map. Its online report layer follows the independent public feed.',parent='group:tools',evidence=['scripts/build_architecture_map.py'])
        node('app:owner-blueprint','Private owner blueprint · password access','software','tools',url=access['owner_url'],description='Separate server-password gate. The latest public UI structure is combined after authentication with private dated schedule configuration held in hosted secrets. It is not live source-task execution monitoring.',parent='group:tools',evidence=['site/data/blueprint-access.json'])
        edge('page:site-map.html','app:system-atlas','navigation','opens public map');edge('app:system-atlas','app:owner-blueprint','navigation','owner login entry');edge('app:system-atlas','app:owner-blueprint','data','public UI structure only')
    tool_titles={'https://clubs.winstonnggw.chatgpt.site/':'CLUBS','https://portfolio-simulation-winst.winstonnggw.chatgpt.site/new/#portfolio':'Portfolio Simulator · newer workspace','https://portfolio-simulation-winst.winstonnggw.chatgpt.site/v6/':'Portfolio Simulator · V6','https://winston-options-lab.winstonnggw.chatgpt.site/':'Options Lab'}
    for i,(url,title) in enumerate(tool_titles.items()):
        if url not in (site/'v4.html').read_text(encoding='utf-8'): continue
        id='external-app:'+str(i)
        node(id,title,'software','tools',url=url,description='External public application linked by the Hub tools view. Its internal pages, storage and automation were not inspected by this Hub inventory.',parent='group:tools',evidence=['site/v4.html external tools link'])
        edge('route:tools',id,'navigation','opens external application')
    pairs=[
        ('source:reuters','process:source-runs'),('source:issuer','process:source-runs'),('process:source-runs','job:daily'),('process:source-runs','job:hourly'),
        ('job:daily','job:content-build'),('job:hourly','job:content-build'),('job:hourly','data:hourly-news.json'),('job:content-build','app:pages-content'),('app:pages-content','data:research-feed.json'),('app:pages-content','data:hourly-news.json'),
        ('source:mas','job:sgs'),('job:sgs','data:sgs-daily-snapshot.json'),('source:bos','job:bos'),('job:bos','data:bos'),('source:yahoo','job:prices'),('job:prices','data:prices'),
        ('source:fred','job:hub-build'),('source:rss','job:hub-build'),('job:hub-build','data:history-fed.json'),('job:hub-build','data:news.json'),('job:hub-build','app:pages-hub'),
        ('source:bloomberg','data:beta-shares.json'),('source:wsj','data:wsj-treasury-dashboard.json'),('source:bos','data:share-history.csv'),('source:issuer','data:earnings-history.json'),
        ('data:research-feed.json','page:desk.html'),('data:research-feed.json','page:search.html'),('data:research-feed.json','route:reports'),('data:research-feed.json','route:earnings'),('data:research-feed.json','route:credit'),('data:research-feed.json','route:policy'),
        ('data:hourly-news.json','route:hourly'),('data:hourly-news.json','page:desk.html'),('data:news.json','route:headlines'),('data:news.json','page:desk.html'),
        ('data:sgs-daily-snapshot.json','page:desk.html'),('data:sgs-daily-snapshot.json','route:history/curves'),('data:sgs-daily-snapshot.json','route:history/yield'),
        ('data:history-fed.json','route:history/yield'),('data:history-fed.json','route:history/fx'),('data:wsj-treasury-dashboard.json','page:desk.html'),
        ('data:prices','page:desk.html'),('data:prices','route:earnings'),('data:prices','route:history/shares'),('data:bos','page:desk.html'),('data:bos','route:history/beta3-shares'),('data:bos','route:earnings'),
        ('data:share-history.csv','route:history/beta3-shares'),('data:share-history.csv','route:history/beta4-shares'),('data:earnings-history.json','route:earnings'),('data:desk-data.json','page:desk.html'),('data:site-search.json','page:search.html'),('data:ust-curves-daily.json','route:history/curves'),
        ('data:beta-shares.json','route:earnings'),('data:beta-shares.json','route:history/beta-shares'),('data:master-v3.json','route:master'),('data:master-v3.json','route:master/pivot'),('data:master-v3.json','route:watchlist'),
        ('app:codex','job:daily'),('app:codex','job:hourly'),('app:github' if sgs_cloud else 'app:codex','job:sgs'),('app:codex','job:bos'),('app:github','job:prices'),('app:github','job:hub-build'),('app:github','job:content-build'),('app:github','job:colour-audit'),('app:pages-hub','page:desk.html'),('app:pages-hub','page:v4.html')]
    for a,b in pairs:
        if a in nodes and b in nodes:
            label='manual saved observation' if a=='source:wsj' else 'feeds / enables'
            edge(a,b,'data',label,confidence='reviewed',evidence='Reviewed public reader, updater or deployment documentation; not a runtime health probe')
    # Module-level dataset references add an inspectable implementation layer.
    for id,n in list(nodes.items()):
        if n['type']!='module': continue
        s=(site/n['path']).read_text(encoding='utf-8',errors='replace')
        for name in datasets:
            if name in s: edge('data:'+name,id,'reference','source reference',confidence='candidate',evidence='Literal filename in '+n['path']+'; runtime execution not asserted')
    revisions=[]
    log=git(root,'log','-16','--format=%h%x09%aI%x09%s')
    for line in log.splitlines():
        v=line.split('\t',2)
        if len(v)==3: revisions.append(dict(sha=v[0],date=v[1],title=v[2],url='https://github.com/notwins/market-intelligence-hub/commit/'+v[0]))
    return dict(schema_version=1, audience='public', title='Market Intel · System Atlas', built_at=datetime.now(timezone.utc).isoformat(), revision=git(root,'rev-parse','HEAD'), content_origin=CONTENT, refresh=refresh, nodes=list(nodes.values()), edges=[e for e in edges.values() if e['source'] in nodes and e['target'] in nodes], revisions=revisions, coverage=dict(html_pages=len(pages),v4_routes=len(routes),boundary='Static source discovery + reviewed key data paths. A link is not an uptime assertion. Dynamic URL construction and all external applications are not exhaustively crawled.'), notes=[])


def owner_graph(graph, automation_dir):
    import copy, tomllib
    graph=copy.deepcopy(graph); graph['audience']='owner'; names={'publish hourly reuters news to dashboard':'job:hourly','publish scheduled market reports to dashboard':'job:daily','refresh bos equity prices and valuations':'job:bos','refresh mas sgs yields and price history':'job:sgs'}
    byid={n['id']:n for n in graph['nodes']}
    for p in Path(automation_dir).glob('*/automation.toml'):
        try: d=tomllib.loads(p.read_text(encoding='utf-8'))
        except (ValueError,OSError): continue
        key=str(d.get('name','')).strip().casefold()
        if key not in names: continue
        n=byid[names[key]]; n['owner']={k:d.get(k) for k in ['id','name','status','kind','rrule']}; n['owner']['timezone']=d.get('timezone') or 'Not explicitly stored in this schedule file'; n['owner']['checked_at']=graph['built_at']
        n['status']=str(d.get('status','Unknown'))+' in local configuration; successful run not asserted'
    return graph


def render(graph, root=ROOT):
    root=Path(root); template=(root/'scripts/blueprint-template.html').read_text(encoding='utf-8'); css=(root/'site/blueprint.css').read_text(encoding='utf-8'); js=(root/'site/blueprint.js').read_text(encoding='utf-8')
    validator=(root/'site/research-feed.js').read_text(encoding='utf-8')
    data=json.dumps(graph,ensure_ascii=False,separators=(',',':')).replace('<','\\u003c').replace('\u2028','\\u2028').replace('\u2029','\\u2029')
    return template.replace('/*BLUEPRINT_CSS*/',css).replace('/*BLUEPRINT_DATA*/',data).replace('/*BLUEPRINT_RESEARCH_VALIDATOR*/',validator).replace('/*BLUEPRINT_JS*/',js)


def build(root=ROOT, output=None, owner_output=None, automation_dir=None):
    root=Path(root); graph=build_graph(root); dest=Path(output) if output else root/'site/blueprint.html'; dest.parent.mkdir(parents=True,exist_ok=True); dest.write_text(render(graph,root),encoding='utf-8',newline='\n')
    if owner_output:
        if not automation_dir: raise ValueError('Owner export needs an explicit external automation directory')
        out=Path(owner_output).resolve()
        if out.is_relative_to(root.resolve()): raise ValueError('Owner export must stay outside the public repository')
        out.parent.mkdir(parents=True,exist_ok=True); out.write_text(render(owner_graph(graph,automation_dir),root),encoding='utf-8',newline='\n')
    return graph


if __name__=='__main__':
    p=argparse.ArgumentParser(description=__doc__); p.add_argument('--output',type=Path); p.add_argument('--owner-output',type=Path); p.add_argument('--automation-dir',type=Path); a=p.parse_args(); g=build(output=a.output,owner_output=a.owner_output,automation_dir=a.automation_dir); print(f"Blueprint: {len(g['nodes'])} nodes, {len(g['edges'])} connections, {g['coverage']['html_pages']} HTML pages, {g['coverage']['v4_routes']} routes")
