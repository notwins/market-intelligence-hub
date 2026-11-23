// Printable, vector report of the exact comparison state. All currency values are USD.
(() => {
  'use strict';
  const margin = 15;
  const width = 180;
  const navy = '#172A42', forest = '#235C51', rose = '#986552';
  const ink = '#25374B', muted = '#506373', line = '#D7E1E5';
  const paper = '#F2F6F6', mint = '#EAF3EF', blush = '#F7EFEB', white = '#FFFFFF';
  const clean = value => String(value ?? '').replace(/[‘’]/g, "'").replace(/[–—−]/g, '-').replace(/→/g,'to').replace(/[\u202f\u00a0]/g,' ');

  function generate() {
    const state = window.AccumulatorComparison?.getSnapshot();
    if (!state?.notes?.length || !state.rows?.length)
      throw Error('Choose an available strike and check your comparison inputs before downloading.');
    if (!window.jspdf?.jsPDF) throw Error('The PDF library is still loading. Please try again.');
    const fmt = window.AccumulatorFormat;
    const market = window.AccumulatorMarket.getState();
    const doc = new window.jspdf.jsPDF({format:'a4', unit:'mm', compress:true, putOnlyUsedFonts:true});
    doc.setProperties({title:'NVDA normal accumulator | Scenario comparison', author:'Market Intelligence Hub',
      subject:'Illustrative payouts, price paths and a historical-volatility cone'});
    const date = new Intl.DateTimeFormat('en-SG',{day:'numeric',month:'short',year:'numeric',timeZone:'Asia/Singapore'}).format(new Date());
    const all = state.notes.map((note,index) => ({...note, index, letter:String.fromCharCode(65+index)}));
    const rows = Object.fromEntries(state.rows.map(row => [row.id,row]));
    const batchSize = 5;
    const numberOfPages = Math.ceil(all.length / batchSize) * 5;
    let page = 0;
    let group;

    function pen(size, bold, color) {
      doc.setFont('helvetica',bold ? 'bold' : 'normal');
      doc.setFontSize(size); doc.setTextColor(color);
    }
    function text(value,x,y,size=10,color=ink,bold=false,align='left') {
      pen(size,bold,color); doc.text(clean(value),x,y,{align});
    }
    function wrap(value,x,y,w,size=10,color=ink,bold=false,leading=4.9) {
      pen(size,bold,color);
      const lines=doc.splitTextToSize(clean(value),w);
      for (const s of lines) { doc.text(s,x,y); y+=leading; }
      return y;
    }
    function fill(x,y,w,h,color) {
      doc.setFillColor(color); doc.rect(x,y,w,h,'F');
    }
    function rule(x1,y1,x2,y2,color=line,weight=.23,dash=[]) {
      doc.setDrawColor(color); doc.setLineWidth(weight);
      doc.setLineDashPattern(dash,0); doc.line(x1,y1,x2,y2); doc.setLineDashPattern([],0);
    }
    function startPage(title,subtitle) {
      if (page) doc.addPage();
      page++;
      fill(0,0,210,3,navy);
      text('MARKET INTELLIGENCE HUB',margin,15,9,forest,true);
      text('NVDA  /  NORMAL ACCUMULATOR',195,15,8.5,muted,true,'right');
      rule(margin,19,195,19);
      text(title,margin,34,24,navy,true);
      const y=wrap(subtitle,margin,43,width,10.5,muted,false,5.1);
      rule(margin,279,195,279);
      text('USD   |   Report generated '+date+' SGT',margin,285,8.2,muted);
      text('Notes '+group.map(n=>n.letter).join(', ')+'    /    '+page+' of '+numberOfPages,195,285,8.2,muted,false,'right');
      return y+4;
    }
    function heading(label,y) {
      text(label,margin,y,14,navy,true);
      return y+4;
    }
    function box(title,body,y,color=mint) {
      pen(10,false,ink);
      const lines=doc.splitTextToSize(clean(body),width-13);
      const h=15+4.8*lines.length;
      fill(margin,y,width,h,color); fill(margin,y,1,h,color===blush ? rose : forest);
      text(title,margin+5,y+7.5,11,navy,true);
      wrap(body,margin+5,y+14,width-12,10,ink,false,4.8);
      return y+h+8;
    }
    // Each table has a fixed landscape-independent width. Large values shrink within cells.
    function table(y,headers,widths,data,{headerSize=8.9,bodySize=9.5,headerHeight=10,rowHeight=10}={}) {
      const write=(content,x,top,w,h,size,header,first) => {
        const cell=typeof content==='object' ? content : {value:content};
        const strings=String(cell.value ?? '').split('\n');
        const bold=header||cell.bold;
        if(cell.fill) fill(x,top,w,h,cell.fill);
        pen(size,bold,header?white:(cell.color||ink));
        const longest=Math.max(1,...strings.map(v=>doc.getTextWidth(clean(v))));
        const finalSize=Math.min(size,size*(w-4)/longest);
        const lead=finalSize*.42;
        let baseline=top+h/2-(strings.length-1)*lead/2+finalSize*.115;
        for (const s of strings) {
          text(s,first?x+2:x+w-2,baseline,finalSize,header?white:(cell.color||ink),bold,first?'left':'right');
          baseline+=lead;
        }
      };
      fill(margin,y,width,headerHeight,navy);
      let x=margin;
      headers.forEach((v,j)=>{write(v,x,y,widths[j],headerHeight,headerSize,true,j===0);x+=widths[j];});
      y+=headerHeight;
      data.forEach((r,i)=>{
        if(i%2===0) fill(margin,y,width,rowHeight,paper);
        x=margin;
        r.forEach((v,j)=>{write(v,x,y,widths[j],rowHeight,bodySize,false,j===0);x+=widths[j];});
        y+=rowHeight;rule(margin,y,195,y);
      });
      return y+6;
    }

    const name=n=>n.letter+'  '+n.quote.product;
    const profit=v=>({value:fmt.signedMoney(v),bold:true,color:v<0?rose:forest});
    const asPrice=fmt.price, quantity=fmt.shares, cash=fmt.money;
    const netRate=fmt.signedRate;
    function exitTiming(n,i,row) {
      const event=row.exits[i];
      return event.koDay ? 'KO M'+event.koMonth+' · d'+event.koDay : 'Maturity M'+n.quote.months+' · d'+event.day;
    }
    function matrix(y,firstHeader,firstWidth,body,options={}) {
      const headers=[firstHeader,...group.map(n=>name(n)+'\n'+fmt.quote(n.quote.strike)+' strike')];
      return table(y,headers,[firstWidth,...group.map(()=>(width-firstWidth)/group.length)],body,
        {headerHeight:12,bodySize:9,rowHeight:9,...options});
    }
    function rankedResult(row,n) {
      const v=row.values[n.index];
      const best=all.length>1 && row.winners.includes(n.index);
      const worst=all.length>1 && row.losers.includes(n.index);
      const rank=best&&worst?'ALL TIED':best?'BEST':worst?'WORST':'';
      return {value:fmt.signedMoney(v.pnl)+'\n'+netRate(v.rate)+(rank?'\n'+rank:''),
        bold:!!rank,fill:best&&worst?paper:best?mint:worst?blush:null,color:best&&worst?ink:best?forest:worst?rose:ink};
    }
    function overview() {
      let y=startPage('Your NVDA comparison','A funded Normal accumulator buys a scheduled number of NVDA shares at an agreed price. The daily knock-out level determines how long purchases continue.');
      const cells=[['TARGET BUDGET',cash(state.target)],['TRADE-DAY PRICE',asPrice(state.spot)],['STRUCTURES SELECTED',quantity(all.length)]];
      cells.forEach(([label,value],i)=>{
        const x=margin+i*61;
        fill(x,y,58,23,i===0?mint:paper);
        text(label,x+4,y+7,8,muted,true);text(value,x+4,y+16,16,navy,true);
      });
      if(market.latest) {
        text('Dated NVDA close on '+market.latest[0]+': '+asPrice(market.latest[1]),margin,y+28,8.7,muted);
      }
      y=heading('Indicative terms and actual payment',y+38);
      y=table(y,['Structure','Tenor /\nguarantee','Strike','Daily KO','Shares /\nmonth','Payment'],[26,27,30,28,26,43],
        group.map(n=>[name(n),n.quote.months+'m / '+n.quote.minimum+'m'+(Number.isInteger(n.quote.guaranteedDays)?'\n'+n.quote.guaranteedDays+' quoted days':''),
          asPrice(n.terms.strike)+'\n'+fmt.quote(n.quote.strike),asPrice(n.terms.ko)+'\n'+fmt.quote(n.quote.ko),
          quantity(n.terms.maximum),{value:cash(n.terms.payment),bold:true}]),{rowHeight:10,headerHeight:10});
      const vintage=group.some(n=>n.quote.months===12) ? ' The 12-month JPM row is an earlier indicative example.' : '';
      y=wrap('Indicative quotes, 23 Nov 2026. Percentages refer to the trade-day price. JPM SN is a structured note. OCBC SI is a structured investment. Both settle monthly.'+vintage,margin,y+1,width,9.3,muted,false,4.3)+3;
      const example=group[0], t=example.terms, q=example.quote;
      y=box('How '+example.letter+' is sized',
        cash(state.target)+' ÷ '+asPrice(t.strike)+' ÷ '+q.months+' months gives '+quantity(t.maximum)+' shares per month after rounding. '+quantity(t.maximum)+' × '+asPrice(t.strike)+' × '+q.months+' = '+asPrice(t.committed)+'. Payment rounds up to '+cash(t.payment)+'. The difference is refundable.',y);
      y=wrap('At early KO, guaranteed purchases still go through. After the guarantee, only shares earned before KO are bought. Unused cash comes back. A fall below strike reduces the shares’ value.',margin,y,width,9.7,ink,false,4.5)+5;
      y=heading('Best and worst scenario for each structure',y);
      const metric=state.metric, display=metric==='rate'?netRate:fmt.signedMoney;
      function scenarioExtreme(n,key) {
        const matches=state.ranges[n.index][key];
        const first=state.rows[matches[0]];
        const label=matches.length===1?first.name:matches.length===state.rows.length?'All paths tied':'Paths '+matches.map(j=>j+1).join(', ')+' tied';
        return {value:label+'\n'+display(first.values[n.index][metric]),bold:true,fill:key==='best'?mint:blush,color:key==='best'?forest:rose};
      }
      y=matrix(y,metric==='rate'?'Return on payment':'Dollar P&L',36,[
        ['Best scenario',...group.map(n=>scenarioExtreme(n,'best'))],
        ['Worst scenario',...group.map(n=>scenarioExtreme(n,'worst'))]
      ],{rowHeight:10,headerHeight:11,bodySize:8.7});
      wrap('These are the highest and lowest of the seven paths on the following page. Other price paths can produce larger losses or gains.',margin,y,width,9.1,muted,false,4.2);
    }
    function outcomes() {
      const metric=state.metric==='rate'?'return on payment':'dollar P&L';
      let y=startPage('Scenario outcomes','Read across a row to compare the same price path. Each cell gives profit or loss since investment and return on the actual payment.');
      y=matrix(y,'Scenario',36,state.rows.map((r,i)=>[(i+1)+'. '+r.name,...group.map(n=>rankedResult(r,n))]),{rowHeight:14});
      const rankNote=all.length>1?'BEST and WORST rank all '+all.length+' selected structures by '+metric+' before rounding. Tied outcomes share the label. A best result can still be a loss.':'Each result compares the total value of this structure with its actual payment.';
      y=wrap(rankNote,margin,y+1,width,9.3,muted,false,4.5)+4;
      const r=rows[state.active]||rows.early;
      const detail=(label,get)=>[label,...group.map(n=>get(r.values[n.index],n))];
      y=heading('Selected scenario · '+r.name,y+2);
      y=matrix(y,'USD unless stated',42,[
        detail('Structure ends',(v,n)=>exitTiming(n,n.index,r)),
        detail('NVDA at exit',v=>asPrice(v.exitSpot)),
        detail('Cash refunded',v=>asPrice(v.refund)),
        detail('Sale proceeds',v=>cash(v.proceeds)),
        detail('Value of shares held',v=>cash(v.retainedValue)),
        detail('Total value',v=>({value:cash(v.nav),bold:true})),
        detail('P&L since investment',v=>profit(v.pnl))
      ],{rowHeight:7.8});
      wrap('Total value = refund + sale proceeds + value of shares held. P&L = total value less payment. Dollar totals use full amounts before display rounding.',margin,y,width,9.1,muted,false,4.2);
    }
    function payouts() {
      let y=startPage('Cash at knock-out or maturity','These paths assume a sale at the observed knock-out (KO) close or maturity close. Each structure follows its own barrier, guarantee and maturity date.');
      for (const row of [rows.early,rows.late,rows.down]) {
        y=heading(row.name,y+1);
        const summary=row.id==='down'
          ? 'Assumed NVDA price at the earliest maturity: '+asPrice(row.path[row.path.length-1])+'. It stays there afterwards.'
          : 'NVDA moves to '+asPrice(state.settings.rally)+' on trading day '+(row.id==='early'?state.settings.earlyDay:state.settings.lateDay)+'.';
        y=wrap(summary,margin,y+1,width,9.2,muted,false,4.2);
        y=table(y,['Structure / exit','Shares\nbought','Sale\nprice','Sale\nproceeds','Cash\nrefunded','Total value','P&L'],[32,16,22,28,26,29,27],
          group.map(n=>{const v=row.values[n.index],ko=row.exits[n.index].koDay;return [
            {value:name(n)+'\n'+exitTiming(n,n.index,row),bold:!!ko,fill:ko?mint:null},quantity(v.shares),asPrice(v.exitSpot),
            cash(v.proceeds),{value:asPrice(v.refund),bold:v.refund>0,fill:v.refund>0?mint:null},cash(v.nav),profit(v.pnl)];}),
          {headerHeight:9,rowHeight:8.25,bodySize:9});
      }
      wrap('Refund = payment less the cost of shares bought. A lower sale price can increase the loss. Each outcome depends on the assumed path.',margin,y,width,9.2,muted,false,4.3);
    }

    function niceStep(raw) {
      if (!(raw>0)) return .01;
      const base=10**Math.floor(Math.log10(raw));
      const multiple=raw/base;
      return (multiple<=1 ? 1 : multiple<=2 ? 2 : multiple<=2.5 ? 2.5 : multiple<=5 ? 5 : 10)*base;
    }
    function chart({top,height,series,band,days,levels=[],marker}) {
      const x0=37,x1=191,y0=top+height,y1=top+2;
      let min=Infinity,max=-Infinity;
      const add=v=>{if(Number.isFinite(v)){min=Math.min(min,v);max=Math.max(max,v);}};
      series.forEach(s=>s.points.forEach(p=>add(p[1])));
      if(band) [...band.upper,...band.lower].forEach(p=>add(p[1]));
      levels.forEach(l=>add(l.value));
      const span=Math.max(max-min,max*.05,.02), step=niceStep(span/4);
      const bottom=Math.max(0,Math.floor((min-span*.05)/step)*step);
      const ceiling=Math.ceil((max+span*.05)/step)*step;
      const x=d=>x0+(x1-x0)*d/days, y=v=>y0-(y0-y1)*(v-bottom)/(ceiling-bottom);
      if(band){
        const points=band.upper.concat([...band.lower].reverse()).map(p=>[x(p[0]),y(p[1])]);
        const vectors=points.slice(1).map((p,i)=>[p[0]-points[i][0],p[1]-points[i][1]]);
        doc.setFillColor('#DDECE5'); doc.lines(vectors,points[0][0],points[0][1],[1,1],'F',true);
      }
      for(let i=0;i<=Math.round((ceiling-bottom)/step);i++){
        const v=bottom+i*step;
        rule(x0,y(v),x1,y(v),line,.18);
        const vLabel=new Intl.NumberFormat('en-US',{maximumFractionDigits:step<.01?3:step<1?2:step<10?1:0}).format(v);
        text(vLabel,x0-2.6,y(v)+1,8,muted,false,'right');
      }
      const ticks=[0,Math.round(days/4),Math.round(days/2),Math.round(3*days/4),days];
      ticks.forEach(t=>{rule(x(t),y0,x(t),y0+1,muted,.2);text(t,x(t),y0+4.5,8,muted,false,'center');});
      text('USD',margin,y1+1,8,muted,true);text('Trading day',x1,y0+10,8,muted,false,'right');
      levels.forEach(l=>rule(x0,y(l.value),x1,y(l.value),l.color,.4,l.dash));
      series.forEach(({points,color,dash})=>{
        doc.setDrawColor(color);doc.setLineWidth(.66);doc.setLineDashPattern(dash||[],0);
        const xy=points.map(p=>[x(p[0]),y(p[1])]);
        const vectors=xy.slice(1).map((p,i)=>[p[0]-xy[i][0],p[1]-xy[i][1]]);
        if(vectors.length)doc.lines(vectors,xy[0][0],xy[0][1],[1,1],'S',false);
        doc.setLineDashPattern([],0);
      });
      if (marker) {
        const xx=x(marker.day), yy=y(marker.price), right=xx>x1-30;
        doc.setDrawColor(forest); doc.setFillColor(white); doc.setLineWidth(.65); doc.circle(xx,yy,1.3,'FD');
        text('KO day '+marker.day,xx+(right?-2.7:2.7),yy<y1+8?yy+4.6:yy-2.6,8.2,forest,true,right?'right':'left');
      }
    }
    function paths() {
      let y=startPage('The NVDA price paths','Read the price from left to right. The first chart shows the three assumed paths. The second places the selected scenario inside a range based on observed price volatility.');
      y=heading('Three paths used for the payouts',y+2)+2;
      const cases=[rows.early,rows.late,rows.down], colors=[forest,rose,navy], names=['Earlier rally','Later rally','Maturity case'];
      const horizon=cases[0].path.length;
      cases.forEach((r,i)=>{
        const x=margin+i*58; rule(x,y,x+9,y,colors[i],.7,i===1?[1.5,1.1]:[]);
        text(names[i],x+11,y+1.2,8.8,ink);
      });
      const points=r=>[[0,state.spot],...r.path.map((v,i)=>[i+1,v])];
      chart({top:y+6,height:53,days:horizon,series:cases.map((r,i)=>({points:points(r),color:colors[i],dash:i===1?[1.5,1.1]:[]}))});
      y+=78;
      const n=group[0], active=rows[state.active]||rows.early, ndays=n.terms.days;
      y=heading('Probability cone for '+name(n),y)+2;
      y=wrap('Selected path: '+active.name+(active.follow?' (original accumulator)':'')+'. Strike '+asPrice(n.terms.strike)+' and KO '+asPrice(n.terms.ko)+'.',margin,y,width,9.5,muted,false,4.6);
      const haveVol=Number.isFinite(market.vol)&&market.vol>=0;
      const band={upper:[],lower:[]};
      if(haveVol) {
        for(let d=0;d<=ndays;d++) {
          // Align the cone months to the same period boundaries as the calculator graph.
          let m=n.terms.monthEnds.findIndex(end=>end>=d);
          if(m<0)m=n.quote.months-1;
          const prev=m?n.terms.monthEnds[m-1]:0;
          const elapsed=m+(d-prev)/(n.terms.monthEnds[m]-prev);
          const [lo,hi]=Accumulator.cone(state.spot,market.vol,elapsed);
          band.upper.push([d,hi]);band.lower.push([d,lo]);
        }
      }
      const items=[['Selected path',navy,[]],['Strike',rose,[1.6,1.1]],['KO',forest,[2,1.1]]];
      items.forEach(([s,col,dash],i)=>{const x=margin+i*33;rule(x,y+2,x+7,y+2,col,.55,dash);text(s,x+9,y+3,8.4,ink);});
      if(haveVol){fill(118,y,7,4,'#DDECE5');text('10th to 90th percentile',128,y+3,8.4,ink);}
      chart({top:y+8,height:55,days:ndays,series:[{points:points(active).slice(0,ndays+1),color:navy}],
        band:haveVol?band:null,marker:active.exits[n.index]?.koDay?{day:active.exits[n.index].koDay,price:active.exits[n.index].price}:null,levels:[{value:n.terms.strike,color:rose,dash:[1.6,1.1]},{value:n.terms.ko,color:forest,dash:[2,1.1]}]});
      y+=79;
      const range=market.volStart?' between '+market.volStart+' and ':' through ';
      const note=haveVol?'The shaded middle 80% is a model range for NVDA at each future date. It uses '+fmt.rate(market.vol*100)+' annualised volatility from '+market.sessions+' daily log returns'+range+market.latest[0]+', assuming a flat median price. The stock can move outside the range. The band cannot tell you the probability of your note reaching KO or making a profit.'
                          :'A historical-volatility estimate is unavailable. Only the selected scenario, strike and KO are drawn.';
      box('How to read the shaded range',note,y,paper);
    }
    function maturity(){
      const s=state.settings, basis=rows[s.followBasisId];
      let y=startPage('After the structure ends','Start with the '+basis.name.toLowerCase()+' case. At maturity, shares can be held or sold later. An earlier knock-out leaves the modelled sale proceeds in cash.');
      y=heading('If you hold the shares',y+1);
      const hold=rows.hold,dec=rows.decu;
      const show=(label,get)=>[label,...group.map(n=>get(n,n.index))];
      y=matrix(y,'Valuation point',46,[
        show('Original structure ends',(n,i)=>exitTiming(n,i,basis)),
        show('NVDA at original exit',(n,i)=>asPrice(basis.values[i].exitSpot)),
        show('Value at original exit',(n,i)=>asPrice(basis.values[i].nav)),
        show('Shares still held',(n,i)=>quantity(hold.values[i].retained)),
        show('Later NVDA price',()=>asPrice(s.laterSpot)),
        show('Later total value',(n,i)=>({value:asPrice(hold.values[i].nav),bold:true})),
        show('Change since exit',(n,i)=>profit(hold.values[i].change)),
        show('P&L since investment',(n,i)=>profit(hold.values[i].pnl))
      ],{rowHeight:8});
      const example=group[0],i=example.index,held=hold.values[i],original=basis.values[i];
      y=box('How the change is calculated · '+example.letter,
        asPrice(held.nav)+' later total value less '+asPrice(original.nav)+' at exit = '+asPrice(held.change)+'. '+
        (held.retained?quantity(held.retained)+' shares × ('+asPrice(s.laterSpot)+' later price less '+asPrice(original.exitSpot)+' at exit) gives the same change.':'The model already sold the shares at KO. Cash stays flat after exit.'),y);
      y=heading('If you use a decumulator sale',y+1);
      y=wrap('Assume up to '+quantity(s.saleUnits)+' shares per structure sell at '+asPrice(s.saleStrike)+'. Remaining shares are valued at '+asPrice(s.laterSpot)+'. A prior KO keeps its original cash proceeds.',margin,y+1,width,9.3,muted,false,4.4);
      y=matrix(y,'Sale and remaining shares',46,[
        show('Shares sold / kept',(n,i)=>quantity(dec.values[i].sold)+' / '+quantity(dec.values[i].retained)),
        show('Sale proceeds',(n,i)=>cash(dec.values[i].proceeds)),
        show('Cash refunded',(n,i)=>asPrice(dec.values[i].refund)),
        show('Value of shares kept',(n,i)=>cash(dec.values[i].retainedValue)),
        show('Total value',(n,i)=>({value:cash(dec.values[i].nav),bold:true})),
        show('P&L since investment',(n,i)=>profit(dec.values[i].pnl))
      ],{rowHeight:7.4});
      wrap('The decumulator is a separate illustrative transaction. Examples exclude dividends, idle-cash interest, costs and taxes. Different execution prices change the result. Issuer default can cause a full loss. Final terms govern.',margin,y,width,9,muted,false,4.3);
    }
    for(let i=0;i<all.length;i+=batchSize){
      group=all.slice(i,i+batchSize);
      overview();outcomes();payouts();paths();maturity();
    }
    return doc;
  }

  function download(){
    const status=document.getElementById('report-status');
    try {
      const pdf=generate();
      const name='NVDA_Accumulator_Scenarios.pdf';
      pdf.save(name);
      if(status)status.textContent=pdf.getNumberOfPages()+'-page PDF generated. Open '+name+' in your downloads.';
    } catch(error) {
      if(status)status.textContent=error.message;
    }
  }
  window.AccumulatorReport={generate,download};
  document.getElementById('generate-report')?.addEventListener('click',download);
})();
