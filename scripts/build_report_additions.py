#!/usr/bin/env python3
"""Build original, additive visual appendices from explicit dated facts/scenarios.
No network calls, publisher images, personal data or new calculation assumptions
are hidden in this build. Original content survives removal of our markers and
reversal of the explicitly listed presentation-copy corrections.
"""
from pathlib import Path
from decimal import Decimal as D
import hashlib, html, json, re, subprocess
from datetime import datetime
from research_presentation import correct_copy, original_copy
ROOT = Path(__file__).resolve().parents[1]
SITE = ROOT / 'site'
START = '<!-- research-additions:start -->'
END = '<!-- research-additions:end -->'
ASSET = '<!-- research-additions:style -->'
JUMP = '<!-- research-additions:jump -->'
def esc(v): return html.escape(str(v))

FULL_EDITION_FIELDS = {'channel', 'kind', 'completeness_verified', 'cutoff', 'document', 'sha256', 'verification'}

def validate_full_editions(register, site=SITE):
    """Validate optional public full_edition declarations at the publication gate.

    A recovered complete original is registered as a new immutable edition.
    Its public register row may carry exactly FULL_EDITION_FIELDS below, with
    kind='complete-source-edition', completeness_verified=True and verification=
    'original-document-completeness-reviewed'. This is an explicit source-review
    attestation, never a conclusion drawn from length, page count, title or date.
    document must be an owned public HTML/PDF and sha256 must bind its exact bytes.
    Source identifiers, private URLs and reviewer identities do not belong here.
    The existing source and final-artifact unittest gates call this validator.
    """
    verified = []
    for row in register.get('entries', []):
        if 'full_edition' not in row:
            continue
        full = row['full_edition']
        def require(ok, message):
            if not ok:
                raise ValueError('Invalid full edition '+str(row.get('id', ''))+': '+message)
        require(isinstance(full, dict) and set(full) == FULL_EDITION_FIELDS, 'explicit declaration required')
        require(row.get('state') == 'published', 'unpublished edition')
        require(full['channel'] in {'credit', 'earnings', 'weekly-fx'}, 'unknown lane')
        require(full['kind'] == 'complete-source-edition' and full['completeness_verified'] is True,
                'abstracts, extracts and unverified text cannot occupy a full slot')
        require(full['verification'] == 'original-document-completeness-reviewed', 'source completeness review missing')
        require(not re.search(r'\b(?:abstract|extract|abridged|summary|compilation|reference|atlas|snapshot)\b',
                              str(row.get('edition', '')), re.I), 'non-full edition label')
        require(isinstance(full['cutoff'], str) and bool(re.fullmatch(r'\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:Z|[+-]\d{2}:\d{2})', full['cutoff'])),
                'exact dated cutoff with timezone required')
        cutoff = datetime.fromisoformat(full['cutoff'].replace('Z', '+00:00'))
        require(cutoff.tzinfo is not None, 'cutoff timezone missing')
        root = row.get('href', '')
        document = full['document']
        require(isinstance(root, str) and bool(re.fullmatch(r'(?:research|market-understanding)/[a-z0-9][a-z0-9-]*/', root)),
                'owned public edition folder required')
        require(isinstance(document, str) and document.startswith(root) and
                bool(re.fullmatch(r'(?:research|market-understanding)/[a-z0-9][a-z0-9-]*/[A-Za-z0-9_.-]+\.(?:html|pdf)', document)) and '..' not in document,
                'public owned HTML/PDF path required')
        require(document == root+'index.html' or document in row.get('assets', []), 'document not registered')
        require(isinstance(full['sha256'], str) and bool(re.fullmatch('[a-f0-9]{64}', full['sha256'])), 'document hash required')
        path = Path(site)/document
        require(path.is_file() and path.resolve().is_relative_to(Path(site).resolve()), 'document missing or outside site')
        require(hashlib.sha256(path.read_bytes()).hexdigest() == full['sha256'], 'document hash mismatch')
        verified.append(row)
    return verified
# Explicit public relationships; never inferred from similar titles.
CARD_REVISIONS = {
 'research-cpf-life-yield-2026-11-05':'research-cpf-life-explained-2026-11-06-v2',
 'research-pimco-income-bonds-2026-11-06':'pending-pimco-v2',
 'research-snb-mas-policy-2026-11-05':'pending-snb-mas-v2',
 'market-understanding-howard-marks-2026-11-05':'market-understanding-howard-marks-2026-11-06-v2',
 'market-understanding-mas-snb-2026-11-05':'pending-mas-snb-v2',
 'market-understanding-creditworthiness-2026-11-05':'market-understanding-creditworthiness-2026-11-06-v2',
 'market-understanding-spx-floor-cap-2026-11-05':'market-understanding-spx-collars-2026-11-06',
 'market-understanding-ai-tech-2026-11-05':'pending-ai-tech-v2',
}
CARD_BRIEFS = {
 'research-xau-gold-outlook-2026-11-06-v2':'research-gold-xau-v2-one-pager-2026-11-14',
 'research-diversification-made-simple-2026-11-06':'research-diversification-one-pager-2026-11-14',
 'pending-pimco-v2':'research-pimco-public-companion-2026-11-14',
 'market-understanding-spx-collars-2026-11-06':'research-spx-collar-public-companion-2026-11-14',
 'pending-mas-snb-v2':'research-mas-snb-one-page-2026-11-14',
 'research-cpf-oa-temasek-2070-2026-11-04':'research-cpf-temasek-two-page-2026-11-14',
 'research-bis-ai-financing-loop-2026-11-13':'research/bis-ai-financing-loop-2026-11-13/AI_Circular_Financing_One_Pager_2026-11-13.pdf',
}
# Explicit archived readings/companion formats, still present in My research.
CARD_ARCHIVE = set(CARD_REVISIONS) | {
 'research-xau-gold-outlook-2026-11-06',
 'pending-gold-v2-pdf','pending-spx-pdf','pending-cpf-source-pdf','pending-wealth-source-pdf',
 'global-credit-public-2026-11-07',
 'research-ocbc-home-loans-2026-11-13','research-ocbc-premier-welcome-2026-11-13',
} | {v for v in CARD_BRIEFS.values() if '/' not in v}

def main_research_cards(page, register, standard, site=SITE):
    """Server-render public cards, preserving groups, anchors and earlier links.

    Full-report and brief anchors work without JavaScript or a runtime register.
    """
    from urllib.parse import urljoin, urlsplit
    rows={x['id']:x for x in register['entries'] if x['state']=='published'}
    tags={x['id']:x for x in standard['tags']}
    by_href={x['href']:x for x in rows.values()}
    seen=set();brief_urls=set();brief_images={}
    page=re.sub(r'<!-- main-research-cards:start -->.*?<!-- main-research-cards:end -->','',page,flags=re.S)
    def local(href):
        u=urlsplit(urljoin('https://hub.invalid/market-understanding/',html.unescape(href)))
        return u.path.lstrip('/') if u.netloc=='hub.invalid' else None
    def public_path(path):
        return isinstance(path,str) and bool(re.fullmatch(r'(?:research|market-understanding)/[A-Za-z0-9_./-]+',path)) and '..' not in path and (Path(site)/path).exists()
    def render(row,attrs='',prior=()):
        if row['id'] in seen:raise ValueError('Duplicate main card: '+row['id'])
        seen.add(row['id'])
        if not public_path(row['href']):raise ValueError('Invalid main card path')
        chips=[]
        for key in row['tags']:
            tag=tags[key]
            values=[tag[k] for k in ['text','background','dark_text','dark_background']]
            if not all(re.fullmatch('#[A-Fa-f0-9]{6}',v) for v in values):raise ValueError('Invalid semantic palette')
            style=';'.join(k+':'+v for k,v in zip(['--tag-text','--tag-bg','--tag-dark-text','--tag-dark-bg'],values))
            chips.append('<span class="mu-card-tag" style="'+style+'">'+esc(tag['label'])+'</span>')
        date=datetime.fromisoformat(row['date']).strftime('%d %b %Y').lstrip('0')
        target=row['href'].removeprefix('market-understanding/') if row['href'].startswith('market-understanding/') else '../'+row['href']
        body='<p class="mu-eyebrow"><time datetime="'+esc(row['date'])+'">'+date+'</time> · '+esc(row['edition'])+'</p><h3>'+esc(row['title'])+'</h3><p>'+esc(row['summary'])+'</p>'
        if row['id']=='pending-ai-tech-v2':body+='<p class="mu-note">My thoughts · dated research interpretation.</p>'
        body+='<div class="mu-card-tags">'+''.join(chips)+'</div><div class="mu-card-actions"><a href="'+esc(target)+'">Read full report →</a>'
        brief=CARD_BRIEFS.get(row['id'])
        if brief:
            if brief in rows:
                b=rows[brief];brief=b['href'];label=b['title']
            elif brief.endswith('.pdf') and brief in row['assets']:
                label=row['title']+' · one-page PDF brief'
            else:raise ValueError('Unpublished or unregistered brief pairing')
            if not public_path(brief):raise ValueError('Missing brief artifact')
            brief_urls.add('../'+brief)
            if row['id']=='research-bis-ai-financing-loop-2026-11-13':
                image='research/bis-ai-financing-loop-2026-11-13/AI_Circular_Financing_One_Pager_2026-11-13.png'
                if image not in row['assets'] or not public_path(image):raise ValueError('Missing registered BIS brief preview')
                brief_images['../'+brief]='../'+image
            body+='<button type="button" class="mu-quick-read" hidden data-quick-read="../'+esc(brief)+'" data-brief-title="'+esc(label)+'">Quick read</button><a class="mu-open-brief" href="../'+esc(brief)+'" target="_blank" rel="noopener">Open brief'+(' PDF' if brief.endswith('.pdf') else '')+' ↗</a>'
        body+='</div>'
        links=[];used={row['href'],brief}
        for href,label in prior:
            normalized=urlsplit(urljoin('https://hub.invalid/market-understanding/',html.unescape(href)))
            identity=normalized.path.lstrip('/')+('?' + normalized.query if normalized.query else '')+('#'+normalized.fragment if normalized.fragment else '')
            if identity in used:continue
            used.add(identity);links.append('<a href="'+esc(html.unescape(href))+'">'+label+'</a>')
        if links:body+='<details class="mu-card-previous"><summary>Earlier edition &amp; downloads</summary>'+''.join(links)+'</details>'
        return '<article class="mu-writeup"'+attrs+' data-main-research="'+esc(row['id'])+'">'+body+'</article>'
    def replace(match):
        attrs,body=match.groups()
        links=re.findall(r'<a\b[^>]*href="([^"]+)"[^>]*>(.*?)</a>',body,re.S)
        primary=next((by_href[local(h)] for h,_ in links if local(h) in by_href),None)
        if not primary:return match.group()
        primary=rows[CARD_REVISIONS.get(primary['id'],primary['id'])]
        attrs=re.sub(r' data-main-research="[^"]+"','',attrs)
        return render(primary,attrs,links)
    # Rewrite only existing removable card inserts. All explainer chapters survive.
    for marker in ['publication-audit-20261106','research-readings','published-writeups']:
        pattern=r'(<!-- '+marker+r':start -->)(.*?)(<!-- '+marker+r':end -->)'
        page=re.sub(pattern,lambda m:m[1]+re.sub(r'<article class="mu-writeup"([^>]*)>(.*?)</article>',replace,m[2],flags=re.S)+m[3],page,flags=re.S)
    remaining=sorted((x for x in rows.values() if x['id'] not in seen|CARD_ARCHIVE),key=lambda x:(x['date'],x['id']),reverse=True)
    cards=''.join(render(row) for row in remaining)
    block='<section class="mu-writeups" id="main-published-research" aria-labelledby="main-research-title"><div class="mu-writeups-heading"><div><p class="mu-eyebrow">Published full articles</p><h2 id="main-research-title">Research to read in full</h2><p>Each card opens its dated public report. A Quick read is available only when a matching published brief exists. Earlier editions and all companion formats remain in My research.</p></div><a href="#my-research">Search all editions ↓</a></div><div id="automated-research" hidden><div class="rf-controls"><label for="research-feed-query">Search new editions</label><input id="research-feed-query" type="search" placeholder="Title, topic or date"><button type="button" data-feed-refresh>Refresh editions</button><a href="../research-feed.html">All new editions ↗</a></div><p data-feed-status role="status"></p><div class="mu-writeups-grid" data-feed-cards></div></div><noscript><p><a href="../research-feed.html">Read new verified research editions →</a></p></noscript><div class="mu-writeups-grid">'+cards+'</div></section>'
    script=r'''
<dialog id="research-quick-read" class="mu-brief-dialog" aria-labelledby="research-brief-title"><div class="mu-brief-bar"><h2 id="research-brief-title">Quick read</h2><button type="button" data-close-brief>Close quick read</button></div><p><a data-open-brief target="_blank" rel="noopener">Open brief in a new tab ↗</a></p><p data-brief-help></p><div data-brief-content></div></dialog>
<script type="module" id="research-quick-read-script">(()=>{'use strict';const allowed=__BRIEF_URLS__,dialog=document.getElementById('research-quick-read');if(!dialog||typeof dialog.showModal!=='function')return;const content=dialog.querySelector('[data-brief-content]'),link=dialog.querySelector('[data-open-brief]'),title=dialog.querySelector('h2'),help=dialog.querySelector('[data-brief-help]');let opener;document.querySelectorAll('[data-quick-read]').forEach(button=>{if(!allowed.includes(button.dataset.quickRead))return;button.hidden=false;button.addEventListener('click',()=>{const path=button.dataset.quickRead;if(!allowed.includes(path))return;opener=button;title.textContent=button.dataset.briefTitle;link.href=path;content.replaceChildren();const pdf=path.endsWith('.pdf');help.textContent=pdf?'This is the matching published PDF brief. If the viewer is unavailable, use Open brief above.':'The exact matching published brief appears below. Open brief provides a separate reading window.';if(!(pdf&&matchMedia('(max-width:620px)').matches)){const frame=document.createElement('iframe');frame.title=button.dataset.briefTitle;frame.src=path;frame.addEventListener('load',()=>{try{frame.contentDocument.addEventListener('keydown',event=>{if(event.key==='Escape'){event.preventDefault();event.stopPropagation();dialog.close();}},true);}catch{}});content.append(frame);}dialog.showModal();dialog.querySelector('[data-close-brief]').focus();});});dialog.querySelector('[data-close-brief]').addEventListener('click',()=>dialog.close());dialog.addEventListener('close',()=>{if(dialog.open)return;content.replaceChildren();opener?.focus();});})();</script>
'''
    script=script.replace('const allowed=__BRIEF_URLS__,dialog=', 'const images=__BRIEF_IMAGES__,allowed=__BRIEF_URLS__,dialog=')
    script=script.replace("if(!(pdf&&matchMedia('(max-width:620px)').matches)){","if(pdf&&images[path]&&matchMedia('(max-width:620px)').matches){const image=document.createElement('img');image.src=images[path];image.alt='One-page preview of the 13 November AI financing brief. Open brief PDF for the original document.';content.append(image);}else if(!(pdf&&matchMedia('(max-width:620px)').matches)){")
    script=script.replace('__BRIEF_URLS__',json.dumps(sorted(brief_urls),ensure_ascii=True)).replace('__BRIEF_IMAGES__',json.dumps(brief_images,ensure_ascii=True))
    new='<!-- main-research-cards:start --><link rel="stylesheet" href="market-understanding.css?v=20261114.cards1">'+block+script+'<!-- main-research-cards:end -->'
    icon='<!-- research-favicon --><link rel="icon" href="../favicon.ico" sizes="32x32">'
    if '<!-- research-favicon -->' not in page:page=page.replace('</head>',icon+'</head>',1)
    return page.replace('<!-- publication-audit-20261106:start -->','<!-- publication-audit-20261106:start -->'+new,1)


def money(v, digits=0): return f'{v:,.{digits}f}'
def table(caption, headers, rows):
    return '<details class="ra-data" open><summary>Read the values and calculation</summary><p class="ra-note">On a small screen, swipe the table horizontally. Keyboard: focus the table, then use the arrow keys.</p><div class="ra-table" tabindex="0" role="region" aria-label="'+esc(caption)+'"><table><caption>'+esc(caption)+'</caption><thead><tr>'+''.join('<th scope="col">'+esc(x)+'</th>' for x in headers)+'</tr></thead><tbody>'+''.join('<tr>'+''.join(('<th scope="row">' if i==0 else '<td>')+esc(c)+('</th>' if i==0 else '</td>') for i,c in enumerate(row))+'</tr>' for row in rows)+'</tbody></table></div></details>'
def bars(title, rows, maximum, unit, note):
    # Every datum has a visible label. Bars are decorative, with a real zero baseline.
    body=''
    for label, value, printed, alt in rows:
        width=D(str(value))/D(str(maximum))*100
        assert D(0)<=width<=D(100)
        body+='<div class="ra-bar-row"><div class="ra-bar-label">'+esc(label)+'</div><div class="ra-bar-line"><span class="ra-track" aria-hidden="true"><span class="ra-fill'+(' ra-alt' if alt else '')+'" data-ra-value="'+esc(value)+'" data-ra-max="'+esc(maximum)+'" style="width:'+f'{width:.8f}'+'%"></span></span><strong>'+esc(printed)+'</strong></div></div>'
    return '<figure class="ra-chart"><figcaption>'+esc(title)+'</figcaption><p class="ra-note">'+esc(unit)+'</p>'+body+'<div class="ra-axis" aria-hidden="true"><span>0</span><span>'+esc(maximum)+'</span></div><p class="ra-note">'+note+'</p></figure>'
def appendix(title, body, note):
    return START+'\n<aside class="research-addon" id="research-additions" aria-labelledby="research-additions-title"><div class="ra-kicker">Added visual companion · 4 November 2026</div><h2 id="research-additions-title">'+title+'</h2><p class="ra-intro">The original report above is retained. This differently coloured section adds charts and tables; it does not update the date or status of the underlying evidence.</p>'+body+'<p class="ra-source">'+note+'</p><p><a class="ra-back" href="#research-additions-jump">↑ Back to the report</a></p></aside>\n'+END

def make():
 out={}
 # Alphabet: published quarterly cash-flow reconciliation, millions divided by 1,000.
 quarters=[('Q4 2025',D('52.402'),D('27.851')),('Q1 2026',D('45.790'),D('35.674')),('Q2 2026',D('39.069'),D('44.924')),('Q3 2026',D('42.290'),D('51.355'))]
 rows=[]
 for q,o,c in quarters: rows += [(q+' · operating cash',o,f'{o:.3f}',False),(q+' · capital expenditure',c,f'{c:.3f}',True)]
 body='<p>Capital expenditure overtook operating cash flow in Q2 2026. Showing four quarters distinguishes the Q3 cash gap from a single isolated observation.</p>'
 body+=bars('When investment spending outgrew cash generation',rows,60,'USD billions · each bar starts at zero','Teal: operating cash flow. Purple: capital expenditure, shown as a positive spending magnitude. The table subtracts spending to calculate free cash flow.')
 body+=table('Alphabet cash-flow reconciliation · unaudited · USD billions',['Quarter','Operating cash flow','Capital expenditure','Free cash flow: OCF − capex','Capex / OCF'],[(q,f'{o:.3f}',f'{c:.3f}',f'{o-c:.3f}',f'{c/o*100:.1f}%') for q,o,c in quarters])
 body+='<p class="ra-note">Free cash flow is a non-GAAP measure. Capex / OCF is author arithmetic, rounded to one decimal place. This chart does not establish investment returns or an issuer financing need by itself.</p>'
 out['research/googl/index.html']=appendix('Cash generation across four quarters',body,'Source: <a href="https://www.sec.gov/Archives/edgar/data/1652044/000165204426000080/googexhibit991q32026.htm">Alphabet SEC earnings release, 28 October 2026, free-cash-flow reconciliation</a>. Source values checked 4 November 2026. Original chart, not a copied publisher image.')
 # Wealth: reuse published cash example and explicitly derive stress scenarios.
 body='<p class="ra-caution"><strong>New chapter:</strong> <a href="sharpe.html">Sharpe, portfolios and leverage</a>. Read the 14-part addition, original hypothetical charts, funding-cost algebra and primary research links.</p><p>Two separate tests matter: how much coupon cash remains after interest, and whether the collateral still supports the loan.</p>'
 cash=[('No financing',D(37500)),('Financing cost 2.50%',D(81250)),('Financing cost 4.50%',D(46250))]
 body+=bars('Net annual coupon cash after financing',[(a,b,'$'+money(b),i==2) for i,(a,b) in enumerate(cash)],100000,'$ per year · currency not specified by the source','Published hypothetical example, not current rates or a client offer. Same own capital of $750,000; financed gross investment $2,500,000. Coupon cash is not total return.')
 body+=table('Published financing illustration and exact cash arithmetic',['Case','Annual coupon','Loan interest','Net coupon cash'],[['No financing','$37,500','$0','$37,500'],['2.50% loan cost','$125,000','$43,750','$81,250'],['4.50% loan cost','$125,000','$78,750','$46,250']])
 stress=[]
 for fall in [0,5,10,20]:
  value=D(2500000)*(1-D(fall)/100);shortfall=D(1750000)-D('.7')*value
  stress.append((fall,value,D(1750000)/value*100,shortfall))
 body+=bars('A loan at maximum capacity has no initial buffer',[(f'{p}% collateral price decline',s,'$'+money(s),p>0) for p,v,ltv,s in stress],350000,'Collateral shortfall in $ · separate scenario, not predicted loss','Simplified stress: $1,750,000 loan stays unchanged; advance ratio stays at 70%; collateral alone falls. Positive bars are required extra lending value or loan reduction, not additional investment losses.')
 body+=table('Author stress calculation · same unnamed $ currency',['Collateral decline','Collateral value','Actual LTV','Shortfall: loan − 70% × collateral'],[[f'{p}%','$'+money(v),f'{ltv:.2f}%','$'+money(s)] for p,v,ltv,s in stress])
 body+='<p class="ra-note">This is not a recommended borrowing level. LTV is rounded to two decimals. Real facilities also reflect currency moves, fees, accrued interest, asset-specific limits and lender discretion. A 2-percentage-point funding increase cuts the illustrated net coupon by exactly $35,000 annually.</p>'
 out['research/wealth-inequality-2026-11-04/index.html']=appendix('Cash income and collateral are different ledgers',body,'Source: <a href="https://www.ocbc.com/premier-banking/our-solutions/financing/wealth-financing">OCBC Wealth Financing illustration</a>, checked 4 November 2026; <a href="#section-7">original cash-income discussion</a> and <a href="#section-8">collateral equations</a>. Stress rows are author calculations, not bank quotations. No publisher images reproduced.')
 # CPF OA: same exact saved scenario inputs, two distinct outcome measures.
 data=json.loads((SITE/'research/cpf-oa-temasek-2070-2026-11-04/scenarios.json').read_text())
 fxrows=[r for r in data['main_practical_case']['constant_fx_rows'] if D(r['usd_sgd']) in [D('1.2'),D('1.275'),D('1.35')]]
 fxrows.sort(key=lambda r:D(r['usd_sgd']))
 b=[];tr=[]
 for r in fxrows:
  fx=D(r['usd_sgd']);coupon=D(r['annual_coupon_sgd']);estate=D(r['ending_estate_sgd_if_all_coupons_spent'])
  b.extend([(f'USD/SGD {fx} · bond coupon',coupon,'S$'+money(coupon,2),False),(f'USD/SGD {fx} · OA illustration',D(5000),'S$5,000.00',True)])
  tr.append([str(fx),'S$'+money(coupon,2),'S$5,000.00','S$'+money(estate,2)])
 body='<p>Read annual spendable cash separately from the capital remaining at redemption. These are selected constant-FX cases already included in the original exact scenario file.</p>'
 body+=bars('Annual cash income at three constant exchange rates',b,11000,'SGD per year · all bars share one zero-based scale','Bond: US$7,800 annual coupon × scenario USD/SGD. OA: S$200,000 × assumed constant 2.5% base rate, with interest spent. Extra interest is excluded; neither future FX nor future OA rates are guaranteed.')
 body+=table('Selected saved scenarios · entry budget S$200,000',['Constant USD/SGD','Annual bond coupons','Annual OA interest','Bond terminal estate if all coupons spent'],tr)
 body+='<p class="ra-note">Bond case: US$312,000 face, clean price 50, entry FX 1.275, S$199,728.75 dirty cost and S$271.25 residual cash before unknown fees. Terminal estate = US$312,000 × terminal FX + S$271.25, conditional on repayment. It is not the sale value before redemption. Coupons already spent are not added to estate. Coupon FX and terminal FX can differ in reality.</p>'
 out['research/cpf-oa-temasek-2070-2026-11-04/index.html']=appendix('A phone-friendly view of income and estate',body,'Source: the original <a href="scenarios.json">exact scenario data</a>, <a href="#math">method and boundaries</a>, and <a href="#fx-heatmap">separate coupon/terminal FX cases</a>. The original article retains issuer and CPF references. These are conditional scenarios, not a price quote, forecast or recommendation.')
 # CPF LIFE: static teaching snapshot of the existing deterministic model, not linked to live controls.
 program="const M=require(process.argv[1]);console.log(JSON.stringify([75,85,90,95,100].map(age=>{const r=M.run(M.defaults,age);return{age,target:r.cumCPF,paid:r.cumPortfolio,gap:r.cumCPF-r.cumPortfolio,estate:r.portfolio};})));"
 life=json.loads(subprocess.check_output(['node','-e',program,str(SITE/'research/cpf-life-after-55-2026-11-04/model.js')],text=True))
 body='<div class="ra-caution"><strong>Fixed default illustration, not a CPF or insurer quotation.</strong> This appendix does not change when the calculator above changes. <a href="#calculator">Open the interactive calculator</a> to explore different inputs.</div><p>At the default settings, the portfolio first misses part of a payment at age 89. An assumed investment return can still be earned while later spending goes unfunded.</p>'
 body+=bars('Cumulative portfolio spending gap by death-scenario age',[(f'Age {r["age"]}',r['gap'],'S$'+money(r['gap']),True) for r in life],90000,'SGD · target lifetime payments minus actual portfolio withdrawals','Zero means the target payments were met up to that scenario age, not that future payments are assured. Values rounded to the nearest dollar; calculations use unrounded monthly cash flows.')
 body+=table('Fixed default monthly model · rounded SGD',['Death age','Target income received','Portfolio withdrawals','Unfunded amount','Portfolio estate'],[[r['age'],money(r['target']),money(r['paid']),money(r['gap']),money(r['estate'])] for r in life])
 body+='<p class="ra-note">Defaults: S$100,000 at 60; income starts at 65; S$650/month, no escalation; 4% annual accumulation and constant 4% net portfolio return. Death occurs immediately before that birthday’s payment. No volatility, fees beyond net-return input, tax relief, matching grant or currency change is modelled. Estate is separate from spent income. This is not a probability of running out.</p>'
 out['research/cpf-life-after-55-2026-11-04/index.html']=appendix('Can the portfolio meet the whole income target?',body,'Source: the original <a href="model.js">open calculation model</a> and <a href="#calculator">published methodology</a>. The original policy comparison and official sources above are unchanged. There is no invented IFI payout or XIRR.')
 # Market understanding: independently derived arithmetic, no licensed publisher chart reproduction.
 fx=[(p,(D('1.056')*(1-D(p)/100)-1)*100) for p in range(6)]
 body='<p>A 5.60% USD investment return becomes a different SGD return when each USD converts into fewer SGD. The two effects multiply.</p>'
 body+=bars('The same USD return under different FX assumptions',[(f'USD weakens {p}% versus SGD',v,f'{v.normalize()}%',p>=3) for p,v in fx],6,'Converted SGD return (%) · illustrative matched-period arithmetic','Formula: (1 + 0.056) × (1 − assumed USD weakening) − 1. The bars show calculated scenarios, not forecasts by GIC, MAS or any bank.')
 body+=table('Exact conversion calculation · no intermediate external cash flows',['Assumed USD weakening','USD return assumption','Converted SGD return'],[[f'{p}%','5.60%',f'{v.normalize()}%'] for p,v in fx])
 body+='<p class="ra-note">The original report’s 5.6% is a historical annualised USD return used only as a teaching input here. It is not a forecast of the next period, GIC’s net USD exposure or an actual bond-cashflow projection. FX means SGD received for one USD, with matched measurement periods and no hedging, fees or intermediate external flows.</p>'
 out['market-understanding/index.html']=appendix('See the currency arithmetic at a glance',body,'Basis: the existing <a href="#mu-fx-return">currency chapter, assumptions and source links</a>. This is an original arithmetic visualization. No licensed publisher slide, screenshot or underlying proprietary dataset is republished.')
 return out

def strip_additions(text):
 text=re.sub(r'<!-- automated-research:assets -->.*?<!-- automated-research:assets-end -->','',text,flags=re.S)
 text=re.sub(r'<!-- research-favicon --><link[^>]+>','',text)
 text=re.sub(r'<!-- research-shortcuts:start -->.*?<!-- research-shortcuts:end -->','',text,flags=re.S)
 text=re.sub(r'<!-- my-research-register:start -->.*?<!-- my-research-register:end -->','',text,flags=re.S)
 text=re.sub(r'<!-- my-research-register:style --><link[^>]+>','',text)
 text=re.sub(r'<!-- my-research-register:script --><script[^>]+></script>','',text)
 text=re.sub(r'<!-- publication-audit-20261106:start -->.*?<!-- publication-audit-20261106:end -->\n?','',text,flags=re.S)
 text=re.sub(r'<!-- company-research-nav:start -->.*?<!-- company-research-nav:end -->','',text,flags=re.S)
 text=re.sub(r'<!-- research-presentations:start -->.*?<!-- research-presentations:end -->','',text,flags=re.S)
 text=re.sub(r'<!-- research-readings:start -->.*?<!-- research-readings:end -->','',text,flags=re.S)
 text=re.sub(r'<!-- published-writeups:start -->.*?<!-- published-writeups:end -->','',text,flags=re.S)
 text=re.sub(r'<!-- published-writeups:style --><link[^>]+>','',text)
 text=re.sub(re.escape(START)+r'.*?'+re.escape(END),'',text,flags=re.S)
 text=re.sub(re.escape(ASSET)+r'<link[^>]+>','',text)
 text=re.sub(re.escape(JUMP)+r'<div.*?</div>','',text,flags=re.S)
 return original_copy(text)

def main():
 register_path=SITE/'data/research-register.json'
 if register_path.exists():validate_full_editions(json.loads(register_path.read_text()),SITE)
 manifest_path=ROOT/'scripts/report_additions_manifest.json'
 manifest=json.loads(manifest_path.read_text()) if manifest_path.exists() else {'baseline_commit':'44af7a59a721021b2ecb56048fb06a3c98e1ff37','reports':{}}
 for path, content in make().items():
  p=SITE/path; current=p.read_text(); original=strip_additions(current)
  digest=hashlib.sha256(original.encode()).hexdigest()
  if path in manifest['reports'] and manifest['reports'][path]!=digest: raise ValueError('Original report changed; reconcile deliberately: '+path)
  manifest['reports'][path]=digest
  prefix='../' if path.startswith('market-understanding/') else '../../'
  output=original.replace('</head>',ASSET+'<link rel="stylesheet" href="'+prefix+'research-additions.css?v=20261104.1"></head>',1)
  jump=JUMP+'<div class="ra-jump" id="research-additions-jump"><a href="#research-additions">New visual companion: charts &amp; exact-value tables ↓</a><span>Added 4 November 2026 · original report retained</span></div>'
  if path=='research/googl/index.html': jump='<!-- company-research-nav:start --><nav class="notice" aria-label="Company research navigation"><strong>Equity research</strong> · <a href="../../v4.html#calls">Back to Calls &amp; full reports</a><br><a href="../tsm-2026-11-05/">TSMC (TSM) research</a> · <a href="../nvda-2026-11-05/">NVIDIA (NVDA) research</a></nav><!-- company-research-nav:end -->'+jump
  output=re.sub(r'(<main\b[^>]*>)',lambda m:m[0]+jump,output,count=1)
  output=output.replace('</main>',content+'</main>',1)
  output=correct_copy(output)
  assert strip_additions(output)==original
  publications=re.search(r'<!-- publication-audit-20261106:start -->.*?<!-- publication-audit-20261106:end -->',current,re.S)
  writeups=re.search(r'<!-- published-writeups:start -->.*?<!-- published-writeups:end -->',current,re.S)
  readings=re.search(r'<!-- research-readings:start -->.*?<!-- research-readings:end -->',current,re.S)
  style=re.search(r'<!-- published-writeups:style --><link[^>]+>',current)
  presentations=re.search(r'<!-- research-presentations:start -->.*?<!-- research-presentations:end -->',current,re.S)
  if writeups:output=output.replace('</header>','</header>'+writeups.group(),1)
  if readings:output=output.replace('</header>','</header>'+readings.group(),1)
  if publications:output=output.replace('</header>','</header>'+publications.group()+'\n',1)
  if style:output=output.replace('</head>',style.group()+'</head>',1)
  if presentations:output=output.replace('</header>','</header>'+presentations.group(),1)
  register=re.search(r'<!-- my-research-register:start -->.*?<!-- my-research-register:end -->',current,re.S)
  register_style=re.search(r'<!-- my-research-register:style --><link[^>]+>',current)
  register_script=re.search(r'<!-- my-research-register:script --><script[^>]+></script>',current)
  if register:output=output.replace('<section class="mu-summary">',register.group()+'<section class="mu-summary">',1)
  shortcuts=re.search(r'<!-- research-shortcuts:start -->.*?<!-- research-shortcuts:end -->',current,re.S)
  if shortcuts:output=output.replace('</header>','</header>'+shortcuts.group(),1)
  if register_style:output=output.replace('</head>',register_style.group()+'</head>',1)
  if register_script:output=output.replace('</body>',register_script.group()+'</body>',1)
  feed_assets=re.search(r'<!-- automated-research:assets -->.*?<!-- automated-research:assets-end -->',current,re.S)
  if feed_assets:output=output.replace('<!-- my-research-register:script -->',feed_assets.group()+'<!-- my-research-register:script -->',1)
  if path=='market-understanding/index.html' and register_path.exists():
   output=main_research_cards(output,json.loads(register_path.read_text()),json.loads((SITE/'data/external-source-standard.json').read_text()),SITE)
  p.write_text(output)
 manifest_path.write_text(json.dumps(manifest,indent=2)+'\n')
 print('Built 5 additive report companions; original content retained apart from listed presentation-copy corrections.')
if __name__=='__main__': main()
