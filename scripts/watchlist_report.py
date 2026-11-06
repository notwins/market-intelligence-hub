"""Render an immutable, readable public report from an already validated edition."""
import hashlib, html
from pathlib import Path
from import_watchlist import validate, fail, public_url, write_json

def esc(value): return html.escape(str(value), quote=True)
def links(sources):
    return '<ul class="sources">'+''.join('<li><a rel="noopener noreferrer" href="'+esc(public_url(s['url']))+'">'+esc(s['title'])+'</a></li>' for s in sources)+'</ul>'
def percent(n): return ('+' if n>0 else '')+f'{n:.2f}%'
def money(n): return f'USD {n:,.2f}'
def change(n): return '<span class="move '+('up' if n>=0 else 'down')+'">'+('Up ' if n>0 else 'Down ' if n<0 else 'Flat ')+percent(n)+'</span>'

STYLE='''
:root{color-scheme:light;--ink:#172b46;--muted:#50627a;--line:#d5dfec;--blue:#205ec0;--bg:#f0f4fa}*{box-sizing:border-box}html{scroll-behavior:smooth;scroll-padding-top:24px}body{margin:0;background:var(--bg);color:var(--ink);font:17px/1.7 system-ui,-apple-system,"Segoe UI",sans-serif}main{max-width:1150px;margin:auto;padding:35px 24px 70px}a{color:#1657b4;text-underline-offset:3px}a:focus-visible,button:focus-visible,[tabindex]:focus-visible{outline:3px solid #774dd0;outline-offset:4px}h1,h2,h3,h4{line-height:1.25;letter-spacing:-.02em;overflow-wrap:anywhere}h1{font-size:clamp(2rem,4vw,3rem);max-width:900px}h2{font-size:1.7rem}h3{font-size:1.35rem}p{margin:.5em 0 1em}.eyebrow{color:var(--blue);font-size:.8rem;letter-spacing:.12em;text-transform:uppercase;font-weight:800}.hero,.card{background:white;border:1px solid var(--line);border-radius:18px;padding:28px;margin:22px 0;overflow-wrap:anywhere}.hero{border-top:5px solid var(--blue)}.muted,small{color:var(--muted)}.badge{background:#eee8fc;color:#5b389a;border-radius:7px;padding:5px 10px;font-size:.85rem;display:inline-block;font-weight:700}.toc{display:flex;flex-wrap:wrap;gap:9px;margin:20px 0}.toc a{background:#fff;border:1px solid var(--line);border-radius:9px;padding:8px 13px;font-weight:700}.summary{border-left:4px solid var(--blue);background:#eaf1ff;border-radius:0 12px 12px 0;padding:18px 21px;margin:20px 0}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,260px),1fr));gap:14px}.metric{border:1px solid var(--line);border-radius:12px;padding:17px}.metric strong{display:block;font-size:1.65rem}.move{display:inline-block;padding:4px 9px;border-radius:7px;font-weight:750}.up{color:#116441;background:#e7f5ec}.down{color:#a32340;background:#fff0f2}.table-wrap{max-width:100%;overflow-x:auto;border:1px solid var(--line);border-radius:10px;margin:20px 0}table{width:100%;border-collapse:collapse;font-size:.9rem;white-space:nowrap}caption{text-align:left;white-space:normal;background:#f5f8fc;padding:12px}th,td{text-align:left;border-bottom:1px solid var(--line);padding:11px 13px;font-variant-numeric:tabular-nums}.research{margin:25px 0;border-top:1px solid var(--line);padding-top:18px}.analysis,.risk,.catalyst{padding:15px 18px;border-radius:10px;margin:13px 0}.analysis{background:#edf3ff;border-left:4px solid #3167aa}.risk{background:#fff2ef;border-left:4px solid #b54739}.catalyst{background:#f3edff;border-left:4px solid #7852b4}.sources{font-size:.9rem}.notice{border:1px solid #ddc17f;background:#fff8e6;padding:17px 20px;border-radius:12px}.report-id{font:12px/1.7 ui-monospace,monospace;overflow-wrap:anywhere}.company{scroll-margin-top:20px}.company header{display:flex;justify-content:space-between;gap:15px;align-items:flex-start;flex-wrap:wrap}.company h2{margin:0 0 8px}.company h4{margin-bottom:8px}.company li+li{margin-top:8px}.top-links{display:flex;gap:20px;flex-wrap:wrap}details summary{cursor:pointer;min-height:44px;font-weight:700;color:var(--blue)}details{margin-top:20px}footer{font-size:.9rem;color:var(--muted);border-top:1px solid var(--line);margin-top:35px;padding-top:20px}@media(max-width:600px){main{padding:15px 14px 45px}.hero,.card{padding:20px 17px;border-radius:14px}body{font-size:16px}.metric strong{font-size:1.4rem}}@media print{body{background:white}main{max-width:none;padding:0}.toc,.top-links{display:none}.card,.hero{box-shadow:none;break-inside:avoid;border-radius:0}.table-wrap{overflow:visible}a{color:inherit}.research{break-inside:avoid}}
'''

def render_report(edition, *, template_version=2):
    """New reports use neutral labels; v1 reproduces historical bytes for validation."""
    fail(template_version in (1, 2), 'Unknown report template version')
    report_label = 'Winston’s public watchlist' if template_version == 1 else 'Market Intel public watchlist'
    d=validate(edition)
    rows=''
    for r in d['rows']:
        p=r['price']; pre=r['premarket']
        research=''
        for item in r['research']:
            research+='<section class="research"><p class="eyebrow">'+esc(item['date'])+' · sourced research</p><h3>'+esc(item['headline'])+'</h3><h4>Reported facts</h4><ul>'+''.join('<li>'+esc(f)+'</li>' for f in item['facts'])+'</ul><div class="analysis"><b>Research analysis</b><p>'+esc(item['analysis'])+'</p></div><div class="risk"><b>Risks and countercase</b><p>'+esc(item['risks'])+'</p></div><div class="catalyst"><b>Next to watch</b><p>'+esc(item['next_watch'])+'</p></div>'+links(item['sources'])+'</section>'
        if not research: research='<p class="notice">No independently verified narrative development was included for this company in this edition. This does not establish that no news occurred.</p>'
        premarket=('<div class="metric"><small>Separate premarket observation</small><strong>'+money(pre['price'])+'</strong><p>'+percent(pre['change_pct'])+' versus the regular close</p><small>'+esc(pre['as_of'])+' · not live</small></div>') if pre else '<div class="metric"><b>Premarket</b><p>Not included in this edition.</p></div>'
        returns=''.join('<tr><th scope="row">'+str(q['months'])+' month'+('s' if q['months']!=1 else '')+'</th><td>'+esc(q['base_date'])+'</td><td>'+money(q['base_adjusted_close'])+'</td><td>'+percent(q['pct'])+'</td><td><a href="'+esc(public_url(q['source_url']))+'">Baseline source</a></td></tr>' for q in r['returns'])
        rows+='<article class="card company" id="'+esc(r['ticker'])+'"><header><div><p class="eyebrow">'+esc(r['group'])+'</p><h2>'+esc(r['ticker'])+' · '+esc(r['name'])+'</h2><p class="muted">'+esc(r['instrument'])+'</p></div><span class="badge">Watch only</span></header><div class="grid"><div class="metric"><small>Regular-session close</small><strong>'+money(p['close'])+'</strong>'+change(p['change_pct'])+'<p><small>'+esc(p['as_of'])+'</small></p></div>'+premarket+'</div><div class="table-wrap" tabindex="0" role="region" aria-label="'+esc(r['ticker'])+' return calculations"><table><caption>Six cumulative adjusted-close returns · endpoint '+esc(p['as_of'])+' · adjusted Close '+money(p['adjusted_close'])+'</caption><thead><tr><th scope="col">Horizon</th><th scope="col">Baseline date</th><th scope="col">Baseline</th><th scope="col">Return</th><th scope="col">Evidence</th></tr></thead><tbody>'+returns+'</tbody></table></div>'+research+'<details><summary>Company sources and coverage gaps</summary>'+links(r['sources'])+'<ul>'+''.join('<li>'+esc(g)+'</li>' for g in r['gaps'])+'</ul></details><p><a href="#top">Back to company list ↑</a></p></article>'
    return '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="description" content="Dated public watchlist research with prices, returns, risks and original sources."><title>'+esc(d['title'])+' · full research report</title><style>'+STYLE+'</style></head><body><main id="top"><div class="top-links"><a href="../../../v4.html#watchlist">Watchlist dashboard</a><a href="../../../v4.html#calls">Calls and full reports</a><a href="../archive/'+esc(d['id'])+'.json" download>Download original edition JSON</a></div><header class="hero"><p class="eyebrow">'+report_label+' · full saved research edition</p><h1>'+esc(d['title'])+'</h1><span class="badge">12 names · Watch only · not live</span><p><b>Research cutoff:</b> '+esc(d['as_of'])+'<br><b>Sources checked:</b> '+esc(d['verification']['sources_checked_at'])+'<br><b>Edition prepared:</b> '+esc(d['generated_at'])+'</p><div class="summary"><p>'+esc(d['summary'])+'</p><p>'+esc(d['coverage_note'])+'</p></div><p class="notice">This is a dated personal research report, not a live portfolio, transaction record or signal to copy trades. No buy call or executed holding is implied. A thesis does not establish a purchase. No private notes or restricted research screenshots are included.</p><nav class="toc" aria-label="Report companies">'+''.join('<a href="#'+esc(r['ticker'])+'">'+esc(r['ticker'])+'</a>' for r in d['rows'])+'</nav></header><section class="card"><h2>Read the dates and return basis</h2><p>'+esc(d['price_basis'])+'</p><p>'+esc(d['return_basis'])+'</p><ul>'+''.join('<li>'+esc(c)+'</li>' for c in d['caveats'])+'</ul><p class="muted">Facts, generated research analysis, risks and next catalysts are labelled separately. Report formatting adds no later evidence to the original edition. Source timestamps and coverage limits remain fixed.</p></section>'+rows+'<footer><p>Past returns do not predict future returns. Original source links may change or require subscriptions. Margin is not maximum loss; options may never be executed or may be closed without an update. This disclaimer does not establish employer or compliance suitability.</p><p class="report-id">Edition '+esc(d['id'])+' · Renderer version '+str(template_version)+'. This fixed report is retained with its original edition. Corrections use a new edition ID.</p></footer></main></body></html>\n'

def import_report(edition, root):
    d=validate(edition); folder=Path(root)/'data/watchlist'; report=folder/'reports'/(d['id']+'.html'); content=render_report(d).encode('utf-8')
    if report.exists():
        saved = report.read_bytes()
        if saved != content:
            # Compare the actual bytes to the exact previous renderer, then check
            # the original receipt below. Never strip or normalize archived HTML.
            import json
            receipt_path = folder/'report-index.json'
            receipts = json.loads(receipt_path.read_text(encoding='utf-8')) if receipt_path.exists() else {}
            receipt = next((r for r in receipts.get('reports', []) if r['edition_id'] == d['id']), None)
            fail(receipt is not None and saved == render_report(d, template_version=1).encode('utf-8'),
                 'Fixed report already exists with different content; retain it and use a new edition ID')
            content = saved
    else:
        report.parent.mkdir(parents=True,exist_ok=True);report.write_bytes(content)
    import json
    index=folder/'report-index.json';old=json.loads(index.read_text(encoding='utf-8')) if index.exists() else {'schema_version':1,'reports':[]}
    entry={'edition_id':d['id'],'as_of':d['as_of'],'path':'data/watchlist/reports/'+d['id']+'.html','sha256':hashlib.sha256(content).hexdigest()}
    existing=next((r for r in old['reports'] if r['edition_id']==d['id']),None)
    if existing: fail(existing==entry,'Report receipt conflict')
    else: old['reports'].append(entry)
    old['reports'].sort(key=lambda r:r['as_of'],reverse=True);write_json(index,old)
    return report
