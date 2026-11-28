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
    for (const btn of document.querySelectorAll('[data-guide-start]')) btn.disabled = !enabled;
  }
  function launcher(kind, label) {
    const btn = document.createElement('button');
    btn.type = 'button'; btn.className = 'guide-start'; btn.dataset.guideStart = kind;
    btn.textContent = label; btn.disabled = !enabled;
    return btn;
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
    function show(day,needsTable) {
      if(needsTable&&!panel.board)panel.view.value='at';
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
        if(panel.board)return qsel('.replay-readout [data-strategy="'+key+'"] .replay-action-pnl');
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
            if(panel.board)return qsel('.replay-readout-lead');
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
      if(target)tour.push(step(line,values,target,()=>show(day,needsTable),prefix));
    }
    return tour;
  }
  function start(trigger) {
    if(!enabled)return;
    const kind=trigger.dataset.guideStart,panels=[...api.panels.values()];
    const panel=panels.find(p=>p.section.contains(trigger));
    let steps,title;
    if(kind==='page'){
      steps=[...pageSteps([...script.tours.page,...script.tours.flow]),
        ...panels.flatMap(p=>cardSteps(p,'card',p.path.label+' · '))];
      title='GLD game plan';
    }else if(kind==='card'||kind==='fixing'){
      if(!panel)return;
      steps=cardSteps(panel,kind);title=panel.path.label+' · '+api.quoteId(panel.selected);
    }else{
      steps=pageSteps(kind==='flow'?script.tours.flow:[kind]);title=kind==='flow'?'Decision flow':'GLD game plan';
    }
    if(!steps.length)return;
    GldGuidePlayer.start({title,steps,trigger,resolve:s=>{
      moving=true;
      try {
        s.prepare?.();
        const target=s.target();
        if(!target?.isConnected)throw Error('This quote view has changed.');
        return {target,text:s.text};
      }finally{moving=false;}
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
    for(const [selector,kind,label] of [['.market-card','market','Explain these prices'],
      ['#settings + .play-note','settings','Explain these settings'],['#replay-overview','outcomes','Explain these outcomes']]){
      const target=document.querySelector(selector),btn=launcher(kind,label);
      if(kind==='settings')target.after(btn);else target.append(btn);
    }
    document.addEventListener('click',e=>{
      const btn=e.target.closest('[data-guide-start]');
      if(btn){start(btn);return;}
      if(e.target.closest('#flow-options,#timelines a'))beforeChange();
    });
    window.addEventListener('popstate',beforeChange);
  }
  window.GldGuide={init,launcher,beforeChange,ready};
})();
