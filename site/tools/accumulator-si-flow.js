(function browser(){
 'use strict';
 const $=id=>document.getElementById(id), ids=['spot','strike','ko','months','guarantee','shares','rate','spread','fraction','valuation','sale','interest'];
 const qty=v=>v.toLocaleString('en-US'), pct=v=>(Math.floor(v*100+1e-8)/100).toFixed(2)+'%', clamp=(x,a,b)=>Math.min(b,Math.max(a,x));
 let currency='USD', ticker='', quote=null, benchmark=3.92, rateEdited=false;
 const currencyMark=()=>({USD:'US$',SGD:'S$'})[currency] || currency+' ';
 const fmt=(v,floor=false)=>{
  const n=floor?Math.floor(v+1e-8):Math.round(v);
  return (n<0?'−':'')+currencyMark()+qty(Math.abs(n));
 };
 const px=v=>currencyMark()+v.toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:v<1?4:2});
 const read=()=>Object.fromEntries(ids.map(id=>[id,id==='interest'?$(id).checked:id==='valuation'?$(id).value:Number($(id).value)]));
 const valid=c=>ids.every(id=>['valuation','interest'].includes(id)||(id==='sale'&&c.valuation!=='manual')||($(id).value!==''&&$(id).checkValidity()))&&c.spot>0&&c.strike>0&&c.shares>0&&Number.isInteger(c.shares);
 let active='ko3',prices=[],drag=null,scale=null;
 function preset(name,c){const b=c.spot*c.ko/100;return Array.from({length:c.months},(_,i)=>{const m=i+1;const p=name==='early'?(m===1?b*1.03:c.spot*.97):name==='ko3'?(m===3?b*1.03:c.spot*(m===1?.90:m===2?1.01:.97)):name==='recover'?Math.min(b*.98,c.spot*[1.03,.89,.85,.84,1.05,1.04][i%6]):name==='bear'?Math.max(0,c.spot*(1-.075*m)):c.spot;return Number(p.toFixed(8));});}
 function mark(name){active=name;document.querySelectorAll('[data-preset]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.preset===name)));}
 function metric(l,v,s,cls=''){return '<div class="metric"><small>'+l+'</small><strong class="'+cls+'">'+v+'</strong><small>'+s+'</small></div>';}
 function amount(l,v,cls=''){return '<div class="amount"><small>'+l+'</small><strong class="'+cls+'">'+v+'</strong></div>';}
 function bar(a,b){return '<div class="bar"><div class="used" style="width:'+a+'%"></div><div class="returned" style="width:'+b+'%"></div></div>';}
 function render(){
  const c=read();$('sale').disabled=c.valuation!=='manual';if(!valid(c)){$('error').textContent='Enter valid prices, rates and whole shares.';return;}$('error').textContent='';
  if(c.guarantee>c.months){c.guarantee=c.months;$('guarantee').value=String(c.months);}
  if(active)prices=preset(active,c);
  else if(prices.length!==c.months)prices=Array.from({length:c.months},(_,i)=>prices[i]??c.spot);
  const r=calculate(c,prices),cls=r.pnl>=0?'positive':'negative';
  $('metrics').innerHTML=metric('Upfront capital',fmt(r.capital),c.months+' × '+qty(c.shares)+' × '+px(c.strike))+metric('Shares purchased',qty(r.totalShares),'At cost '+fmt(r.cost))+metric('Principal refunded',fmt(r.refund),r.hit?'KO in month '+r.exit:'At maturity')+metric('Total scenario P&L',fmt(r.pnl,true),pct(r.pnl/r.capital*100)+' on upfront capital',cls);
  $('status').className='status'+(r.hit?' ko':'');$('status').textContent=r.hit?'KO month '+r.exit+' at '+px(prices[r.exit-1])+' · '+qty(r.totalShares)+' shares · '+fmt(r.refund)+' principal refunded':'No KO · '+qty(r.totalShares)+' shares accumulated';
  $('capflow').innerHTML=bar(r.cost/r.capital*100,r.refund/r.capital*100)+'<div class="two">'+amount('Shares at cost',fmt(r.cost))+amount('Cash returned',fmt(r.refund))+'</div>';
  $('tranches').innerHTML=r.tranches.map(t=>{const u=t.shares/c.shares*100;return '<div class="tranche"><small>Tranche '+t.m+' · '+fmt(c.shares*c.strike)+'</small><b>'+qty(t.shares)+' shares</b>'+bar(u,100-u)+'<small>'+(u===100?'Purchased':u===0?'Refunded':'Split')+' · '+t.duration+'m</small><small>'+fmt((c.shares-t.shares)*c.strike)+' cash back</small></div>';}).join('');
  $('recon').textContent='Principal check: '+fmt(r.cost)+' + '+fmt(r.refund)+' = '+fmt(r.capital)+'.';
  $('ratecaption').textContent=c.interest?r.rate.toFixed(2)+'% p.a. · hypothetical':'Interest off · no credit assumed';
  $('runway').innerHTML=r.tranches.map(t=>'<div class="time-row"><b>T'+t.m+'</b><div class="time-track"><div class="time-fill" style="width:'+(t.duration/c.months*100)+'%"></div></div><div class="money">'+fmt(t.interest,true)+' · '+t.duration+'m</div></div>').join('');
  $('interestformula').innerHTML=amount(currency+'-month exposure',fmt(r.exposure))+amount('Interest included',fmt(r.interest,true),'positive')+amount('Potential at assumed rate',fmt(r.potential,true),'positive')+amount('Net assumed rate',Math.max(0,c.rate-c.spread/100).toFixed(2)+'%');
  $('outcome').innerHTML='<div class="two">'+amount('Shares × '+px(r.price),fmt(r.shareValue))+amount('Principal refunded',fmt(r.refund))+amount('Equity P&L',fmt(r.equityPnL,true),r.equityPnL>=0?'positive':'negative')+amount('Illustrative interest',fmt(r.interest,true),'positive')+amount('Total value',fmt(r.finalValue,true))+amount('Total P&L',fmt(r.pnl,true),cls)+'</div><p class="small">Without interest: '+fmt(r.equityPnL,true)+' ('+pct(r.equityPnL/r.capital*100)+'). With hypothetical interest included: '+fmt(r.equityPnL+r.potential,true)+' ('+pct((r.equityPnL+r.potential)/r.capital*100)+'). Break-even with selected interest: '+(r.totalShares?px(Math.max(0,(r.cost-r.interest)/r.totalShares)):'N/A')+'.</p>';
  $('ledger').innerHTML=r.rows.map(x=>'<tr class="'+(x.m>r.exit?'inactive':'')+'"><td>M'+x.m+'</td><td>'+x.event+'</td><td>'+px(x.price)+'</td><td>'+fmt(x.open)+'</td><td>'+qty(x.shares)+'</td><td>'+fmt(x.cost)+'</td><td>'+fmt(x.refund)+'</td><td>'+fmt(x.close)+'</td><td>'+fmt(x.interest,true)+'</td></tr>').join('');
  $('ledgerfoot').innerHTML='<tr><th>Total</th><td></td><td></td><td>—</td><td>'+qty(r.totalShares)+'</td><td>'+fmt(r.cost)+'</td><td>'+fmt(r.refund)+'</td><td>'+fmt(0)+'</td><td>'+fmt(r.interest,true)+'</td></tr>';
  renderSensitivity(c,r);
  renderChart(c,r);renderInputs(c,r);
 }
 let saleStep=5;
 function renderSensitivity(c,r){
  const event=r.hit?'KO in month '+r.exit:'Maturity in month '+r.exit;
  const base=c.valuation==='manual'?'manual sale price':'modeled exit price';
  const range=r.price===0?'The base sale price is zero. Steps are percentages of the initial share price.':'Sale prices vary around the '+base+'.';
  $('sensitivity-note').textContent=event+' · '+qty(r.totalShares)+' shares. '+range+' Refund and interest stay fixed.';
  $('sensitivity-rows').innerHTML=exitSensitivity(r,saleStep,c.spot).map(row=>{
   const label=row.change===0?'Base':(row.change<0?'−':'+')+Math.abs(row.change)+'%';
   const value=fmt(row.finalValue,true), pnl=fmt(row.pnl,true), tone=row.pnl>=0?'positive':'negative';
   return '<tr'+(row.change===0?' class="sensitivity-base"':'')+'><th scope="row">'+label+'</th><td>'+px(row.price)+'</td><td>'+fmt(row.shareValue)+'</td>'
    +'<td class="sensitivity-desktop">'+value+'</td><td class="sensitivity-desktop '+tone+'">'+pnl+'</td>'
    +'<td class="sensitivity-mobile">'+value+'<br><span class="'+tone+'">'+pnl+'</span></td></tr>';
  }).join('');
 }
 function renderInputs(c,r){const el=$('priceinputs');if(el.children.length!==c.months||el.dataset.currency!==currency){el.dataset.currency=currency;el.innerHTML=prices.map((p,i)=>'<div><label for="p'+i+'">M'+(i+1)+' price ('+currency+')</label><input id="p'+i+'" type="number" min="0" max="1000000" step="any" data-price="'+i+'" value="'+p+'"></div>').join('');}for(let i=0;i<c.months;i++){const input=$('p'+i);if(document.activeElement!==input)input.value=prices[i];input.parentElement.classList.toggle('inactive',r.hit&&i>=r.exit);}}
 function renderChart(c,r){
  const W=720,H=315,L=65,R=22,T=27,B=46,pw=W-L-R,ph=H-T-B,max=drag&&scale?scale.max:Math.max(c.spot,c.strike,r.barrier,...prices)*1.18;scale={max,T,ph};
  const x=i=>L+pw*i/c.months,y=p=>T+(max-p)/max*ph;let s='';
  for(let i=0;i<=4;i++){const v=max*i/4,yy=y(v);s+='<line x1="'+L+'" x2="'+(W-R)+'" y1="'+yy+'" y2="'+yy+'" stroke="#dce5e1"/><text x="'+(L-8)+'" y="'+(yy+4)+'" text-anchor="end" font-size="12" fill="#53696d">'+v.toLocaleString('en-US',{maximumFractionDigits:2})+'</text>';}
  if(r.hit)s+='<rect x="'+x(r.exit)+'" y="'+T+'" width="'+(W-R-x(r.exit))+'" height="'+ph+'" fill="#e9f0f5"/><line x1="'+x(r.exit)+'" x2="'+x(r.exit)+'" y1="'+T+'" y2="'+(H-B)+'" stroke="#9c5961" stroke-dasharray="4 4"/><text x="'+Math.min(x(r.exit)+6,W-85)+'" y="17" fill="#9c5961" font-size="12" font-weight="700">KO M'+r.exit+'</text>';
  for(const [v,col,dash] of [[r.barrier,'#9c5961','6 5'],[c.spot,'#7798ab','3 5'],[c.strike,'#28634e','']])s+='<line x1="'+L+'" x2="'+(W-R)+'" y1="'+y(v)+'" y2="'+y(v)+'" stroke="'+col+'" stroke-width="1.7" stroke-dasharray="'+dash+'"/>';
  const path=[c.spot,...prices].map((p,i)=>x(i)+','+y(p));s+='<polyline points="'+path.slice(0,r.exit+1).join(' ')+'" fill="none" stroke="#294958" stroke-width="3.5" stroke-linejoin="round"/>';if(r.hit&&r.exit<c.months)s+='<polyline points="'+path.slice(r.exit).join(' ')+'" fill="none" stroke="#7798ab" stroke-dasharray="6 5" stroke-width="2.5"/>';
  s+='<circle cx="'+x(0)+'" cy="'+y(c.spot)+'" r="4" fill="#294958"/><text x="'+x(0)+'" y="'+(H-B+22)+'" font-size="12" text-anchor="middle" fill="#53696d">Start</text>';
  for(let i=0;i<c.months;i++){const xx=x(i+1),yy=y(prices[i]),col=i>=r.exit?'#7798ab':r.hit&&i===r.exit-1?'#9c5961':'#294958';s+='<g class="dragpoint" data-drag="'+i+'"><circle cx="'+xx+'" cy="'+yy+'" r="17" fill="transparent"/><circle cx="'+xx+'" cy="'+yy+'" r="7" stroke="#fff" stroke-width="2" fill="'+col+'"/><title>Month '+(i+1)+': '+px(prices[i])+'</title></g><text x="'+xx+'" y="'+Math.max(T+9,yy-12)+'" text-anchor="'+(i===c.months-1?'end':'middle')+'" font-size="'+(c.months>9?10:12)+'" font-weight="700" fill="'+col+'" pointer-events="none">'+px(prices[i])+'</text><text x="'+xx+'" y="'+(H-B+22)+'" font-size="12" text-anchor="middle" fill="#53696d">M'+(i+1)+'</text>';}
  s+='<text x="'+L+'" y="'+(H-5)+'" font-size="12" fill="#53696d">KO '+px(r.barrier)+' · Strike '+px(c.strike)+' · Initial '+px(c.spot)+'</text>';$('pricechart').innerHTML=s;
 }
 const svg=$('pricechart');svg.addEventListener('pointerdown',e=>{const target=e.target.closest('[data-drag]');if(!target)return;e.preventDefault();drag={i:Number(target.dataset.drag),pointer:e.pointerId};svg.setPointerCapture(e.pointerId);mark(null);});
 svg.addEventListener('pointermove',e=>{if(!drag||e.pointerId!==drag.pointer)return;e.preventDefault();const pt=svg.createSVGPoint();pt.x=e.clientX;pt.y=e.clientY;const v=pt.matrixTransform(svg.getScreenCTM().inverse());prices[drag.i]=Number(clamp(scale.max-(v.y-scale.T)/scale.ph*scale.max,0,scale.max).toFixed(4));render();});
 for(const event of ['pointerup','pointercancel','lostpointercapture'])svg.addEventListener(event,e=>{if(drag&&e.pointerId===drag.pointer){drag=null;render();}});
 $('priceinputs').addEventListener('input',e=>{const i=Number(e.target.dataset.price),v=Number(e.target.value);if(Number.isInteger(i)&&e.target.value!==''&&e.target.checkValidity()&&v>=0){prices[i]=v;mark(null);render();}});$('priceinputs').addEventListener('change',render);
 function setQuote(selection){
  quote=selection;
  if(quote){
   $('ko').value=quote.ko;$('months').value=quote.months;$('guarantee').value=quote.guarantee;
   updateStrike();
  }
  document.dispatchEvent(new CustomEvent('flow-quote-changed',{detail:quote}));
  render();
 }
 function updateStrike(){
  if(quote&&$('spot').value&&$('spot').checkValidity()){
   $('strike').value=Number((Number($('spot').value)*quote.strikePct/100).toFixed(8));
  }
 }
 function useClose(close,strikeRatio){
  const c=read();
  const ratio=strikeRatio??(c.spot>0&&c.strike>0?c.strike/c.spot:.9);
  $('spot').value=Number(close.toFixed(4));
  if(quote)updateStrike();
  else $('strike').value=Number((Number($('spot').value)*ratio).toFixed(8));
  render();
 }
 function caption(){
  $('structure-caption').textContent=(ticker||'Manual example')+' · '+currency+' · monthly proxy';
  $('benchmark-label').textContent=currency==='USD'?'USD benchmark / assumption (% p.a.)':currency+' rate assumption (% p.a.)';
  document.querySelectorAll('[data-flow-currency]').forEach(node=>{node.textContent=currency;});
 }
 function setRate(rate){
  benchmark=rate;
  if(currency==='USD'&&!rateEdited){$('rate').value=rate;render();}
 }
 function useShare(item,close){
  if(currency!==(item?.currency||'USD')){
   currency=item?.currency||'USD';
   rateEdited=false;
   $('rate').value=currency==='USD'?benchmark:0;
   $('interest').checked=false;
  }
  ticker=item?.ticker||'';
  caption();
  if(quote)setQuote(null);
  if(!active)mark('ko3');
  $('valuation').value='exit';
  $('sale').value=close??110;
  if(Number.isFinite(close))useClose(close,.9);
  else{
   $('spot').value=item?'':100;
   $('strike').value=item?'':90;
   render();
  }
 }
 for(const id of ids)$(id).addEventListener('input',()=>{
  if(id==='rate')rateEdited=true;
  if(quote&&['strike','ko','months','guarantee'].includes(id)){setQuote(null);return;}
  if(id==='spot')updateStrike();
  render();
 });
 $('sale-step').addEventListener('input',()=>{
  if($('sale-step').value&&$('sale-step').checkValidity()){
   saleStep=Number($('sale-step').value);
   render();
  }
 });
 $('sale-step').addEventListener('change',()=>{$('sale-step').value=saleStep;});
 document.querySelectorAll('[data-preset]').forEach(b=>b.addEventListener('click',()=>{mark(b.dataset.preset);render();}));
 $('reset').addEventListener('click',()=>{
  currency='USD';ticker='';rateEdited=false;saleStep=5;
  for(const [id,val] of Object.entries({spot:100,strike:90,ko:110,months:6,guarantee:2,shares:1000,rate:benchmark,spread:0,fraction:100,valuation:'exit',sale:110,'sale-step':saleStep}))$(id).value=val;
  $('interest').checked=false;
  mark('ko3');caption();setQuote(null);
  document.dispatchEvent(new Event('flow-reset'));
 });
 window.AccumulatorSIFlow={useShare,useClose,setQuote,setRate};
 render();
})();
