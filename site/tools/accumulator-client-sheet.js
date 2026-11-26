// Client export for the single contract plotted in the simulator.
(() => {
  'use strict';
  const fmt = window.AccumulatorFormat;
  const navy = '#172A42', ink = '#25374B', muted = '#4A5C6E', teal = '#306162';
  const purple = '#665778', loss = '#9D3839', line = '#D8E2EB', pale = '#EDF5F4';
  const signed = value => (value > 0 ? '+' : '') + fmt.price(value);
  const cents = value => Math.round((value + Number.EPSILON * Math.abs(value)) * 100);
  const asDate = iso => new Intl.DateTimeFormat('en-GB', {
    day:'numeric', month:'short', year:'numeric', timeZone:'UTC'
  }).format(new Date(iso+'T00:00:00Z'));
  const billion = usdMillions => '$'+(usdMillions/1000).toFixed(2)+'bn';

  // Consolidated GAAP USD millions from the indicated quarterly filings.
  const peers = [
    {name:'AMD', focus:'Instinct GPUs, EPYC CPUs', end:'2026-09-26', revenue:13377, operatingIncome:2832,
      filing:'https://www.sec.gov/Archives/edgar/data/2488/000000248826000191/0000002488-26-000191-index.htm'},
    {name:'Broadcom', focus:'Custom AI chips, networking', end:'2026-08-02', revenue:29591, operatingIncome:15955,
      filing:'https://www.sec.gov/Archives/edgar/data/1730168/000173016826000080/0001730168-26-000080-index.htm'}
  ];

  function generate(withResearch) {
    const selection = window.AccumulatorMarket.getClientSelection();
    if (!selection) throw Error('Enter a valid starting price and budget to prepare the sheet.');
    if (!window.jspdf?.jsPDF) throw Error('The PDF library is loading. Please try again.');
    const {quote:q, spot, capital, simulation:sim, path, usingDatedSpot} = selection;
    const market = window.AccumulatorMarket.getState();
    const doc = new window.jspdf.jsPDF({format:'a4',unit:'mm',compress:true,putOnlyUsedFonts:true});
    doc.setProperties({title:'NVDA accumulator | Client pricing and payoffs',author:'Market Intelligence Hub'});
    const sheetCount = withResearch ? 2 : 1;

    function type(size, bold, color) {
      doc.setFont('helvetica',bold?'bold':'normal'); doc.setFontSize(size); doc.setTextColor(color);
    }
    function text(value,x,y,size=10,color=ink,bold=false,align='left',maxWidth=180) {
      type(size,bold,color);
      const str=String(value);
      if (doc.getTextWidth(str)>maxWidth) doc.setFontSize(size*maxWidth/doc.getTextWidth(str));
      doc.text(str,x,y,{align});
    }
    function paragraph(str,y,w=180,size=10,color=muted) {
      type(size,false,color);
      doc.text(doc.splitTextToSize(str,w),15,y,{lineHeightFactor:1.25});
    }
    function rule(x1,y1,x2,y2,color=line,weight=.25) {
      doc.setDrawColor(color); doc.setLineWidth(weight); doc.line(x1,y1,x2,y2);
    }
    function fill(x,y,w,h,color) {
      doc.setFillColor(color); doc.rect(x,y,w,h,'F');
    }
    function header(title,page) {
      text('MARKET INTELLIGENCE HUB',15,15,9,teal,true);
      text('NVDA  /  '+(page===1?'PRICING':'RESEARCH'),195,15,9,muted,true,'right');
      rule(15,19,195,19);
      text(title,15,33,24,navy,true);
      rule(15,279,195,279);
      text('NVDA accumulator   /   USD',15,285,8.5,muted);
      text(page+' / '+sheetCount,195,285,8.5,muted,false,'right');
    }
    function metric(x,y,w,label,value,detail,color=teal) {
      fill(x,y,w,25,pale);
      text(label,x+3.5,y+6.3,9,muted,true);
      text(value,x+3.5,y+15,17,color,true,'left',w-7);
      text(detail,x+3.5,y+21.4,8.7,ink,false,'left',w-7);
    }
    function table(y,widths,head,rows,numericFrom) {
      const rowH=8.3;
      [head,...rows].forEach((row,i)=>{
        if (i===0) fill(15,y,180,rowH,navy);
        else if (i%2===1) fill(15,y,180,rowH,'#F2F6FA');
        let x=15;
        row.forEach((v,j)=>{
          const align=j>=numericFrom?'right':'left';
          const negative=typeof v==='string' && v.startsWith('-$');
          text(v,align==='right'?x+widths[j]-2.4:x+2.4,y+5.5,i===0?8.7:9.5,
            i===0?'#FFFFFF':negative?loss:ink,i===0||j===row.length-1,align,widths[j]-4.8);
          x+=widths[j];
        });
        y+=rowH;
      });
      return y;
    }

    const qty = sim.maximum*q.months;
    header('NVDA pricing & payoffs',1);
    text(q.product+'   /   '+q.months+' months   /   Monthly settlement   /   Normal accumulator',15,41,11,ink,true);
    text('Indicative pricing as of '+Accumulator.indicationDates([q]),15,48,10,muted);
    metric(15,54,88,'Reference price',fmt.price(spot),
      usingDatedSpot?'NVDA close on '+asDate(market.latest[0]):'Manually entered starting price');
    metric(107,54,88,'Modeled payment',fmt.money(sim.payment),'Target budget '+fmt.price(capital),navy);
    metric(15,82,88,'Purchase strike',fmt.price(sim.strike),
      fmt.quote(q.strike)+' of reference  /  '+fmt.quote(100-q.strike)+' discount');
    metric(107,82,88,'Daily knock-out',fmt.price(sim.ko),
      fmt.quote(q.ko)+' of reference',purple);
    text('Share commitment',15,117,13.5,navy,true);
    text(fmt.shares(sim.maximum)+' shares per month   /   '+fmt.shares(qty)+' shares over the full tenor',15,124,11,ink,true);
    text(q.minimum+'-month guarantee: '+fmt.shares(sim.maximum*q.minimum)+' shares.  '+sim.days+' trading days in the model.',15,130,10,muted);
    rule(15,135,195,135);
    text('If NVDA knocks out during the guarantee',15,143,13.5,navy,true);
    const early = window.AccumulatorModel.simulateDaily(q,spot,capital,Array(sim.days).fill(sim.ko)).exit;
    text('Assume the first daily close reaches '+fmt.price(sim.ko)+' and the '+fmt.shares(early.shares)+' guaranteed shares sell at that price.',15,150,10);
    text('Unused capital refunded',15,158,9,muted); text('Gross profit on the shares',108,158,9,muted);
    text(fmt.price(early.refunded),15,165,14,ink,true); text(signed(early.profit),108,165,14,early.profit<0?loss:teal,true);
    text('If all shares are purchased',15,179,13.5,navy,true);
    text('Assume no knock-out before maturity. Sell all '+fmt.shares(qty)+' shares at the price shown.',15,186,10);
    const values=[['35% below reference',Math.round(cents(spot)*.65)],
      ['15% below reference',Math.round(cents(spot)*.85)],['Break-even',cents(sim.strike)],
      ['Flat at reference',cents(spot)]];
    if (cents(sim.ko)-cents(spot)>1) {
      values.push(['Halfway to knock-out', Math.floor((cents(spot)+cents(sim.ko))/2)]);
    }
    values.sort((a,b)=>a[1]-b[1]);
    const payouts=values.map(([label,price])=>[label,fmt.price(price/100),fmt.price(qty*price/100),
      signed(qty*(price-cents(sim.strike))/100)]);
    table(190,[62,34,43,41],['At sale','NVDA price','Share proceeds','Gross P&L'],payouts,1);
    text('Your selected path',15,248,12,navy,true);
    const current=sim.exit;
    text(path+'  /  '+(sim.koDay?'Knock-out on day '+sim.koDay:'Maturity')+' at '+fmt.price(current.price),15,254,10);
    text(fmt.shares(current.shares)+' shares   /   '+fmt.price(current.refunded)+' refunded   /   '+signed(current.profit)+' gross P&L',15,260,10,ink,true);
    paragraph('Capital is at risk. Buying continues through a fall until maturity or knock-out. Worthless shares or issuer default can cause a total loss. Scenarios exclude fees, taxes, dividends and interest. Final issuer terms govern.',269,180,9.2);
    if (!withResearch) return doc;

    doc.addPage();
    header('NVIDIA in context',2);
    const latest=market.latest;
    const cutoff=new Date(latest[0]+'T00:00:00Z');
    cutoff.setUTCFullYear(cutoff.getUTCFullYear()-1);
    cutoff.setUTCDate(1);
    const from=cutoff.toISOString().slice(0,10);
    const latestMonth=latest[0].slice(0,7);
    const points=market.ordered.filter(([date,value])=>date>=from && date.slice(0,7)<latestMonth && Number.isFinite(value));
    points.push(latest);
    text('NVDA share price',15,46,14,navy,true);
    text('Split-adjusted monthly closes in USD, including the latest available close.',15,53,10,muted);
    if (points.length>=2) {
      const first=points[0], last=points[points.length-1];
      const prices=points.map(point=>point[1]);
      const low=Math.min(...prices), high=Math.max(...prices);
      const pad=Math.max((high-low)*.10,high*.025,.01);
      const min=Math.max(0,low-pad), max=high+pad;
      const left=34,right=190,top=62,bottom=106;
      const start=Date.parse(first[0]), end=Date.parse(last[0]);
      const x=date=>left+(right-left)*(Date.parse(date)-start)/(end-start);
      const y=value=>bottom-(bottom-top)*(value-min)/(max-min);
      for(let i=0;i<3;i++){
        const val=min+(max-min)*i/2;
        rule(left,y(val),right,y(val));
        text(fmt.money(val),left-3,y(val)+1.3,8.5,muted,false,'right',17);
      }
      points.slice(1).forEach(([date,value],i)=>rule(x(points[i][0]),y(points[i][1]),x(date),y(value),teal,.7));
      doc.setFillColor(teal);doc.circle(x(last[0]),y(last[1]),1.2,'F');
      text(asDate(first[0]).split(' ').slice(1).join(' '),left,113,8.7,muted);
      if (points.length>4) {
        const middle=points[Math.floor(points.length/2)];
        text(asDate(middle[0]).split(' ').slice(1).join(' '),x(middle[0]),113,8.7,muted,false,'center');
      }
      text(asDate(last[0]),right,113,8.7,muted,false,'right');
      text('Closing price '+fmt.price(last[1])+' on '+asDate(last[0]),15,121,10,ink,true);
    } else {
      text('Insufficient dated closes for a historical line.',15,83,11,muted);
      text('Available close '+fmt.price(latest[1])+' on '+asDate(latest[0]),15,121,10,ink,true);
    }
    const f=window.AccumulatorNvdaFinancialData;
    if (!f) throw Error('Financial statements are unavailable. The one-page pricing sheet is available.');
    text('NVIDIA fundamentals',15,137,14,navy,true);
    text(f.quarter+'   /   Quarter ended '+asDate(f.periodEnd)+'   /   GAAP',15,144,10,muted);
    metric(15,150,57,'Revenue',billion(f.income.revenue),'Company-wide');
    metric(76.5,150,57,'Net income',billion(f.income.netIncome),'Quarterly earnings');
    metric(138,150,57,'Diluted EPS',fmt.price(f.income.dilutedEps),'Per share for the quarter');
    text('How the chip businesses compare',15,189,14,navy,true);
    text('Reported quarterly results in USD. Operating margin is operating income divided by revenue.',15,196,10,muted);
    const companies=[{name:'NVIDIA',focus:'GPUs, systems, networking',end:f.periodEnd,
      revenue:f.income.revenue,operatingIncome:f.income.operatingIncome},...peers];
    table(201,[29,60,33,31,27],['Company','Competitive focus','Quarter end','Revenue','Op. margin'],
      companies.map(c=>[c.name,c.focus,asDate(c.end),billion(c.revenue),(100*c.operatingIncome/c.revenue).toFixed(1)+'%']),2);
    paragraph('Figures cover each entire company. AMD also sells PC processors and Broadcom includes infrastructure software. Their different business mixes and quarter-ends affect the comparison.',243,180,9.8);
    text('Sources',15,261,10,navy,true);
    const sources=[['NVDA price history','https://finance.yahoo.com/quote/NVDA/history/'],
      ['NVIDIA results',f.sources[0].url],['AMD 10-Q',peers[0].filing],['Broadcom 10-Q',peers[1].filing]];
    let sourceX=15;
    for (const [label,url] of sources) {
      type(9.5,false,teal);
      doc.textWithLink(label,sourceX,268,{url});
      sourceX+=doc.getTextWidth(label)+9;
    }
    return doc;
  }

  function download(withResearch) {
    const status=document.getElementById('sheet-status');
    try {
      const pdf=generate(withResearch);
      pdf.save(withResearch?'NVDA_Pricing_Payoffs_and_Research.pdf':'NVDA_Pricing_and_Payoffs.pdf');
      status.textContent=withResearch?'Two-page client PDF downloaded.':'One-page client PDF downloaded.';
    } catch(error) {
      status.textContent=error.message;
    }
  }
  document.getElementById('sheet-pricing').addEventListener('click',()=>download(false));
  document.getElementById('sheet-research').addEventListener('click',()=>download(true));
})();
