/* Optional, self-contained A4 appendices. Annual figures stay in the owner's browser. */
(function(root){'use strict';
const C=root.SIBetaCore||(typeof require==='function'?require('./si-beta2-core.js'):null);
const E=C.escape,navy='#122b43',teal='#276976',muted='#526477',border='#d3dfe6';
const choices={
 income:[['Revenue',/^(?:Total )?Revenue$/i],['Gross profit',/^Gross Profit$/i],
  ['Operating income',/^(?:Total Operating Profit\/Loss|Operating Income)$/i],
  ['Net income',/^Net Income(?:\/Loss)?(?:, Total| Attributable to Parent| After Non-Controlling\/Minority Interests)?$/i],
  ['Diluted EPS',/^(?:Diluted EPS|Reported Normalized Diluted EPS|Diluted Earnings Per Share|Earnings Per Share.*Diluted.*)$/i]],
 balance:[['Cash & equivalents',/^(?:Cash (?:And|&) Cash Equivalents|Cash, Cash Equivalents and Short Term Investments)$/i],['Total assets',/^Total Assets$/i],
  ['Total liabilities',/^Total Liabilities$/i],['Total equity',/^Total (?:Equity|Stockholders.? Equity)$/i],['Current assets',/^Total Current Assets$/i]],
 cash:[['Operating cash flow',/^Cash Flow from(?:\/Used in)? Operating Activities(?:, (?:Indirect|Direct))?$/i],
  ['Investing cash flow',/^Cash Flow from(?:\/Used in)? Investing Activities$/i],
  ['Financing cash flow',/^Cash Flow from(?:\/Used in)? Financing Activities$/i],
  ['Ending cash',/^Cash and Cash Equivalents, End of Period$/i],['Change in cash',/^Change in Cash$/i]]
};
function highlights(report,key){
 if(!report?.periods||!report?.rows)return null;
 const periods=report.periods.map((label,index)=>({label,index})).filter(p=>/^\d{4}$/.test(p.label))
  .sort((a,b)=>b.label.localeCompare(a.label)).slice(0,3).reverse();
 if(!periods.length)return null;
 const rows=choices[key].map(([label,pattern])=>{
  const match=report.rows.find(row=>pattern.test(row[1])&&periods.some(p=>Number.isFinite(row[2][p.index])));
  const perShare=match&&/per share|\bEPS\b/i.test(match[1]);
  const caption=/Normalized/.test(match?.[1]||'')?'Normalized diluted EPS':/Short Term Investments/.test(match?.[1]||'')?'Cash & short-term investments':label;
  return {label:caption+(perShare?' (per share)':''),reportedLabel:match?.[1],
   values:periods.map(p=>match?.[2][p.index]??null),scale:perShare?1:1e6};
 });
 return {periods:periods.map(p=>p.label),rows,currency:report.currency,fiscalEnd:report.fiscalEnd};
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
function plan(pages,include){return pages.flatMap(page=>[{kind:'si',page},
 ...(include?page.shares.map(share=>({kind:'equity',page,share})):[])]);}
function svg(share,data={},page=2,total=2,{showWatermarks=true,links=[],source=''}={}){
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
 heading(240,'1','Equity research');
 const research=data.metrics,call=research?.rating||brief?.rating||'Unavailable',provider=research?.researchProvider||brief?.provider||'BOS research';
 const currentTarget=Number.isFinite(research?.fairValueOrTargetPrice)?research:null;
 text(28,263,`${provider} · Analyst view: ${call}${data.metricsDate?' · '+data.metricsDate:brief?.date?' · '+brief.date:''}`,12,navy,true);
 const target=currentTarget?`${research.fairValueOrTargetKind==='fair_value'?'Fair value':'Target'}: ${research.currency} ${C.fmt(research.fairValueOrTargetPrice,4)}`:
  brief?.target?`Report fair value / target: ${brief.target.currency} ${brief.target.value} · ${brief.target.date}`:'Fair value / target unavailable.';
 text(28,283,target,12,teal,true);
 prose(28,305,brief?.outlook?`Report summary · ${brief.outlookDate||brief.date}: ${brief.outlook}`:'A matched equity research summary is unavailable.',110,3,11.5);
 if(brief?.guidance)prose(28,355,'Guidance: '+brief.guidance,115,1,11);
 const researchUrl=root.CompanyFundamentals?.researchLink?.(brief)||research?.researchReportUrl;
 link(28,378,`Open ${brief?.provider||provider} research${brief?.date?' · '+brief.date:''}`,researchUrl);
 heading(413,'2','Agency credit ratings');
 if(credit.length){
  rect(28,427,744,21,'#edf4f6');text(38,442,'Agency / rating scope',11,muted,true);text(620,442,'Reported rating',11,muted,true);
  credit.slice(0,5).forEach((r,i)=>{const y=464+i*18;
   fitted(38,y,r.agency+' · '+r.scope,555,11.5);fitted(620,y,r.display,142,11.5,navy,true);
  });
  text(28,557,'Bloomberg supplied snapshot · rating observation dates unavailable.',10,muted);
  if(data.creditOutlook)text(28,572,'S&P outlook: '+data.creditOutlook+' (separate from credit grade).',10,muted);
 }else text(28,450,'No agency rating supplied for this exact listing.',12,muted);
 const bos=bosCredit.find(r=>r.ratings_as_reported);
 if(bos)prose(28,591,`BOS credit research · ${bos.report_date}: ${bos.ratings_as_reported}`,118,1,10);
 else if(!credit.length)text(28,472,'Missing ratings are not treated as investment grades.',11,muted);
 const titles={income:'Income statement',balance:'Balance sheet',cash:'Cash flow'};
 ['income','balance','cash'].forEach((key,section)=>{
  const top=615+section*136,report=company?.statements?.[key],table=highlights(report,key);
  heading(top,String(section+3),titles[key]);
  if(table?.fiscalEnd)text(772,top,'Fiscal year end: '+table.fiscalEnd,10,muted,false,'end');
  if(!table){
   text(28,top+27,'Annual statement not loaded in this browser for this listing.',12,muted);
   if(key==='income'&&brief?.financials){
    const f=brief.financials;
    text(28,top+49,'The linked BOS report contains financial estimates; these are not imported annual statements.',10,muted);
    const row=f.rows?.find(r=>/^Revenue/.test(r[0]));
    if(row)prose(28,top+70,'Report '+row[0]+': '+f.periods.map((p,i)=>p+' '+row[i+1]).join(' · '),110,2,10);
   }else link(28,top+53,'View company financials',info?.financialsUrl);
   return;
  }
  const columns=[530,642,758];
  rect(28,top+10,744,22,'#edf4f6');text(38,top+25,table.currency+' millions'+(key==='income'?' · EPS per share':''),10,muted,true);
  table.periods.forEach((year,i)=>text(columns[i],top+25,year,11,navy,true,'end'));
  table.rows.forEach((row,i)=>{const y=top+47+i*17;
   if(i%2===0)rect(28,y-13,744,17,'#f7fafb','#f7fafb');
   text(38,y,row.label,11.5,navy,i===0);
   row.values.forEach((v,j)=>text(columns[j],y,v===null?'Unavailable':C.fmt(v/row.scale,2),11.5,v===null?muted:navy,true,'end'));
  });
 });
 line(1025);
 const captured=company?.capturedAt?.slice(0,10);
 text(28,1044,`Annual statements: Morningstar${captured?' · captured '+captured:''}. Latest three available fiscal years; selected reported totals.`,10,muted);
 text(28,1060,'Currencies belong to each statement; they may differ from the share quotation. No missing amounts are inferred.',10,muted);
 if(company)link(28,1078,'Open full Morningstar financial statements',info?.financialsUrl);
 else text(28,1078,'To include annual figures, load your Fundamentals JSON in Stocks BETA 2 settings on this browser.',10,teal);
 if(bos)link(28,1096,'Credit research source · '+bos.report_date,bos.source_pdf);
 else text(28,1096,'Agency credit ratings are separate from analyst calls and Morningstar stars.',10,muted);
 out.push('</svg>');return out.join('');
}
const api={highlights,ratings,summary,plan,svg};root.SIEquityPages=api;if(typeof module!=='undefined')module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
