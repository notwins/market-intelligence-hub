/* Optional A4 appendices. Private quarterly figures are rendered in the owner's browser. */
(function(root){'use strict';
const C=root.SIBetaCore||(typeof require==='function'?require('./si-beta2-core.js'):null);
const figures=root.FinancialDisplay||(typeof require==='function'?require('./financial-display.js'):null);
const currencyTools=root.SIStatementCurrency||(typeof require==='function'?require('./si-statement-currency.js'):null);
const E=C.escape,navy='#122b43',teal='#276976',muted='#526477',border='#d3dfe6';
const epsChoices=[
 ['Diluted EPS',/^(?:Diluted EPS|Diluted Earnings Per Share|Earnings Per Share.*Diluted.*)$/i],
 ['Normalized diluted EPS',/^Reported Normalized Diluted EPS$/i],
 ['Basic EPS',/^(?:Basic EPS|Basic Earnings Per Share|Earnings Per Share.*Basic.*)$/i],
 ['Normalized basic EPS',/^Reported Normalized Basic EPS$/i]
];
const choices={
 income:[
  ['Revenue',figures.revenue,true],['Gross profit',/^Gross Profit$/i],
  ['Operating income',/^(?:Total Operating Profit\/Loss|Operating Income)$/i],
  ['Net income',figures.netIncome,true]
 ],
 balance:[
  ['Cash & short-term investments',/^Cash, Cash Equivalents and Short Term Investments$/i,true],
  ['Total assets',/^Total Assets$/i],['Total liabilities',/^Total Liabilities$/i],
  ['Total equity',/^Total (?:Equity|Stockholders.? Equity)$/i,true],['Current assets',/^Total Current Assets$/i]
 ],
 cash:[
  ['Operating cash flow',/^Cash Flow from(?:\/Used in)? Operating Activities(?:, (?:Indirect|Direct))?$/i,true],
  ['Investing cash flow',/^Cash Flow from(?:\/Used in)? Investing Activities$/i],
  ['Financing cash flow',/^Cash Flow from(?:\/Used in)? Financing Activities$/i],
  ['Ending cash',/^Cash and Cash Equivalents, End of Period$/i],['Change in cash',/^Change in Cash$/i]
 ]
};
function fiscalQuarters(statements){
 let latest=-Infinity;
 for(const report of Object.values(statements||{})){
  report?.periods.forEach((label,index)=>{
   const quarter=figures.quarterIndex(label);
   if(Number.isFinite(quarter)&&report.rows.some(row=>Number.isFinite(row[2][index]))){
    latest=Math.max(latest,quarter);
   }
  });
 }
 return Number.isFinite(latest)?Array.from({length:12},(_,i)=>figures.quarterLabel(latest-11+i)):[];
}
// Reconcile the flow series with the annual report before treating a period as cumulative.
function periodLabels(report,annual,pattern,semiannual){
 const labels=new Map();
 if(!report)return labels;
 const series=report.rows.find(row=>pattern.test(row[1]))?.[2];
 const yearTotals=annual?.rows.find(row=>pattern.test(row[1]))?.[2];
 const years=new Set(report.periods.filter(label=>/^Q[1-4] /.test(label)).map(label=>label.slice(3)));
 const close=(left,right)=>Math.abs(left-right)<=Math.abs(right)*0.001;
 for(const year of years){
  if(semiannual){
   labels.set('Q2 '+year,'H1 '+year);
   labels.set('Q4 '+year,'H2 '+year);
   continue;
  }
  const [q1,q2,q3,q4]=[1,2,3,4].map(q=>series?.[report.periods.indexOf('Q'+q+' '+year)]);
  const yearTotal=yearTotals?.[annual.periods.indexOf(year)];
  if(![q1,q2,q3,q4,yearTotal].every(Number.isFinite)||yearTotal<=0||close(q1+q2+q3+q4,yearTotal))continue;
  if(close(q4,yearTotal))labels.set('Q4 '+year,'FY '+year);
  else if(q4>q3&&close(q1+q2+q4,yearTotal))labels.set('Q4 '+year,'H2 '+year);
  if(q2>q1&&close(q2+q3+q4,yearTotal))labels.set('Q2 '+year,'H1 '+year);
 }
 return labels;
}
function highlights(report,key,periods=fiscalQuarters({[key]:report}),{listingId,target,fx,annual}={}){
 if(!report||!periods.length)return null;
 const indices=periods.map(label=>report.periods.indexOf(label));
 const sourceCurrency=currencyTools.reportingCurrency(listingId,report);
 const rate=fx?.from===sourceCurrency&&fx.to===target?fx.rate:1;
 const translated=Number.isFinite(rate)&&rate>0&&fx?.from===sourceCurrency&&fx.to===target;
 const flow=key!=='balance';
 const semiannual=currencyTools.semiannualFlowPeriods.has(listingId);
 const displayedPeriods=flow?periodLabels(report,annual,key==='income'?figures.revenue:choices.cash[0][1],semiannual):new Map();
 if(listingId==='DBS SP'&&key==='income'){
  // DBS performance summaries identify these vendor Q4 totals as second-half income.
  const halfTotals={'Q4 2023':10199e6,'Q4 2024':11258e6,'Q4 2025':11263e6};
  const revenue=report.rows.find(row=>figures.revenue.test(row[1]))?.[2];
  for(const [period,total] of Object.entries(halfTotals)){
   if(revenue?.[report.periods.indexOf(period)]===total)displayedPeriods.set(period,'H2 '+period.slice(3));
  }
 }
 const comparable=!flow||!currencyTools.mixedFlowPeriods.has(listingId);
 const comparablePeriod=period=>!displayedPeriods.has(period)&&
  !displayedPeriods.has(figures.quarterLabel(figures.quarterIndex(period)-1));
 const find=pattern=>report.rows.find(row=>pattern.test(row[1])&&indices.some(index=>Number.isFinite(row[2][index])));
 const make=(label,series,{important=false,change=false,kind='amount',definition}={})=>{
  const raw=series||report.periods.map(()=>null);
  const values=indices.map(index=>Number.isFinite(raw[index])?raw[index]*(translated&&kind!=='ratio'?rate:1):null);
  const growth=change&&comparable?figures.quarterChanges(report.periods,raw):null;
  return {label,values,scale:kind==='amount'?figures.scaleFor(values):1,
   changes:change?indices.map(index=>comparablePeriod(report.periods[index])?(growth?.[index]??null):null):null,important,kind,definition};
 };
 const rows=choices[key].map(([label,pattern,important])=>{
  let match=find(pattern);
  if(!match&&label==='Cash & short-term investments'){
   label='Cash & equivalents';
   match=find(/^Cash (?:And|&) Cash Equivalents$/i);
  }
  return make(label,match?.[2],{important,change:['Revenue','Net income','Total equity'].includes(label)});
 });
 if(key==='income'){
  const revenue=find(figures.revenue),net=find(figures.netIncome);
  const margin=revenue?.[2].map((value,i)=>value>0&&Number.isFinite(net?.[2][i])?100*net[2][i]/value:null);
  const eps=epsChoices.map(([label,pattern])=>[label,find(pattern)]).find(([,row])=>row);
  const ebitda=find(/^EBITDA$/i)||find(/^Reported Normalized EBITDA$/i);
  rows.push(make('Net profit margin',margin,{kind:'ratio',important:true}),
   make(eps?.[0]||'Diluted EPS',eps?.[1]?.[2],{kind:'perShare',important:true,change:true}),
   make('EBITA',find(/^(?:EBITA|Earnings Before Interest, Taxes and Amortization)$/i)?.[2],{important:true}));
  if(ebitda)rows.push(make(ebitda[1].includes('Normalized')?'Normalized EBITDA':'EBITDA',ebitda[2]));
 }
 if(key==='cash'){
  const reported=find(/^Free Cash Flow(?:, Reported)?$/i);
  const operating=find(choices.cash[0][1]);
  const capex=find(/^(?:Capital Expenditures?(?:, Reported)?|Purchases? of Property, Plant and Equipment)$/i);
  const netPpe=find(/^Purchase\/Sale and Disposal of Property, Plant and Equipment, Net$/i);
  const derived=(spending,useNet)=>operating?.[2].map((value,i)=>{
   const cap=spending?.[2][i];
   return Number.isFinite(value)&&Number.isFinite(cap)?value+(useNet?cap:-Math.abs(cap)):null;
  });
  const capexFcf=derived(capex,false),netFcf=derived(netPpe,true);
  const useCapex=indices.some(index=>Number.isFinite(capexFcf?.[index]));
  const useNet=!reported&&!useCapex&&indices.some(index=>Number.isFinite(netFcf?.[index]));
  const fcf=reported?.[2]||(useCapex?capexFcf:useNet?netFcf:null);
  const definition=useNet?'Net PP&E cash flow includes disposals.':useCapex&&!reported?'Free cash flow = operating cash flow less reported capital spending.':null;
  rows.splice(1,0,make(useNet?'FCF (net PP&E)':'Free cash flow',fcf,{important:true,change:true,definition}));
 }
 return rows.some(row=>row.values.some(Number.isFinite))?{
  periods,displayedPeriods,rows,currency:translated?target:sourceCurrency,fiscalEnd:report.fiscalEnd,
  sourceCurrency,translation:translated?fx:null,fxMissing:!!target&&sourceCurrency!==target&&!translated,comparable
 }:null;
}
function ratings(record){
 return (record?.credit||[]).filter(r=>r.raw).map(r=>({...r,source:'Bloomberg supplied snapshot',
  date:r.asOf||null,display:r.raw+(r.status==='withdrawn'?' (withdrawn)':r.status==='not_rated'?' (not rated)':'')}));
}
function summary(rows){
 return ['S&P',"Moody's",'Fitch'].flatMap(agency=>{
  const entries=(rows||[]).filter(r=>r.agency===agency),r=entries.find(r=>/issuer/i.test(r.scope))||entries[0];
  return r?[{label:agency+' · '+(/local-currency/i.test(r.scope)?'LC issuer':/default/i.test(r.scope)?'issuer default':/issuer/i.test(r.scope)?'issuer':'senior debt'),value:r.display}]:[];
 });
}
function plan(pages,includeEquity,includeTerms=false){
 return pages.flatMap(page=>[{kind:'si',page},
  ...(includeEquity?page.shares.map(share=>({kind:'equity',page,share})):[]),
  ...(includeTerms?[{kind:'terms',page}]:[])]);
}
function paper(links=[]){
 const out=[],text=(x,y,value,size=12,color=navy,bold=false,anchor='start')=>out.push(`<text x="${x}" y="${y}" font-family="Arial, sans-serif" font-size="${size}" fill="${color}" font-weight="${bold?700:400}" text-anchor="${anchor}">${E(value)}</text>`),
 rect=(x,y,w,h,fill,stroke=border)=>out.push(`<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="4" fill="${fill}" stroke="${stroke}"/>`),
 line=(y)=>out.push(`<path d="M28 ${y}H772" stroke="${border}"/>`);
 const wrap=(value,max)=>String(value||'').trim().split(/\s+/).reduce((lines,word)=>{
  if(!lines.length||lines.at(-1).length+word.length+1>max)lines.push(word);else lines[lines.length-1]+=' '+word;return lines;
 },[]);
 const prose=(x,y,value,max,rows,size=12)=>{const lines=wrap(value,max);lines.slice(0,rows).forEach((s,i)=>text(x,y+i*(size+3),s+(i===rows-1&&lines.length>rows?'...':''),size,muted));};
 const fitted=(x,y,value,width,size=12,color=navy,bold=false,anchor='start')=>{
  text(x,y,value,size,color,bold,anchor);if(String(value).length*size*.56>width)out[out.length-1]=out.at(-1).replace('<text ',`<text textLength="${width}" lengthAdjust="spacingAndGlyphs" `);
 };
 const heading=(y,number,title)=>{rect(28,y-17,23,23,teal,teal);text(39.5,y,number,12,'#fff',true,'middle');text(61,y,title,14,navy,true);};
 const link=(x,y,label,url)=>{if(!/^https:\/\//.test(url||''))return;const width=Math.min(720,label.length*6);
  out.push(`<a href="${E(url)}" target="_blank" rel="noopener noreferrer">`);text(x,y,label,10,teal,true);out.push('</a>');
  links.push({left:x,top:y-11,right:x+width,bottom:y+3,url});};
 return {out,text,rect,line,prose,fitted,heading,link};
}
function svg(share,data={},page=2,total=2,{showWatermarks=true,links=[],source=''}={}){
 const {out,text,rect,line,prose,fitted,heading,link}=paper(links);
 const info=data.fundamentals,company=info?.company,brief=info?.research,credit=data.creditRatings||[],bosCredit=data.creditReports||[];
 out.push(`<svg xmlns="http://www.w3.org/2000/svg" width="${C.W}" height="${C.H}" viewBox="0 0 ${C.W} ${C.H}" role="img" aria-label="${E(share.symbol)} equity research and three financial statements">`);
 rect(0,0,C.W,C.H,'#fff','#fff');
 const logo=typeof data.logo==='string'&&/^data:image\/png;base64,[A-Za-z0-9+/]+=*$/.test(data.logo)?data.logo:'';
 if(showWatermarks&&logo)out.push(`<image class="si-equity-watermark" x="170" y="430" width="460" height="460" href="${logo}" opacity="0.045" preserveAspectRatio="xMidYMid meet"/>`);
 text(28,38,'FOR REFERENCE ONLY',17,navy,true);text(772,37,`MARKET INTEL / ${page} OF ${total}`,11,muted,true,'end');
 text(28,58,'Equity research and financial highlights. Historical information; estimates are not actual results.',10,muted);
 rect(28,75,744,35,navy,navy);text(42,98,'Company research & financials',18,'#fff',true);
 if(logo)out.push(`<image x="28" y="123" width="40" height="40" href="${logo}" preserveAspectRatio="xMidYMid meet"/>`);
 fitted(logo?80:28,143,share.name||data.name||share.symbol,logo?565:620,19,navy,true);
 text(772,143,share.symbol,14,teal,true,'end');text(28,180,source?`Underlying of ${source}`:'SI underlying',10,teal,true);
 prose(28,198,share.description||data.description||'Company description unavailable.',112,2,11);
 heading(233,'1','Equity research');
 const research=data.metrics,call=research?.rating||brief?.rating||'Unavailable',provider=research?.researchProvider||brief?.provider||'BOS research';
 const currentTarget=Number.isFinite(research?.fairValueOrTargetPrice)?research:null;
 text(28,254,`${provider} · Analyst view: ${call}${data.metricsDate?' · '+data.metricsDate:brief?.date?' · '+brief.date:''}`,12,navy,true);
 const target=currentTarget?`${research.fairValueOrTargetKind==='fair_value'?'Fair value':'Target'}: ${research.currency} ${C.fmt(research.fairValueOrTargetPrice,4)}`:
  brief?.target?`Report fair value / target: ${brief.target.currency} ${brief.target.value}${brief.target.date?' · '+brief.target.date:''}`:'Fair value / target unavailable.';
 text(28,272,target,12,teal,true);
 prose(28,290,brief?.outlook?`Report summary · ${brief.outlookDate||brief.date}: ${brief.outlook}`:'A matched equity research summary is unavailable.',110,3,11.5);
 if(brief?.guidance)prose(28,334,'Guidance: '+brief.guidance,115,1,11);
 const researchUrl=root.CompanyFundamentals?.researchLink?.(brief)||research?.researchReportUrl;
 link(28,350,`Open ${brief?.provider||provider} research${brief?.date?' · '+brief.date:''}`,researchUrl);
 heading(377,'2','Agency credit ratings');
 if(credit.length){
  rect(28,387,744,17,'#edf4f6');text(38,399,'Agency / rating scope',11,muted,true);text(620,399,'Reported rating',11,muted,true);
  credit.slice(0,5).forEach((r,i)=>{const y=417+i*14;
   fitted(38,y,r.agency+' · '+r.scope,555,11.5);fitted(620,y,r.display,142,11.5,navy,true);
  });
  text(28,487,'Bloomberg supplied snapshot · rating observation dates unavailable.',10,muted);
  if(data.creditOutlook)text(28,501,'S&P outlook: '+data.creditOutlook+' (separate from credit grade).',10,muted);
 }else text(28,405,'No agency rating supplied for this exact listing.',12,muted);
 const bos=bosCredit.find(r=>r.ratings_as_reported);
 if(bos)prose(28,515,`BOS credit research · ${bos.report_date}: ${bos.ratings_as_reported}`,118,1,10);
 else if(!credit.length)text(28,423,'Missing ratings are not treated as investment grades.',11,muted);
 const quarters=fiscalQuarters(company?.quarterly);
 const displayCurrency=currencyTools.tradingCurrency(data.currency||data.moaCurrency);
 const definitions=new Set(),translations=new Set(),unconverted=new Set();
 let mixed=false,halfYear=false;
 for(const [section,key,title,top] of [[3,'income','Income statement',536],[4,'balance','Balance sheet',738],[5,'cash','Cash flow',872]]){
  const report=company?.quarterly?.[key];
  const from=currencyTools.reportingCurrency(info?.id,report);
  const table=highlights(report,key,quarters,{listingId:info?.id,target:displayCurrency,fx:data.statementFx?.[from],annual:company?.statements?.[key]});
  heading(top,String(section),title);
  if(!table){
   text(28,top+29,report?'No selected figures in this range.':'Quarterly statement unavailable for this listing.',12,muted);
   continue;
  }
  if(table.fiscalEnd)text(772,top,'Fiscal year end '+table.fiscalEnd,10,muted,false,'end');
  if(table.translation){
   const {from,to,rate,date}=table.translation;
   const quote=rate<1?C.fmt(1/rate,4)+' '+from+' = 1 '+to:'1 '+from+' = '+C.fmt(rate,4)+' '+to;
   translations.add('FRED H.10 display FX '+date+' · '+quote+' · One rate for all periods');
  }
  if(table.fxMissing)unconverted.add(table.sourceCurrency);
  if(!table.comparable)mixed=true;
  if(table.periods.some(period=>table.displayedPeriods.has(period)))halfYear=true;
  const y0=top+10,cellWidth=46,first=218;
  rect(28,y0,744,20,'#eaf2f5');
  text(38,y0+14,table.currency,11,teal,true);
  text(207,y0+14,'Unit',10,muted,true,'end');
  table.periods.forEach((quarter,i)=>{
   const left=first+cellWidth*i;
   if(quarter.startsWith('Q1')&&i>0)out.push(`<path d="M${left} ${y0}v20" stroke="${border}"/>`);
   const label=table.displayedPeriods.get(quarter)||quarter;
   text(left+cellWidth-5,y0+14,label,10,label===quarter?navy:'#805526',true,'end');
  });
  const rows=table.rows.flatMap(row=>row.changes?
   [row,{label:'QoQ change',values:row.changes,kind:'change'}]:[row]);
  rows.forEach((row,i)=>{
   const y=y0+32+i*12.2;
   const change=row.kind==='change';
   if(row.definition)definitions.add(row.definition);
   if(row.important)rect(28,y-9.5,744,12,'#eef6f7','#eef6f7');
   else if(change)rect(28,y-9.5,744,12,'#f7f9fb','#f7f9fb');
   fitted(change?50:38,y,row.label,154,10.6,row.important?teal:change?muted:navy,row.important);
   const unit=row.kind==='amount'?figures.unit(row.scale):row.kind==='perShare'?'per share':'%';
   if(row.kind==='change'||row.values.some(Number.isFinite))text(207,y,unit,9,muted,false,'end');
   row.values.forEach((value,j)=>{
    const color=value===null?muted:change?(value>0?'#226247':value<0?'#a03543':muted):row.important?teal:navy;
    const formatted=change?figures.changeText(value):row.kind==='ratio'&&Number.isFinite(value)?
     figures.number(value,1)+'%':figures.amount(value,row.scale);
    fitted(first+cellWidth*(j+1)-5,y,formatted,cellWidth-6,10.5,color,row.important||change,'end');
   });
  });
 }
 line(1003);
 const captured=company?.quarterlyCapturedAt;
 text(28,1019,`Morningstar · As Originally Reported${captured?' · captured '+captured:''}`,10,muted);
 const footnotes=quarters.length?[
  `12 fiscal periods · ${quarters[0]} to ${quarters.at(-1)} · M = millions · '000 = thousands · — = unavailable`,
  'QoQ = change ÷ absolute prior quarter, before FX. Net profit margin = net income ÷ revenue.',
  [...definitions, ...(mixed||halfYear?['Flow QoQ skips mixed periods. H1/H2 = half-year; FY = full year.']:[])].join(' '),
  unconverted.size?`FX unavailable for ${[...unconverted].join(', ')} to ${displayCurrency}. Amounts shown in reporting currency.`:'',
  ...translations
 ]:['Connect private statements in Stocks BETA 2 to include the available quarterly figures.'];
 footnotes.filter(Boolean).forEach((note,i)=>fitted(28,1034+14*i,note,744,10,muted));
 link(28,1108,'Full Morningstar financial statements',info?.financialsUrl);
 if(bos)link(445,1108,'BOS credit source · '+bos.report_date,bos.source_pdf);
 out.push('</svg>');return out.join('');
}
function termsSvg(page,data={},number,total){
 const {out,text,rect,line,prose,fitted,heading}=paper();
 const shareLabels=page.shares.map(share=>share.symbol).join(' + ');
 out.push(`<svg xmlns="http://www.w3.org/2000/svg" width="${C.W}" height="${C.H}" viewBox="0 0 ${C.W} ${C.H}" role="img" aria-label="SI terms and KO schedule">`);
 rect(0,0,C.W,C.H,'#fff','#fff');
 text(28,38,'FOR REFERENCE ONLY',17,navy,true);
 text(772,37,`MARKET INTEL / ${number} OF ${total}`,11,muted,true,'end');
 text(28,58,'Indicative levels from the entered SI terms and reference prices.',10,muted);
 rect(28,75,744,35,navy,navy);text(42,98,'SI terms & KO schedule',18,'#fff',true);
 fitted(28,140,shareLabels,550,19,navy,true);
 if(page.source?.reference)text(772,139,page.source.reference,12,teal,true,'end');
 const basis={per_annum:' p.a.',per_month:' per month',total:' total'}[page.couponBasis]||' · basis unconfirmed';
 text(28,169,`${page.currency}  ·  ${page.months} ${page.tenorUnit==='months'?'months':'(tenor unit unconfirmed)'}  ·  Coupon ${C.pct(page.coupon)}${basis}`,13,teal,true);
 if(page.issuer)fitted(28,190,'Issuer '+page.issuer,740,11,muted);
 heading(226,'1','Initial price levels');
 const referenceRows=page.shares.map(share=>{
  const stock=data[share.symbol]||{},ref=C.reference(page,share,stock);
  return {share,stock,ref,levels:C.levels(page,ref.value)};
 });
 const ends=[410,526,641,757];
 rect(28,239,744,25,'#eaf2f5');
 text(39,256,'Share / price basis',11,navy,true);
 ['Reference','Initial KO','KI','Strike'].forEach((label,i)=>text(ends[i],256,label,11,navy,true,'end'));
 referenceRows.forEach(({share,stock,ref,levels},i)=>{
  const y=283+i*36;
  if(i%2===0)rect(28,y-14,744,35,'#f4f8fa','#f4f8fa');
  text(39,y,share.symbol+(stock.currency?' · '+stock.currency:''),12,teal,true);
  text(39,y+14,[ref.basis,ref.date].filter(Boolean).join(' · '),9.5,muted);
  [ref.value,levels.ko,levels.ki,levels.strike].forEach((value,j)=>text(ends[j],y,C.fmt(value,4),12,navy,true,'end'));
 });
 heading(444,'2','Monthly knock-out levels');
 const final=C.finalKO(page);
 const scheduleAvailable=Number.isInteger(page.months)&&page.months>=1&&page.tenorUnit==='months'
  &&final!==null&&final>0;
 if(scheduleAvailable){
  const stepText=page.step>0?`KO steps down by ${C.fmt(page.step,4)} percentage points from month ${page.firstStep}.`:'KO is fixed across the entered tenor.';
  text(28,468,stepText+(page.months>12?' First and final months shown.':''),11,muted);
  const right=referenceRows.map((_,i)=>757-(referenceRows.length-1-i)*140);
  rect(28,484,744,24,'#eaf2f5');
  text(39,500,'Month',11,navy,true);text(185,500,'KO %',11,navy,true,'end');
  referenceRows.forEach(({share,stock},i)=>fitted(right[i],500,share.symbol+(stock.currency?' · '+stock.currency:''),134,11,navy,true,'end'));
  const months=page.months<=12?Array.from({length:page.months},(_,i)=>i+1):
   [1,2,3,4,5,null,page.months-4,page.months-3,page.months-2,page.months-1,page.months];
  months.forEach((month,index)=>{
   const y=526+index*19;
   if(month===null){text(39,y,'…',11,muted);return;}
   const ko=C.finalKO({...page,months:month});
   if(month%2||month===page.months)rect(28,y-13,744,19,month===page.months?'#eaf2f5':'#f4f8fa','#fff');
   text(39,y,month,11);text(185,y,C.pct(ko),11,teal,true,'end');
   referenceRows.forEach(({ref},i)=>text(right[i],y,C.fmt(Number.isFinite(ref.value)?ref.value*ko/100:null,4),11,navy,true,'end'));
  });
 }else{
  text(28,474,'A monthly schedule needs a confirmed monthly tenor and a supplied step-down.',11,muted);
  text(28,494,`Entered initial KO ${C.pct(page.ko)} · Final KO ${C.pct(final)}`,11,teal,true);
 }
 heading(796,'3','Check before relying on the levels');
 prose(28,823,'Confirm the first eligible observation, exact dates, KO basket rule and coupon terms against the issuer term sheet.',110,2,12);
 prose(28,859,`Entered KI observation: ${page.kiType||'Unconfirmed'}. Confirm the strike, settlement terms and capital loss conditions.`,110,2,12);
 if(page.notes){
  text(28,908,'Entered notes',12,teal,true);
  prose(28,929,page.notes,110,3,11);
 }
 line(1036);
 text(28,1057,'Share levels use the local quote currency shown for each listing. The SI currency is shown in the header.',10,muted);
 text(28,1075,'The month numbers describe model levels. The issuer term sheet sets the contractual observation dates.',10,muted);
 out.push('</svg>');return out.join('');
}
const api={fiscalQuarters,highlights,ratings,summary,plan,svg,termsSvg};root.SIEquityPages=api;if(typeof module!=='undefined')module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
