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
    const batchSize = 3;
    const numberOfPages = Math.ceil(all.length / batchSize) * 4;
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
    const KO=(n,i,r)=>r.exits[i].koDay ? 'KO d'+r.exits[i].koDay : 'Maturity d'+n.terms.days;
    function winner(row) {
      const ids=row.winners || [];
      if (ids.length===all.length && ids.length>1) return 'All tied';
      return ids.map(i=>all[i].letter).join(' / ')||'';
    }
    function overview() {
      let y=startPage('Your NVDA comparison','A funded Normal accumulator buys a scheduled number of NVDA shares at an agreed price. The daily knock-out level determines how long purchases continue.');
      const cells=[['TARGET BUDGET',cash(state.target)],['TRADE-DAY PRICE',asPrice(state.spot)],['STRUCTURES SELECTED',quantity(all.length)]];
      cells.forEach(([label,value],i)=>{
        const x=margin+i*61;
        fill(x,y,58,23,i===0?mint:paper);
        text(label,x+4,y+7,8,muted,true);text(value,x+4,y+16,16,navy,true);
      });
      y=heading('Indicative terms and actual payment',y+37);
      y=table(y,['Structure','Tenor /\nguarantee','Strike','Daily KO','Shares /\nmonth','Payment'],[26,27,30,28,26,43],
        group.map(n=>[name(n),n.quote.months+'m / '+n.quote.minimum+'m'+(Number.isInteger(n.quote.guaranteedDays)?'\n'+n.quote.guaranteedDays+' quoted days':''),
          asPrice(n.terms.strike)+'\n'+fmt.quote(n.quote.strike),asPrice(n.terms.ko)+'\n'+fmt.quote(n.quote.ko),
          quantity(n.terms.maximum),{value:cash(n.terms.payment),bold:true}]),{rowHeight:14,headerHeight:12});
      const vintage=group.some(n=>n.quote.months===12) ? ' The 12-month JPM row is an earlier indicative example.' : '';
      y=wrap('Pricing sheets dated 23 Nov 2026. Strike and KO percentages refer to the trade-day price. All quotes have monthly settlement. JPM issues the structured note (SN). OCBC issues the structured investment (SI).'+vintage,margin,y+1,width,9.3,muted)+6;
      const example=group[0], t=example.terms, q=example.quote;
      y=box('How '+example.letter+' is sized',
        'Target budget ÷ purchase price ÷ months gives '+quantity(t.maximum)+' shares per month after rounding to the nearest whole share. '+quantity(t.maximum)+' × '+asPrice(t.strike)+' × '+q.months+' = '+asPrice(t.committed)+'. The payment rounds up to '+cash(t.payment)+'. Any rounding cash is refundable.',y);
      y=heading('What happens to your money?',y+1);
      y=wrap('While the note is active, each eligible daily close below KO earns the scheduled shares at strike. Purchases continue even when the market falls below the strike.',margin,y+3,width);
      y=wrap('If KO occurs during the guarantee, all guaranteed months of shares are bought. After the guarantee, the model counts shares earned through the trading day before KO. Unused cash comes back.',margin,y+4,width);
      wrap('Total value equals cash refunded, plus any sale proceeds and the value of shares still held. P&L is total value less the actual payment.',margin,y+4,width,10,forest,true);
    }
    function payouts() {
      let y=startPage('How much comes back?','These three paths use the same NVDA prices for every structure. Each calculation assumes you sell the shares at the observed KO close or at maturity.');
      const cases=[rows.early,rows.late,rows.down];
      for (const row of cases) {
        y=heading(row.name,y+3);
        const summary=row.id==='down'
          ? 'NVDA reaches '+asPrice(row.path[row.path.length-1])+' by the earliest maturity and then stays there.'
          : 'The price jumps to '+asPrice(state.settings.rally)+' on trading day '+(row.id==='early'?state.settings.earlyDay:state.settings.lateDay)+'.';
        const leader=all.length>1?'    Highest '+(state.metric==='rate'?'return':'P&L')+'*  '+winner(row):'';
        y=wrap(summary+leader,margin,y+2,width,9.2,muted,false,4.4)-4.4;
        y=table(y+5,['Structure / exit','Shares\nbought','Sale\nproceeds','Cash\nrefunded','Total value','P&L','Return'],[27,17,29,28,31,28,20],
          group.map(n=>{const v=row.values[n.index];return [name(n)+'\n'+KO(n,n.index,row),quantity(v.shares),cash(v.proceeds),cash(v.refund),cash(v.nav),profit(v.pnl),netRate(v.rate)];}),
          {headerHeight:10,rowHeight:11,bodySize:9.1});
      }
      wrap((all.length>1?'*Ranked across all selected structures. ':'')+'Sale proceeds = shares bought × observed sale price. Refund = payment less share cost. A gap above KO uses the observed close. Actual execution may differ.',margin,y+2,width,9.2,muted);
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
      const range=market.volStart?' from '+market.volStart+' through ':' through ';
      const note=haveVol?'The shaded middle 80% is a model range for NVDA at each future date. It uses '+fmt.rate(market.vol*100)+' annualised volatility from '+market.sessions+' daily log returns'+range+market.latest[0]+', assuming a flat median price. The stock can move outside the range. The band cannot tell you the probability of your note reaching KO or making a profit.'
                          :'A historical-volatility estimate is unavailable. Only the selected scenario, strike and KO are drawn.';
      box('How to read the shaded range',note,y,paper);
    }
    function maturity(){
      let y=startPage('At maturity and afterwards','A price below strike gives the shares a loss at that price. Holding them keeps both the risk of a further fall and the opportunity to benefit from a recovery.');
      const w=125/group.length;
      const matrixHeaders=['Scenario',...group.map(name),'Highest*'];
      y=table(y,matrixHeaders,[35,...group.map(()=>w),20],
        [rows.down,rows.flat,rows.near,rows.hold,rows.decu].map(r=>
          [r.name,...group.map(n=>({value:fmt.signedMoney(r.values[n.index].pnl)+'\n'+netRate(r.values[n.index].rate),color:r.values[n.index].pnl<0?rose:forest,bold:true})),winner(r)]),{rowHeight:13,headerHeight:10});
      y=wrap('*Ranked across all selected structures by '+(state.metric==='rate'?'return on actual payment':'dollar P&L')+'. Each cell shows P&L since investment and return on payment. In a loss scenario, the highest result is the smallest loss.',margin,y+1,width,9.1,muted,false,4.3)+5;
      const s=state.settings;
      const basis=rows[s.followBasisId];
      y=heading('Two ways to handle shares you still own',y+2);
      y=wrap('Start with the '+basis.name.toLowerCase()+' case and value remaining shares later at '+asPrice(s.laterSpot)+'. The sale example assumes up to '+quantity(s.saleUnits)+' shares per note sell at '+asPrice(s.saleStrike)+'. An earlier KO leaves the proceeds in cash.',margin,y+2,width,9.8,ink,false,4.7)+2;
      y=table(y,['Structure','Shares\nsold','Sale\nproceeds','Shares\nkept','Value\nkept','Cash\nrefunded','Total\nvalue'],[24,18,29,18,31,28,32],
        group.map(n=>{const v=rows.decu.values[n.index];return [name(n),quantity(v.sold),cash(v.proceeds),quantity(v.retained),cash(v.retainedValue),cash(v.refund),cash(v.nav)];}),{rowHeight:10,headerHeight:11});
      y=wrap('A decumulator is a separate transaction. The training example uses cash funding. Actual sale quantities and timing depend on its own terms. Unsold shares can fall and selling at the agreed strike gives up a larger rebound on those shares.',margin,y+1,width,9.6,ink,false,4.55)+3;
      box('What can change the result?','Examples assume immediate sales at the stated prices and zero interest on idle cash. Dividends, taxes and trading costs are excluded. Early exit can produce a loss. Issuer default can cause the loss of the full amount invested. Final trade terms govern.',y,blush);
    }
    for(let i=0;i<all.length;i+=batchSize){
      group=all.slice(i,i+batchSize);
      overview();payouts();paths();maturity();
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
