#!/usr/bin/env python3
"""Build original, additive visual appendices from explicit dated facts/scenarios.
No network calls, publisher images, personal data or new calculation assumptions
are hidden in this build. Original report bytes survive removal of our markers.
"""
from pathlib import Path
from decimal import Decimal as D
import hashlib, html, json, re, subprocess
ROOT = Path(__file__).resolve().parents[1]
SITE = ROOT / 'site'
START = '<!-- research-additions:start -->'
END = '<!-- research-additions:end -->'
ASSET = '<!-- research-additions:style -->'
JUMP = '<!-- research-additions:jump -->'
def esc(v): return html.escape(str(v))
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
 text=re.sub(re.escape(START)+r'.*?'+re.escape(END),'',text,flags=re.S)
 text=re.sub(re.escape(ASSET)+r'<link[^>]+>','',text)
 text=re.sub(re.escape(JUMP)+r'<div.*?</div>','',text,flags=re.S)
 return text

def main():
 manifest_path=ROOT/'scripts/report_additions_manifest.json'
 manifest=json.loads(manifest_path.read_text()) if manifest_path.exists() else {'baseline_commit':'44af7a59a721021b2ecb56048fb06a3c98e1ff37','reports':{}}
 for path, content in make().items():
  p=SITE/path; original=strip_additions(p.read_text())
  digest=hashlib.sha256(original.encode()).hexdigest()
  if path in manifest['reports'] and manifest['reports'][path]!=digest: raise ValueError('Original report changed; reconcile deliberately: '+path)
  manifest['reports'][path]=digest
  prefix='../' if path.startswith('market-understanding/') else '../../'
  output=original.replace('</head>',ASSET+'<link rel="stylesheet" href="'+prefix+'research-additions.css?v=20261104.1"></head>',1)
  jump=JUMP+'<div class="ra-jump" id="research-additions-jump"><a href="#research-additions">New visual companion: charts &amp; exact-value tables ↓</a><span>Added 4 November 2026 · original report retained</span></div>'
  output=re.sub(r'(<main\b[^>]*>)',lambda m:m[0]+jump,output,count=1)
  output=output.replace('</main>',content+'</main>',1)
  assert strip_additions(output)==original
  p.write_text(output)
 manifest_path.write_text(json.dumps(manifest,indent=2)+'\n')
 print('Built 5 additive report companions; original report bytes retained.')
if __name__=='__main__': main()
