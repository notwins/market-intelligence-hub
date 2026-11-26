// Client export for the single contract plotted in the simulator.
(() => {
  'use strict';
  const fmt = window.AccumulatorFormat;
  const figures = window.FinancialDisplay;
  const navy = '#122B43', ink = '#25374B', muted = '#526477', teal = '#276976';
  const ai = '#6D28D9', lavender = '#F5F3FF', strike = '#7652A3', ko = '#497C31';
  const loss = '#A03543', line = '#D3DFE6', pale = '#F2F6FA';
  const cents = value => Math.round((value + Number.EPSILON * Math.abs(value)) * 100);
  function number(value,digits) {
    const result=figures.number(value,digits);
    if (result==='—') return 'n/a';
    return result==='≈0' ? (value<0?'>-':'<')+(10**-digits).toFixed(digits) : result;
  }
  const price = value => '$'+number(value,Math.abs(value)<1?4:2);
  const money = value => (value<0?'-':'')+'$'+number(Math.abs(value),Math.abs(value)>=1000?0:2);
  const signed = value => (value>0?'+':'')+money(value);
  const multiple = value => Number.isFinite(value)?number(value,1)+'×':'n/a';
  const pct = value => number(value,Math.abs(value)<1?2:1)+'%';
  const billion = value => number(value/1000,value<100000?2:1);
  const asDate = iso => new Intl.DateTimeFormat('en-GB', {
    day:'numeric', month:'short', year:'numeric', timeZone:'UTC'
  }).format(new Date(iso+'T00:00:00Z'));
  const asMonth = iso => asDate(iso).split(' ').slice(1).join(' ');

  // Consolidated GAAP USD millions and diluted EPS from the linked quarterly filings.
  const peers = [
    {ticker:'AMD',name:'AMD',end:'2026-09-26',revenue:13377,grossProfit:7210,operatingIncome:2832,netIncome:2428,dilutedEps:1.46,
      filing:'https://www.sec.gov/Archives/edgar/data/2488/000000248826000191/0000002488-26-000191-index.htm'},
    {ticker:'AVGO',name:'Broadcom',end:'2026-08-02',revenue:29591,grossProfit:20456,operatingIncome:15955,netIncome:13088,dilutedEps:2.68,
      filing:'https://www.sec.gov/Archives/edgar/data/1730168/000173016826000080/0001730168-26-000080-index.htm'}
  ];
  const beta2Url = new URL('../stocks-beta2.html',location.href).href;

  async function asset(path) {
    const response=await fetch('../'+path,{signal:AbortSignal.timeout(12000)});
    if (!response.ok) throw Error('Could not load '+path);
    return response;
  }
  async function logo(ticker) {
    try {
      const image=await createImageBitmap(await (await asset('assets/company-logos/'+ticker+'.webp')).blob());
      const canvas=document.createElement('canvas');
      canvas.width=image.width;
      canvas.height=image.height;
      canvas.getContext('2d').drawImage(image,0,0);
      image.close();
      return {data:canvas.toDataURL('image/png'),ratio:canvas.width/canvas.height};
    } catch {
      return null;
    }
  }
  async function valuations() {
    const [history,adjustments]=await Promise.all([
      asset('data/stocks-beta2-monthly-history.json?v=20261121').then(r=>r.json()),
      asset('data/stocks-beta2-history-adjustments.json').then(r=>r.json())
    ]);
    const charts=window.StocksBeta2Charts;
    return Object.fromEntries(['NVDA','AMD','AVGO'].map(ticker=>{
      const security=history.securities.find(company=>company.ticker===ticker+' US');
      const {data,company}=charts.chartHistory(history,security,adjustments);
      return [ticker,Object.fromEntries(['forward_pe','forward_pb'].map(metric=>[
        metric,charts.historyPoints(data,company,metric,0,data.months.length-1).map(p=>[p.quote,p.value])
      ]))];
    }));
  }

  function generate(selection, market, withResearch, logos, valuation) {
    if (!selection) throw Error('Enter a valid starting price and budget to prepare the sheet.');
    if (!window.jspdf?.jsPDF) throw Error('The PDF library is loading. Please try again.');
    const {quote:q, spot, capital, simulation:sim, path, usingDatedSpot} = selection;
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
      doc.setFont('times','bold'); doc.setFontSize(27); doc.setTextColor(navy);
      doc.text(title,15,33);
      mark('NVDA',181,23,14,12);
      rule(15,279,195,279);
      text('NVDA accumulator   /   USD',15,285,8.5,muted);
      text(page+' / '+sheetCount,195,285,8.5,muted,false,'right');
    }
    function mark(ticker,x,y,w,h) {
      const img=logos[ticker];
      if (!img) return;
      const width=Math.min(w,h*img.ratio);
      const height=width/img.ratio;
      doc.addImage(img.data,'PNG',x+(w-width)/2,y+(h-height)/2,width,height,ticker);
    }
    function metric(x,y,w,label,value,detail,color=teal) {
      fill(x,y,w,22,pale);
      fill(x,y,w,.8,color);
      text(label,x+3.5,y+5.5,8.7,muted,true);
      text(value,x+3.5,y+13.5,16,color,true,'left',w-7);
      text(detail,x+3.5,y+19,8.1,ink,false,'left',w-7);
    }
    function table(y,widths,head,rows,numericFrom,rowH=7.3,emphasis=widths.length-1) {
      [head,...rows].forEach((row,i)=>{
        if (i===0) fill(15,y,180,rowH,navy);
        else if (i%2===1) fill(15,y,180,rowH,'#F2F6FA');
        let x=15;
        row.forEach((v,j)=>{
          const align=j>=numericFrom?'right':'left';
          const negative=typeof v==='string' && v.startsWith('-$');
          text(v,align==='right'?x+widths[j]-2.4:x+2.4,y+rowH/2+1.1,i===0?8.7:9.5,
            i===0?'#FFFFFF':negative?loss:ink,i===0||j===emphasis,align,widths[j]-4.8);
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
    const perShare=(cents(spot)-cents(sim.strike))/100;
    const flatProfit=qty*(cents(spot)-cents(sim.strike))/100;
    fill(15,53,180,25,lavender);
    fill(15,53,1,25,ai);
    text(perShare>0?'Build an NVIDIA position at a '+pct(100*perShare/spot)+' discount':'Build an NVIDIA position at a fixed strike',19,60,13,navy,true);
    text((perShare===0?'Strike equals the reference.':price(Math.abs(perShare))+' '+(perShare>0?'below':'above')+' reference per share.')+
      ' If NVDA stays flat through maturity, gross P&L is '+signed(flatProfit)+'.',
      19,67,10,ink,true,'left',172);
    text('A sale below strike incurs a loss. A rally can end purchases early and limit participation.',
      19,73,9.5,muted,false,'left',172);
    metric(15,83,43,'Reference price',price(spot),
      usingDatedSpot?'Close '+asDate(market.latest[0]):'Manual starting price');
    metric(60.7,83,43,'Purchase strike',price(sim.strike),fmt.quote(q.strike)+' of reference',strike);
    metric(106.4,83,43,'Daily knock-out',price(sim.ko),fmt.quote(q.ko)+' of reference',ko);
    metric(152,83,43,'Modeled payment',money(sim.payment),'Target '+money(capital),navy);
    text('Share commitment',15,114,13,navy,true);
    text(fmt.shares(sim.maximum)+' shares per month   /   '+fmt.shares(qty)+' shares over the full tenor',15,120,10.5,ink,true);
    text(q.minimum+'-month guarantee: '+fmt.shares(sim.maximum*q.minimum)+' shares. '+sim.days+' trading days in the model.',15,126,9.5,muted);
    rule(15,131,195,131);
    text('If NVDA knocks out during the guarantee',15,138,13,navy,true);
    const early = window.AccumulatorModel.simulateDaily(q,spot,capital,Array(sim.days).fill(sim.ko)).exit;
    text('Assume the first daily close reaches '+price(sim.ko)+' and the '+fmt.shares(early.shares)+' guaranteed shares sell at that price.',15,144,9.5);
    text('Unused capital refunded',15,152,9,muted); text('Gross profit on the shares',108,152,9,muted);
    text(money(early.refunded),15,159,14,ink,true); text(signed(early.profit),108,159,14,early.profit<0?loss:teal,true);
    text('If all shares are purchased',15,173,13,navy,true);
    text('Assume no knock-out before maturity. Sell all '+fmt.shares(qty)+' shares at the price shown.',15,179,9.5);
    const values=[['35% below reference',Math.round(cents(spot)*.65)],
      ['15% below reference',Math.round(cents(spot)*.85)],['Break-even',cents(sim.strike)],
      ['Flat at reference',cents(spot)]];
    if (cents(sim.ko)-cents(spot)>1) {
      values.push(['Halfway to knock-out', Math.floor((cents(spot)+cents(sim.ko))/2)]);
    }
    values.sort((a,b)=>a[1]-b[1]);
    const payouts=values.map(([label,saleCents])=>[label,price(saleCents/100),money(qty*saleCents/100),
      signed(qty*(saleCents-cents(sim.strike))/100)]);
    table(183,[62,34,43,41],['At sale','NVDA price','Share proceeds','Gross P&L'],payouts,1);
    text('Your selected path',15,237,12,navy,true);
    const current=sim.exit;
    text(path+'  /  '+(sim.koDay?'Knock-out on day '+sim.koDay:'Maturity')+' at '+price(current.price),15,243,10);
    text(fmt.shares(current.shares)+' shares   /   '+money(current.refunded)+' refunded   /   '+signed(current.profit)+' gross P&L',15,249,10,ink,true);
    paragraph('Display precision varies by size. Figures use the simulator values before display rounding.',256,180,9);
    paragraph('Capital is at risk. Buying continues through a fall until maturity or knock-out. Worthless shares or issuer default can cause a total loss. Scenarios exclude fees, taxes, dividends and interest. Final issuer terms govern.',265,180,9.2);
    if (!withResearch) return doc;

    doc.addPage();
    header('NVIDIA investment profile',2);
    const f=window.AccumulatorNvdaFinancialData;
    if (!f) throw Error('Financial statements are unavailable. The one-page pricing sheet is available.');
    const companies=[{ticker:'NVDA',name:'NVIDIA',end:f.periodEnd,...f.income,filing:f.sources[0].url},...peers];
    paragraph('NVIDIA combines AI accelerators, networking and CUDA software. The integrated platform supports demand for full data-centre systems. AMD competes with Instinct accelerators. Broadcom serves custom-chip and networking demand.',43,180,10.3,ink);
    paragraph('What to watch: spending by large cloud customers, custom chips, export limits and changing valuations.',61,180,9.5);

    function chart(x,title,points,valueLabel,color) {
      const top=84,bottom=118,left=x+13,right=x+56;
      text(title,x,77,10.5,navy,true,'left',57);
      if (points.length<2) {
        text('History unavailable',x,98,9,muted);
        return;
      }
      const [first,last]=[points[0],points.at(-1)];
      const range=points.map(p=>p[1]);
      const low=Math.min(...range),high=Math.max(...range);
      const pad=Math.max((high-low)*.10,high*.025,.01);
      const min=Math.max(0,low-pad),max=high+pad;
      const start=Date.parse(first[0]),end=Date.parse(last[0]);
      const px=date=>left+(right-left)*(Date.parse(date)-start)/(end-start);
      const py=value=>bottom-(bottom-top)*(value-min)/(max-min);
      for (const level of [min,(min+max)/2,max]) {
        rule(left,py(level),right,py(level));
        text(valueLabel(level),left-1.3,py(level)+1,7.2,muted,false,'right',11.7);
      }
      points.slice(1).forEach(([date,value],i)=>{
        const prior=points[i];
        rule(px(prior[0]),py(prior[1]),px(date),py(value),color,.55);
      });
      doc.setFillColor(color); doc.circle(px(last[0]),py(last[1]),.95,'F');
      text(asMonth(first[0]),left,123,7.7,muted);
      text(asMonth(last[0]),right,123,7.7,muted,false,'right');
      text(valueLabel(last[1])+' on '+asDate(last[0]),x,130,9,ink,true,'left',57);
    }

    const latest=market.latest;
    const cutoff=new Date(latest[0]+'T00:00:00Z');
    cutoff.setUTCDate(1); cutoff.setUTCFullYear(cutoff.getUTCFullYear()-1);
    const from=cutoff.toISOString().slice(0,10), month=latest[0].slice(0,7);
    const prices=market.ordered.filter(([date,value])=>date>=from && date.slice(0,7)<month && Number.isFinite(value));
    prices.push(latest);
    const pe=valuation?.NVDA?.forward_pe.slice(-13) ?? [];
    const pb=valuation?.NVDA?.forward_pb.slice(-13) ?? [];
    chart(15,'NVDA share price (USD)',prices,price,ai);
    chart(77,'Forward P/E (×)',pe,multiple,'#326D9F');
    chart(139,'Forward P/B (×)',pb,multiple,'#8554A1');
    paragraph('Left shows split-adjusted closes. P/E and P/B show price per dollar of estimated earnings and book value. The valuation charts use dated Beta 2 monthly observations and their own scales.',137,180,9);
    if (pe.length>=2 && pb.length>=2) {
      text('Over the periods shown, P/E moved from '+multiple(pe[0][1])+' to '+multiple(pe.at(-1)[1])+
        ' and P/B from '+multiple(pb[0][1])+' to '+multiple(pb.at(-1)[1])+'.',15,147,9,navy,true);
    }

    text('NVIDIA, AMD and Broadcom',15,159,14,navy,true);
    text('Latest available quarterly filings. USD billions except EPS and margins.',15,165,9.3,muted);
    companies.forEach((c,i)=>mark(c.ticker,62+i*45,167,40,9));
    const datedPeers=companies.map(({ticker})=>{
      const series=valuation?.[ticker];
      const pe=series?.forward_pe.at(-1), pb=series?.forward_pb.at(-1);
      return pe && pb && pe[0]===pb[0] ? {date:pe[0],pe:pe[1],pb:pb[1]} : null;
    });
    const ratioDate=datedPeers[0]?.date;
    const commonValuations=datedPeers.map(row=>row?.date===ratioDate?row:null);
    const metricRow=(label,get)=>[label,...companies.map(get)];
    table(178,[45,45,45,45],['Company','NVIDIA','AMD','Broadcom'],[
      metricRow('Quarter ended',c=>asDate(c.end)),
      metricRow('Revenue',c=>billion(c.revenue)),
      metricRow('Gross margin',c=>pct(c.grossProfit/c.revenue*100)),
      metricRow('Operating income',c=>billion(c.operatingIncome)),
      metricRow('Operating margin',c=>pct(c.operatingIncome/c.revenue*100)),
      metricRow('Net income',c=>billion(c.netIncome)),
      metricRow('Diluted EPS',c=>price(c.dilutedEps)),
      ['Forward P/E',...commonValuations.map(r=>multiple(r?.pe))],
      ['Forward P/B',...commonValuations.map(r=>multiple(r?.pb))]
    ],1,6.45,1);
    text(ratioDate?'Forward multiples as of '+asDate(ratioDate)+'. Differences in business mix and quarter-ends affect comparisons.':
      'Forward multiples unavailable. Differences in business mix and quarter-ends affect comparisons.',15,248,9,muted);
    paragraph('NVIDIA leads this group on operating margin in the reported quarters. Forward estimates can change.',255,180,9.3,navy);
    const sources=[['NVDA closes','https://finance.yahoo.com/quote/NVDA/history/'],
      ['Stocks Beta 2',beta2Url],...companies.map(c=>[c.name+' filing',c.filing])];
    let sourceX=15;
    text('Sources',sourceX,269,9,navy,true);
    sourceX+=15;
    for (const [label,url] of sources) {
      type(9,false,teal);
      doc.textWithLink(label,sourceX,269,{url});
      sourceX+=doc.getTextWidth(label)+6;
    }
    return doc;
  }

  let downloading=false;
  async function download(withResearch) {
    if (downloading) return;
    downloading=true;
    const status=document.getElementById('sheet-status');
    const panel=document.getElementById('client-sheet');
    panel.setAttribute('aria-busy','true');
    status.textContent='Preparing client PDF…';
    try {
      const selection=window.AccumulatorMarket.getClientSelection();
      if (!selection) throw Error('Enter a valid starting price and budget to prepare the sheet.');
      const market=window.AccumulatorMarket.getState();
      const tickers=withResearch?['NVDA','AMD','AVGO']:['NVDA'];
      const [images,valuation]=await Promise.all([
        Promise.all(tickers.map(logo)),
        withResearch?valuations().catch(()=>null):null
      ]);
      const logos=Object.fromEntries(tickers.map((ticker,index)=>[ticker,images[index]]));
      const pdf=generate(selection,market,withResearch,logos,valuation);
      pdf.save(withResearch?'NVDA_Pricing_Payoffs_and_Research.pdf':'NVDA_Pricing_and_Payoffs.pdf');
      status.textContent=withResearch?'Two-page client PDF downloaded.':'One-page client PDF downloaded.';
    } catch(error) {
      status.textContent=error.message;
    } finally {
      downloading=false;
      panel.removeAttribute('aria-busy');
    }
  }
  document.getElementById('sheet-pricing').addEventListener('click',()=>download(false));
  document.getElementById('sheet-research').addEventListener('click',()=>download(true));
})();
