(function(){
  'use strict';
  const $=id=>document.getElementById(id),model=window.CPFLifeModel;
  const money=n=>new Intl.NumberFormat('en-SG',{style:'currency',currency:'SGD',maximumFractionDigits:0}).format(n);
  const pct=n=>n===null?'N/A':(n*100).toFixed(2)+'%';
  const rateNames=['raRate','growth','inflation','accumulation','returnRate'];
  let latest;
  function inputs(){let p={};for(const e of $('controls').elements){if(e.name){if(String(e.value).trim()==='')throw Error('Complete every input; enter 0 explicitly where intended.');p[e.name]=Number(e.value)/(rateNames.includes(e.name)?100:1);}}return p;}
  function chart(id,title,series,percent=false){
    const W=660,H=290,L=62,R=20,T=25,B=43,all=series.flatMap(s=>s.points).filter(p=>p.y!==null&&Number.isFinite(p.y));
    if(!all.length){$(id).textContent='No valid result to chart.';return;}
    let xmin=Math.min(...all.map(p=>p.x)),xmax=Math.max(...all.map(p=>p.x)),ymin=Math.min(0,...all.map(p=>p.y)),ymax=Math.max(0,...all.map(p=>p.y));
    if(xmax===xmin)xmax=xmin+1;if(ymax===ymin)ymax=ymin+1;
    const x=v=>L+(v-xmin)/(xmax-xmin)*(W-L-R),y=v=>H-B-(v-ymin)/(ymax-ymin)*(H-T-B);
    let s='<svg viewBox="0 0 '+W+' '+H+'" role="img" aria-label="'+title+'"><title>'+title+'</title>';
    for(let i=0;i<=4;i++){let v=ymin+(ymax-ymin)*i/4,yy=y(v);s+='<line x1="'+L+'" y1="'+yy+'" x2="'+(W-R)+'" y2="'+yy+'" stroke="#dce3e4"/><text x="'+(L-8)+'" y="'+(yy+4)+'" text-anchor="end" font-size="12" fill="#526575">'+(percent?(100*v).toFixed(1)+'%':Math.abs(v)>=1000?(v/1000).toFixed(0)+'k':v.toFixed(0))+'</text>';}
    for(let i=0;i<=4;i++){let v=xmin+(xmax-xmin)*i/4,xx=x(v);s+='<text x="'+xx+'" y="'+(H-19)+'" text-anchor="middle" font-size="12" fill="#526575">'+v.toFixed(0)+'</text>';}
    for(const [idx,a] of series.entries()){
      const pts=a.points.filter(p=>p.y!==null&&Number.isFinite(p.y));if(pts.length)s+='<polyline fill="none" stroke="'+(idx?'#b47826':'#1d6d93')+'" stroke-width="3" points="'+pts.map(p=>x(p.x)+','+y(p.y)).join(' ')+'"/>';
    }
    s+='<text x="'+((L+W-R)/2)+'" y="'+(H-1)+'" text-anchor="middle" font-size="12" fill="#526575">Age</text></svg>';$(id).innerHTML=s;
  }
  function render(){
    try{
      const p=inputs();model.validate(p);const r=model.run(p);latest=r;$('error').textContent='';
      $('results').innerHTML='<div class="grid"><div class="tile"><span>Illustrative lifetime-income XIRR, with estate</span><strong>'+pct(r.cpfXirr)+'</strong><span>Income-only: '+pct(r.cpfIncomeXirr)+'</span></div><div class="tile"><span>Portfolio XIRR, with estate</span><strong>'+pct(r.portfolioXirr)+'</strong><span>Income-only: '+pct(r.portfolioIncomeXirr)+'</span></div><div class="tile"><span>Portfolio first income shortfall</span><strong>'+(r.depletion===null?'None by '+p.endAge:r.depletion.toFixed(2))+'</strong><span>Conditional on this return path</span></div></div><div class="tablewrap"><table><thead><tr><th>At death age '+p.endAge+'</th><th class="num">Illustrative lifetime income</th><th class="num">Same-capital portfolio</th></tr></thead><tbody><tr><td>Total nominal cash received</td><td class="num">'+money(r.cumCPF)+'</td><td class="num">'+money(r.cumPortfolio)+'</td></tr><tr><td>Inheritance remaining</td><td class="num">'+money(r.refund)+'</td><td class="num">'+money(r.portfolio)+'</td></tr><tr><td>Cumulative income shortfall</td><td class="num">'+money(0)+'</td><td class="num">'+money(r.cumCPF-r.cumPortfolio)+'</td></tr></tbody></table></div><p class="note">Assumed premium at income start: '+money(r.premium)+'. Last lifetime-income payment in starting-date purchasing power: '+money(r.realLastPayout)+'. These are scenario calculations, not product benefits.</p>';
      chart('income-chart','Cumulative nominal income by age',[{points:r.rows.map(a=>({x:a.age,y:a.cumCPF}))},{points:r.rows.map(a=>({x:a.age,y:a.cumPortfolio}))}]);
      chart('estate-chart','Remaining refund and portfolio value by age',[{points:r.rows.map(a=>({x:a.age,y:a.refund}))},{points:r.rows.map(a=>({x:a.age,y:a.portfolio}))}]);
      const ages=[70,75,80,85,90,95,100].filter(a=>a>p.entryAge),h=ages.map(a=>model.run(p,a));
      $('horizons').innerHTML='<table><thead><tr><th>Death age</th><th class="num">Lifetime income received</th><th class="num">Premium refund</th><th class="num">Income + estate XIRR</th><th class="num">Income-only XIRR</th><th class="num">Portfolio left</th><th class="num">Portfolio shortfall</th></tr></thead><tbody>'+h.map((a,i)=>'<tr><td>'+ages[i]+'</td><td class="num">'+money(a.cumCPF)+'</td><td class="num">'+money(a.refund)+'</td><td class="num">'+pct(a.cpfXirr)+'</td><td class="num">'+pct(a.cpfIncomeXirr)+'</td><td class="num">'+money(a.portfolio)+'</td><td class="num">'+money(a.cumCPF-a.cumPortfolio)+'</td></tr>').join('')+'</tbody></table>';
      chart('xirr-chart','Estate-inclusive XIRR conditional on death age',[{points:h.map((a,i)=>({x:ages[i],y:a.cpfXirr}))},{points:h.map((a,i)=>({x:ages[i],y:a.portfolioXirr}))}],true);
      const seq=[-.2,.2,.05,.05,.05,.05,.05,.05,.05,.05],a=model.run(p,p.startAge+10,seq),b=model.run(p,p.startAge+10,[...seq].reverse());
      chart('sequence-chart','Portfolio value: equal compounded returns, different order',[{points:a.rows.filter(a=>a.age>=p.startAge).map(a=>({x:a.age,y:a.portfolio}))},{points:b.rows.filter(a=>a.age>=p.startAge).map(a=>({x:a.age,y:a.portfolio}))}]);
      $('sequence-caption').textContent='Uses the current capital, pre-income return, payout and payout-growth inputs. At age '+(p.startAge+10)+': loss-first balance '+money(a.portfolio)+'; loss-last balance '+money(b.portfolio)+'. Both use the same ten annual returns in reverse order, applied as equivalent monthly rates. No probability is attached to either path.';
    }catch(e){$('error').textContent=e.message;latest=null;$('results').innerHTML='';for(const id of ['income-chart','estate-chart','horizons','xirr-chart','sequence-chart','sequence-caption'])$(id).innerHTML='';}
  }
  $('controls').addEventListener('input',render);$('controls').addEventListener('submit',e=>e.preventDefault());
  $('reset').addEventListener('click',()=>{$('controls').reset();render();});
  $('csv').addEventListener('click',()=>{
    if(!latest)return;const r=latest,lines=['Synthetic educational scenario; not a CPF or HSBC quote','Initial outlay SGD,'+r.params.capital,'Initial date,2026-11-01',...Object.entries(r.params).map(([k,v])=>k+','+v),'Date,Age,Illustrative income,Portfolio withdrawal,Cumulative illustrative income,Cumulative portfolio income,Illustrative refund,Portfolio value,Income shortfall,Real illustrative income',...r.rows.map(x=>[x.date,x.age,x.cpf,x.portfolioPaid,x.cumCPF,x.cumPortfolio,x.refund,x.portfolio,x.shortfall,x.realPayout].join(','))];
    const url=URL.createObjectURL(new Blob([lines.join('\r\n')],{type:'text/csv;charset=utf-8'})),a=document.createElement('a');a.href=url;a.download='cpf-life-synthetic-monthly-scenario.csv';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
  });render();
})();
