/* Connect the published narration to the same selected quote, fixing and P&L as the tables. */
(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const storageKey = 'gld-game-plan.walkthrough-wording.v1';
  let api, script, lines, moving = false, enabled = false;
  const tokens = text => [...new Set(text.match(/\{[A-Za-z]+\}/g) || [])];
  const replace = (text, values) => text.replace(/\{([A-Za-z]+)\}/g, (_, k) => String(values[k]));
  const cents = n => Math.round((n + Number.EPSILON) * 100);
  function beforeChange() {
    if (!moving && window.GldGuidePlayer?.active()) GldGuidePlayer.stop();
  }
  function ready(value) {
    beforeChange();
    enabled = Boolean(value && lines && window.GldGuidePlayer);
    const button=$('play-walkthrough');
    if (button) button.disabled=!enabled;
  }
  function validLine(key, pair) {
    if (!Object.hasOwn(script.lines, key) || !Array.isArray(pair) || pair.length !== 2) return false;
    if (pair.some((s,i) => typeof s !== 'string' || !s.trim() || s.length > (i ? 2000 : 140))) return false;
    const allowed = tokens(script.lines[key][1]);
    return !/[{}]/.test(pair[0]) && !/[{}]/.test(pair[1].replace(/\{[A-Za-z]+\}/g,'')) &&
      tokens(pair[1]).every(t => allowed.includes(t));
  }
  function editor() {
    const select = $('guide-line'), title = $('guide-heading'), text = $('guide-line-text'), status = $('guide-status');
    lines = structuredClone(script.lines);
    try {
      const overrides = JSON.parse(localStorage.getItem(storageKey)) || {};
      for (const [key,row] of Object.entries(overrides)) if (validLine(key,row)) lines[key] = row;
    } catch { /* The published script is always available. */ }
    const draft = structuredClone(lines);
    for (const [key,row] of Object.entries(script.lines)) select.add(new Option(row[0],key));
    function show() {
      const key = select.value;
      [title.value,text.value] = draft[key];
      const names = tokens(script.lines[key][1]);
      $('guide-tokens').textContent = names.length ? 'Available fields · '+names.join('  ') : 'This line uses plain text.';
    }
    function rememberDraft() {
      draft[select.value] = [title.value,text.value];
      status.textContent = 'Draft edits. Save to use this wording in the walkthrough.';
    }
    function validate() {
      const invalid = Object.keys(draft).find(key=>!validLine(key,draft[key]));
      if (!invalid) return true;
      select.value=invalid;show();text.focus();
      status.textContent = 'Check the heading and narration. Use the listed fields inside a single pair of braces.';
      return false;
    }
    select.addEventListener('change',show);
    title.addEventListener('input',rememberDraft);text.addEventListener('input',rememberDraft);
    $('guide-reset').addEventListener('click',()=>{
      draft[select.value]=[...script.lines[select.value]];show();
      status.textContent='Published line restored to the draft. Save to apply it.';
    });
    $('guide-save').addEventListener('click',()=>{
      if (!validate()) return;
      const changes=Object.fromEntries(Object.entries(draft).filter(([key,row])=>row.some((value,i)=>value!==script.lines[key][i])));
      beforeChange();lines=structuredClone(draft);
      try {
        if (Object.keys(changes).length) localStorage.setItem(storageKey,JSON.stringify(changes));
        else localStorage.removeItem(storageKey);
        status.textContent='Walkthrough wording saved in this browser.';
      } catch { status.textContent='Wording applied for this visit. Browser storage is unavailable. Download the script to keep your edits.'; }
    });
    $('guide-export').addEventListener('click',()=>{
      if (!validate()) return;
      const blob=new Blob([JSON.stringify({...script,lines:draft},null,2)+'\n'],{type:'application/json'});
      const href=URL.createObjectURL(blob),a=document.createElement('a');
      a.href=href;a.download='gld-walkthrough-script.json';document.body.append(a);a.click();a.remove();
      setTimeout(()=>URL.revokeObjectURL(href),1500);
      status.textContent='Downloaded the complete walkthrough script.';
    });
    show();
  }
  function step(line, values, target, prepare, prefix='') {
    return {key:line,title:prefix+lines[line][0],text:replace(lines[line][1],values),target,prepare};
  }
  function pageSteps(keys) {
    const periods=[...api.panels.values()], counts={ko:0,maturity:0,open:0,unfunded:0};
    for (const p of periods) for (const run of p.runs) {
      const buy=run.strategies.find(s=>s.key==='acc').events[0];
      counts[buy.type==='skip'?'unfunded':run.firstExit?.type??'open']++;
    }
    const reference=$('gld-mark').textContent==='—'?'A current GLD mark is unavailable':
      'The latest saved GLD close is '+$('gld-mark').textContent+' per share. '+$('market-date').textContent.trim().replace(/[.]$/,'');
    const values={reference,budget:api.price(api.terms().budget),openingShares:api.terms().openingShares??0,quotes:api.quoteCount(),
      paths:periods.length,kos:counts.ko,maturities:counts.maturity,open:counts.open,skipped:counts.unfunded,
      flow:$('flow-explanation').textContent.trim()};
    const targets={market:'.market-pair',settings:'#run-status',outcomes:'#replay-totals',pathList:'#timelines',
      fund:'.flow-stage.entry',observe:'.flow-stage.observe',knockout:'.flow-route:first-child',mature:'.flow-route:last-child',choices:'#flow-explanation'};
    return keys.filter(key=>key!=='outcomes'||!$('replay-overview').hidden).map(key=>step(key,values,()=>document.querySelector(targets[key])));
  }
  function cardSteps(panel, kind, prefix='') {
    const {path}=panel, i=panel.selected, picked=panel.day, last=path.prices.length-1;
    const run=panel.runs[i], buy=run.strategies.find(s=>s.key==='acc').events[0], exit=run.firstExit;
    const quote=api.quote(i), terms=GldPlays.quoteTerms(quote);
    const when=day=>api.fixingLabel(panel,day);
    const eventDay=buy.type==='skip'?0:exit?.day??last;
    // A fixed observation rule chooses the comparison, independently of the outcome.
    const next=path.checkpoints.find(p=>p.day>=eventDay+Math.max(21,api.terms().waitDays+1));
    const compareDay=kind==='fixing'?picked:picked>eventDay?picked:exit?.type==='ko'?(next?.day??last):last;
    const basis=path.proxy?'Monthly gold prices are interpolated into model fixings.':
      path.dates?'The fixings here are recorded GLD closes.':'The fixings here follow an editable price scenario.';
    const fixed={path:path.label,quote:api.quoteId(i),entry:api.price(path.prices[0]),basis,
      strike:api.price(buy.strike),barrier:api.price(buy.ko),term:quote.days,guarantee:terms.guaranteeDays,
      shares:exit?.shares,cash:exit?api.price(exit.cash):null,exitWhen:exit?when(exit.day):null};
    const qsel=sel=>panel.section.querySelector(sel);
    const statusTarget=()=>panel.detail.querySelector(':scope > .play-summary, :scope > .play-warning');
    function stateKey(day) {
      if(buy.type==='skip')return 'unfunded';
      if(!exit||day<exit.day)return day===last?'openEnd':'active';
      if(exit.type==='ko')return day===exit.day?'ko':'stillKo';
      return day===exit.day?'maturity':'stillMature';
    }
    function show(day,needsTable,after) {
      if(needsTable&&!after){
        panel.view.value='at';
        if(panel.board)panel.tbody.closest('details').open=true;
      }
      if(panel.selected!==i||panel.day!==day||needsTable){
        panel.selected=i;api.move(panel,day,true);
      }
    }
    const tour=[];
    for(const action of script.tours[kind]){
      const day=action==='entry'||action==='terms'?0:action==='event'?eventDay:action==='finish'?last:
        action==='result'||action==='benchmark'?compareDay:picked;
      const after=Boolean(run.postKo&&day>=run.postKo.day);
      const snap=GldPlays.atDay(run,day,after), names=after?api.post:api.pre, winner=snap.leaders[0];
      const benchKey=after?'acc':'wait', bench=snap.outcomes[benchKey];
      const values={...fixed,when:when(day),remaining:Math.max(0,quote.days-day),close:api.price(path.prices[day]),
        pnlBasis:after?'since the knock-out close':'from the original entry',leader:names[winner],
        winners:snap.leaders.map(k=>names[k]).join(', '),amount:winner?api.price(snap.outcomes[winner].pnl):null,
        benchmark:names[benchKey],basePnl:bench?api.price(bench.pnl):null,
        gap:winner&&bench?api.price((cents(snap.outcomes[winner].pnl)-cents(bench.pnl))/100):null};
      // Finance table markup is refreshed by a date change; resolve the target afterwards.
      const pnlTarget=key=>{
        if(after)return panel.detail.querySelector('[data-guide-post="'+key+'"]');
        return panel.tbody.querySelector('tr[data-quote-index="'+i+'"] [data-guide-pnl="'+key+'"]');
      };
      let line=action,target,needsTable=false;
      if(action==='entry'||action==='fixing')target=()=>api.units()==='xau'?
        panel.detail.querySelector(action==='entry'?'.gld-level-spot':'.gld-level-price'):
        panel.strip.querySelector('[aria-pressed="true"] strong')||panel.chart;
      if(action==='terms')target=()=>panel.detail.querySelector('.gld-barrier-levels')||panel.detail.querySelector('.play-note');
      if(action==='event'||action==='state'){
        line=stateKey(day);
        target=()=>panel.board&&line==='ko'?qsel('.replay-cell[aria-pressed="true"]'):statusTarget();
      }
      if(action==='result'||action==='finish'){
        if(action==='finish'&&day===compareDay)continue;
        line=after&&day===exit.day?'zero':!winner?'none':action==='finish'?'finish':snap.leaders.length>1?'tie':'pnl';
        needsTable=true;
        target=()=>{
          if(line==='zero')return panel.detail.querySelector('.play-detail > .play-note');
          if(snap.leaders.length>1){
            if(after)return panel.detail.querySelector('.play-detail .play-summary');
            return panel.tbody.querySelector('tr[data-quote-index="'+i+'"] .play-winner');
          }
          return winner?pnlTarget(winner):statusTarget();
        };
      }
      if(action==='benchmark'){
        if(!winner||!bench?.eligible||after&&day===exit.day)continue;
        needsTable=true;target=()=>pnlTarget(benchKey);
      }
      if(target)tour.push(step(line,values,target,()=>show(day,needsTable,after),prefix));
    }
    return tour;
  }
  const joinNames=new Intl.ListFormat('en-US',{type:'conjunction',style:'long'});
  const names={acc:'holding the delivered GLD and cash',hold:'buying more GLD',roll:'rolling the refund',
    decu:'the covered decumulator',wait:'waiting for a dip',staged:'buying in stages'};
  const policy={acc:'the hold position',hold:'the outright purchase',roll:'the rollover',
    decu:'the covered decumulator',wait:'the dip-buy rule',staged:'the staged purchase'};
  const withCap=s=>s.charAt(0).toUpperCase()+s.slice(1);
  const body=(key,values={})=>replace(lines[key][1],values);
  const moneyUS=n=>api.price(n).replace('$','US$');
  const usd=n=>(n>0?'+':'')+moneyUS(n);
  const shares=n=>(n>0?'+':'')+n.toLocaleString('en-US');
  function priceBasis(path) {
    return path.proxy?'Monthly gold prices are interpolated into model fixings.':
      path.dates?'These are historical GLD closing prices.':'These fixings follow the editable GLD price scenario.';
  }
  function winningText(panel,day,evidence,before,line,priorAll) {
    const {policies,leaders,runnerUps,price}=evidence, display=keys=>joinNames.format(keys.map(key=>names[key]));
    const best=leaders[0], main=policies[best], values={when:api.fixingLabel(panel,day),close:moneyUS(price)};
    if (!main) return {text:body('leaderUnranked',{...values,reason:body('leaderReasonNone')})};
    const lead=display(leaders)+(leaders.length>1?' share the lead':' leads');
    values.leaders=withCap(lead);
    values.previous=priorAll?'a tie among all eligible choices':before.length>1?'a tie between '+display(before):
      before.length?display(before):'no ranked action';
    values.amount=usd(main.pnl);
    values.result=body(main.pnl<0?'leaderLoss':main.pnl>0?'leaderGain':'leaderFlat',{amount:moneyUS(Math.abs(main.pnl))});
    values.position=body('leaderPosition',{policy:policy[best],cash:moneyUS(main.cash),shares:main.shares.toLocaleString('en-US')});
    // If the winner simply retained the KO assets, illustrate the closest
    // eligible action that actually traded. Prefix ledgers exclude later trades.
    const ranked=Object.values(policies).filter(s=>s.eligible).sort((a,b)=>b.pnl-a.pnl);
    const traded=main.deltaShares?main:ranked.find(s=>s.deltaShares);
    if (traded) {
      const impact=(cents(traded.deltaCash)+traded.deltaShares*cents(price))/100;
      values.trade=body(traded.deltaShares>0?'leaderBought':'leaderSold',{policy:withCap(policy[traded.key]),
        quantity:Math.abs(traded.deltaShares).toLocaleString('en-US'),tradePrice:moneyUS(-traded.deltaCash/traded.deltaShares),
        close:values.close,tradePnl:usd(impact)});
    } else values.trade=body('leaderNoTrades');
    values.move=day>0?body('leaderMove',{priorPrice:moneyUS(panel.path.prices[day-1]),close:values.close}):'';
    const departing=before.filter(key=>!leaders.includes(key)&&policies[key]?.eligible)
      .sort((a,b)=>policies[b].pnl-policies[a].pnl);
    const other=departing[0]??runnerUps[0]??leaders[1];
    const delta=other&&GldLeaderChanges.compare(evidence,best,other);
    const workings=[values.position,values.move];
    if (delta) {
      const pair={policy:policy[best],other:policy[other],cashDelta:usd(delta.cashDifference),shareDelta:shares(delta.shareDifference),
        holdingDelta:usd(delta.holdingDifference),gap:usd(delta.gap)};
      workings.push(body('leaderCompare',pair));
      if(line==='leaderChange' && before.includes(other) && Number.isFinite(delta.gapMove) && delta.gapMove!==0) {
        workings.push(body('leaderCross',{...pair,previousGap:usd(delta.previousGap),
          marketEffect:usd(delta.marketMoveDifference),tradeEffect:usd(delta.tradeEffectDifference)}));
      }
    }
    if (runnerUps.length) {
      const nearest=runnerUps[0];
      values.comparison=body('leaderGap',{other:policy[nearest],gap:moneyUS(main.pnl-policies[nearest].pnl)});
    } else values.comparison=leaders.length>1?body('leaderEqual'):body('leaderOnly',{policy:withCap(policy[best])});
    return {text:body(line,values),workings:workings.filter(Boolean).join(' ')};
  }
  function leaderSteps(panel) {
    const index=panel.selected,run=panel.runs[index],path=panel.path,quote=api.quote(index),picked=panel.day;
    const terms=api.terms(),end=path.prices.length-1,when=day=>api.fixingLabel(panel,day);
    const statusTarget=()=>panel.detail.querySelector(':scope > .play-summary, :scope > .play-warning') || panel.detail;
    const move=day=>{panel.selected=index;api.move(panel,day,true);};
    let next=GldLeaderChanges.next(run,picked);
    if (!run.postKo) {
      const first=run.strategies.find(s=>s.key==='acc')?.events[0];
      const reason=next.status==='unfunded'?body('leaderReasonSkip',{detail:first?.message||''}):
        next.status==='maturity'?body('leaderReasonMaturity',{exitWhen:when(run.firstExit.day)}):
        body('leaderReasonOpen',{endWhen:when(end)});
      return [step('leaderNoKo',{when:when(picked),reason},statusTarget,()=>move(picked))];
    }
    const ko=run.firstExit, start=next.anchorDay, trail=[{day:start,key:start===ko.day?'leaderKo':'leaderNow',before:[]}];
    while (next.status==='change' && next.day>trail.at(-1).day) {
      const prior=GldPlays.atDay(run,Math.max(ko.day,next.day-1),true).outcomes;
      const priorAll=next.before.length>1 && next.before.length===Object.values(prior).filter(s=>s.eligible).length;
      trail.push({day:next.day,key:'leaderChange',before:next.before,priorAll});
      next=GldLeaderChanges.next(run,next.day);
    }
    return trail.map(({day,key,before,priorAll},n)=>{
      // Resolving only the step being viewed avoids rebuilding every daily
      // ledger when the guide opens. Re-resolve DOM nodes after each repaint.
      let message, leaders=[];
      return {key,title:lines[key][0],note:n===trail.length-1?body('leaderLast',{endWhen:when(end)}):'',
        prepare:()=>move(day), inspect() {
          if (!message) {
            if (key==='leaderKo') message={text:body(key,{when:when(day),close:moneyUS(ko.price),shares:ko.shares.toLocaleString('en-US'),
              cash:moneyUS(ko.cash),basis:priceBasis(path)})};
            else {
              const evidence=GldLeaderChanges.explain({run,terms,quote,prices:path.prices,day});
              leaders=evidence?.leaders || [];
              message=evidence?winningText(panel,day,evidence,before,key,priorAll):{text:body('leaderUnranked',{when:when(day),
                close:moneyUS(path.prices[day]),reason:body('leaderReasonNone')})};
            }
          }
          const marks=leaders.map(k=>panel.detail.querySelector('[data-guide-post="'+k+'"]')).filter(Boolean);
          const inner=panel.detail.querySelector('.play-detail');
          const target=key==='leaderKo'?(panel.board?.querySelector('.replay-cell[aria-pressed="true"]') ||
            inner?.querySelector('.play-note') || statusTarget()):marks.length===1?marks[0]:
              inner?.querySelector('.play-summary') || marks[0] || statusTarget();
          return {...message,target,leaders:marks};
        }};
    });
  }
  function settings(panel,kind,trigger,open) {
    const box=document.createElement('details');box.className='gld-guide-options';box.open=open;
    const summary=document.createElement('summary');summary.textContent='Guide options';box.append(summary);
    const hint=document.createElement('p');hint.textContent='To start on another date, stop the guide, select that close and open Guide again.';box.append(hint);
    const grid=document.createElement('div');grid.className='gld-guide-settings';box.append(grid);
    const panels=[...api.panels.values()];
    function picker(key,labelText,choices,value,changed) {
      const label=document.createElement('label'),select=document.createElement('select');
      label.textContent=labelText;select.dataset.guideSetting=key;
      choices.forEach(([v,text])=>select.add(new Option(text,v)));select.value=String(value);
      select.addEventListener('change',()=>{
        changed(select.value);
        document.querySelector('[data-guide-setting="'+key+'"]')?.focus({preventScroll:true});
      });
      label.append(select);grid.append(label);
    }
    picker('path','Price path',panels.map((p,i)=>[i,p.path.label]),panels.indexOf(panel),i=>start(trigger,panels[Number(i)],kind,true));
    const quotes=Array.from({length:api.quoteCount()},(_,i)=>{
      const q=api.quote(i);
      return [i,api.quoteId(i)+' · '+q.months+'m · '+q.strike+'% strike · '+q.ko+'% KO · '+q.guarantee+'m guaranteed'];
    });
    picker('quote','Accumulator quote',quotes,panel.selected,i=>{
      panel.selected=Number(i);
      moving=true;try{api.move(panel,panel.day,true);}finally{moving=false;}
      start(trigger,panel,kind,true);
    });
    picker('mode','Guide',[['leader','Post-KO leader changes'],['fixing','Selected fixing'],['card','Selected path'],
      ['flow','Decision flow'],['page','Page overview']],kind,k=>start(trigger,panel,k,true));
    return box;
  }
  function start(trigger,panel=api.getPanel?.() || [...api.panels.values()][0],kind='leader',open=false) {
    if(!enabled||!panel)return;
    const steps=kind==='leader'?leaderSteps(panel):kind==='card'||kind==='fixing'?cardSteps(panel,kind):
      pageSteps(kind==='flow'?script.tours.flow:script.tours.page);
    if(!steps.length)return;
    const title=panel.path.label+' · '+api.quoteId(panel.selected)+(panel.path.proxy?' · Gold proxy':'');
    GldGuidePlayer.start({title,steps,trigger,mode:kind==='leader'?'changes':'manual',options:settings(panel,kind,trigger,open),
      resolve:s=>{
        moving=true;
        try {
          s.prepare?.();
          if(s.inspect)return s.inspect();
          return {target:s.target(),text:s.text};
        } finally{moving=false;}
      }});
  }
  function init(context) {
    api=context;
    try {
      script=JSON.parse($('gld-guide-source').textContent);
      if(script.version!==1||!['page','flow','card','fixing'].every(key=>Array.isArray(script.tours[key]))||
        !Object.entries(script.lines).every(([key,row])=>Array.isArray(row)&&typeof row[1]==='string'&&validLine(key,row)))throw Error();
      editor();
    } catch {
      lines=null;
      $('guide-status').textContent='The walkthrough script could not be loaded. Check the published script at the end of the HTML.';
      return;
    }
    const trigger=$('play-walkthrough');
    trigger.addEventListener('click',()=>start(trigger));
    document.addEventListener('click',e=>{
      if(e.target.closest('#flow-options,#timelines a'))beforeChange();
    });
    window.addEventListener('popstate',beforeChange);
  }
  window.GldGuide={init,beforeChange,ready};
})();
