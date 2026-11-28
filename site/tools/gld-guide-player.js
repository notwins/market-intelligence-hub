/* An on-demand, captioned walkthrough of live GLD simulator controls. */
(function (root) {
  'use strict';
  let current = null;

  function element(tag, cls, text) {
    const node = document.createElement(tag);
    node.className = cls;
    if (text !== undefined) node.textContent = text;
    return node;
  }
  function button(name, text, fn) {
    const node = element('button','gld-guide-'+name,text);
    node.type = 'button';
    node.addEventListener('click',fn);
    return node;
  }
  const alive = (s,p) => current === s && s.delivery === p;
  const duration = text => Math.max(3600, Math.min(120000, 1100 + text.trim().split(/\s+/).length * 355));
  const sayStatus = (s,text) => { if (s.status.textContent !== text) s.status.textContent = text; };

  function controls(s) {
    s.dock.dataset.playing = String(s.auto && !s.paused);
    s.prev.disabled = s.index <= 0;
    s.next.disabled = s.index >= s.steps.length-1;
    s.play.textContent = s.complete ? 'Play again' : s.auto && !s.paused ? 'Pause' : 'Play';
    s.play.setAttribute('aria-label',s.complete ? 'Play guide again' : s.auto && !s.paused ? 'Pause guide' : 'Play guide');
    s.voice.disabled = !s.synth;
    s.voice.textContent = s.voiced ? 'Voice on' : 'Voice off';
    s.voice.setAttribute('aria-pressed',String(s.voiced));
    s.caption.setAttribute('aria-live',s.voiced ? 'off' : 'polite');
  }
  function clearTimers(p) { clearTimeout(p.timer); clearTimeout(p.startWatch); }
  function cancelDelivery(s) {
    const p = s.delivery;
    s.delivery = null; // Some browsers dispatch a canceled event synchronously.
    if (!p) return;
    clearTimers(p);
    if (p.utterance) {
      p.utterance.onstart = p.utterance.onend = p.utterance.onerror = null;
      try {
        s.synth.cancel();
        if (p.held && s.synth.paused) s.synth.resume();
      } catch { /* Caption controls still work when speech is unavailable. */ }
    }
  }
  function finish(s,p) {
    if (!alive(s,p)) return;
    if (document.hidden || s.paused) {
      clearTimers(p); p.ended = true;
      if (document.hidden && !s.paused) pause(s,true);
      return;
    }
    s.delivery = null;
    clearTimers(p);
    if (!s.auto) return;
    if (s.index+1 < s.steps.length) { showStep(s,s.index+1,true); return; }
    s.auto = false; s.complete = true;
    controls(s); sayStatus(s,'Guide complete.');
  }
  function timed(s,p,milliseconds,callback) {
    p.remaining = milliseconds; p.until = performance.now()+milliseconds;
    p.timer = setTimeout(()=>{ if (alive(s,p)) callback(); },milliseconds);
  }
  function captions(s) {
    if (!s.auto || s.paused || document.hidden) return;
    const p = {utterance:null}; s.delivery = p;
    timed(s,p,duration(s.words),()=>finish(s,p));
  }
  function speechFallback(s,p) {
    if (!alive(s,p)) return;
    cancelDelivery(s); s.voiced = false;
    controls(s); sayStatus(s,'Voice unavailable. The guide is using captions.');
    captions(s);
  }
  function speak(s) {
    if (!s.ready || s.paused || document.hidden) return;
    if (!s.voiced) { captions(s); return; }
    const p = {utterance:null, held:false, started:false, ended:false};
    s.delivery = p;
    try {
      const utterance = new root.SpeechSynthesisUtterance(s.words);
      // Empty and delayed voice lists are normal. The browser can use its
      // configured default immediately, without fetching anything in the app.
      const voices = s.synth.getVoices?.() || [];
      const local = voices.filter(v=>v.localService && /^en(?:[-_]|$)/i.test(v.lang));
      const preferred = local.find(v=>v.default) || local[0];
      if (preferred) { utterance.voice=preferred; utterance.lang=preferred.lang; }
      else utterance.lang='en';
      p.utterance=utterance;
      utterance.onstart=()=>{ if (alive(s,p)) { p.started=true; clearTimeout(p.startWatch); } };
      utterance.onend=()=>finish(s,p);
      utterance.onerror=()=>speechFallback(s,p);
      // Engines can accept speak() without starting or delivering an end event.
      timed(s,p,Math.max(14000,duration(s.words)*2+6000),()=>speechFallback(s,p));
      p.startWatch=setTimeout(()=>{
        if (alive(s,p) && !s.paused && !p.started && !s.synth.speaking) speechFallback(s,p);
      },4500);
      s.synth.speak(utterance);
    } catch { speechFallback(s,p); }
  }
  function pause(s,hidden) {
    if (current !== s) return;
    s.auto=false; s.paused=true;
    const p=s.delivery;
    if (p) {
      p.remaining=Math.max(150,(p.until || performance.now())-performance.now());
      clearTimers(p);
      if (p.utterance && !p.ended) {
        try { s.synth.pause(); p.held=true; } catch { cancelDelivery(s); }
      }
    }
    controls(s);
    sayStatus(s,hidden ? 'Paused while this tab is hidden. Press Play to continue.' : 'Paused. Press Play to continue.');
  }
  function togglePlay(s) {
    if (s.auto && !s.paused) { pause(s,false); return; }
    if (s.complete) { showStep(s,0,true); return; }
    const wasPaused=s.paused;
    s.auto=true; s.paused=false; controls(s);
    sayStatus(s,s.voiced ? 'Playing with voice.' : 'Playing with captions.');
    const p=s.delivery;
    if (!p) { speak(s); return; }
    if (!wasPaused) return; // Already reading a manually selected step.
    if (p.ended) { finish(s,p); return; }
    if (p.utterance) {
      try {
        s.synth.resume(); p.held=false;
        if (!s.synth.speaking && !s.synth.pending) { cancelDelivery(s); speak(s); return; }
        timed(s,p,p.remaining,()=>speechFallback(s,p));
      } catch { speechFallback(s,p); }
    } else timed(s,p,p.remaining,()=>finish(s,p));
  }
  function toggleVoice(s) {
    if (!s.synth) return;
    cancelDelivery(s); s.voiced=!s.voiced; controls(s);
    sayStatus(s,s.voiced ? 'Voice on.' : 'Voice off. Captions remain available.');
    if (!s.paused && !s.complete) speak(s);
  }

  function intersection(a,b) {
    const left=Math.max(a.left,b.left), right=Math.min(a.right,b.right);
    const top=Math.max(a.top,b.top), bottom=Math.min(a.bottom,b.bottom);
    return right>left && bottom>top ? {left,right,top,bottom} : null;
  }
  const area = r => r ? (r.right-r.left)*(r.bottom-r.top) : 0;
  function viewport() {
    const css=getComputedStyle(document.documentElement), visual=root.visualViewport;
    const left=visual?.offsetLeft || 0, top=visual?.offsetTop || 0;
    const safeTop=parseFloat(css.getPropertyValue('--hub-primary-height')) || 0;
    const safeBottom=parseFloat(css.getPropertyValue('--hub-primary-bottom')) || 0;
    return {left:left+3,right:left+(visual?.width || root.innerWidth)-3,top:top+safeTop+3,
      bottom:top+(visual?.height || root.innerHeight)-safeBottom-3};
  }
  function tableFrame(node) {
    const cell=node?.closest('td,th'), table=cell?.closest('table');
    if (!table) return null;
    let scroller=table.parentElement;
    while (scroller && scroller!==document.body) {
      const css=getComputedStyle(scroller);
      if (/(auto|scroll)/.test(css.overflowX+' '+css.overflowY)) break;
      scroller=scroller.parentElement;
    }
    if (!scroller || scroller===document.body) return null;
    const first=cell.parentElement.cells[0], head=table.tHead?.rows[0]?.cells[0];
    return {scroller, first:cell!==first && getComputedStyle(first).position==='sticky' ? first:null,
      head:head && !table.tHead.contains(cell) && getComputedStyle(head).position==='sticky' ? head:null};
  }
  function tableRoom(frame) {
    const scroller=frame.scroller, box=scroller.getBoundingClientRect();
    const left=box.left+scroller.clientLeft, top=box.top+scroller.clientTop;
    return {left:Math.max(left,frame.first?.getBoundingClientRect().right ?? left)+4,
      top:Math.max(top,frame.head?.getBoundingClientRect().bottom ?? top)+4,
      right:left+scroller.clientWidth-4,bottom:top+scroller.clientHeight-4};
  }
  function fitCell(s) {
    const view=tableRoom(s.table), cell=s.target.getBoundingClientRect(), scroller=s.table.scroller;
    function shift(lo,hi,min,max) {
      if (lo<min || hi-lo>max-min) return lo-min;
      return Math.max(0,hi-max);
    }
    scroller.scrollLeft+=shift(cell.left,cell.right,view.left,view.right);
    scroller.scrollTop+=shift(cell.top,cell.bottom,view.top,view.bottom);
  }
  function clipped(node,screen,table) {
    let rect=intersection(node.getBoundingClientRect(),screen);
    for (let parent=node.parentElement; rect && parent && parent!==document.body; parent=parent.parentElement) {
      const style=getComputedStyle(parent), box=parent.getBoundingClientRect();
      const clipX=/(auto|scroll|hidden|clip)/.test(style.overflowX);
      const clipY=/(auto|scroll|hidden|clip)/.test(style.overflowY);
      if (clipX || clipY) rect=intersection(rect,{left:clipX?box.left+parent.clientLeft:rect.left,
        right:clipX?box.left+parent.clientLeft+parent.clientWidth:rect.right,top:clipY?box.top+parent.clientTop:rect.top,
        bottom:clipY?box.top+parent.clientTop+parent.clientHeight:rect.bottom});
    }
    return rect && table ? intersection(rect,tableRoom(table)) : rect;
  }
  function exposed(rect,dock) {
    if (!intersection(rect,dock)) return rect;
    const slices=[{...rect,bottom:Math.min(rect.bottom,dock.top-4)}, {...rect,top:Math.max(rect.top,dock.bottom+4)},
      {...rect,right:Math.min(rect.right,dock.left-4)}, {...rect,left:Math.max(rect.left,dock.right+4)}];
    return slices.filter(r=>r.right>r.left && r.bottom>r.top).sort((a,b)=>area(b)-area(a))[0] || null;
  }
  function layout(s) {
    s.frame=0;
    if (current!==s) return;
    const screen=viewport(), target=s.target;
    let rect=target?.isConnected ? clipped(target,screen,s.table) : null;
    if (rect) {
      const dock=s.dock.getBoundingClientRect(), gap=10;
      const high={left:dock.left,right:dock.right,top:screen.top+gap,bottom:screen.top+gap+dock.height};
      const low={left:dock.left,right:dock.right,top:screen.bottom-gap-dock.height,bottom:screen.bottom-gap};
      s.dock.dataset.placement=area(intersection(rect,high)) < area(intersection(rect,low)) ? 'top' : 'bottom';
      rect=exposed(rect,s.dock.getBoundingClientRect());
    }
    s.spot.hidden = s.pointer.hidden = !rect;
    if (!rect) return;
    const {left,right,top,bottom}=rect, x=(left+right)/2, y=(top+bottom)/2;
    Object.assign(s.spot.style,{left:left+'px',top:top+'px',width:(right-left)+'px',height:(bottom-top)+'px'});
    const tips=[['right',right,y,screen.right-right,1,0],['left',left,y,left-screen.left,-1,0],
      ['top',x,top,top-screen.top,0,-1],['bottom',x,bottom,screen.bottom-bottom,0,1]];
    const dock=s.dock.getBoundingClientRect();
    const possible=tips.filter(([,px,py,room,dx,dy])=>{
      const ax=px+dx*15, ay=py+dy*15;
      return room>=18 && !(ax>=dock.left && ax<=dock.right && ay>=dock.top && ay<=dock.bottom);
    });
    const [edge,px,py]=(possible.length ? possible : tips).sort((a,b)=>b[3]-a[3])[0];
    s.pointer.dataset.edge=edge; s.pointer.style.left=px+'px';s.pointer.style.top=py+'px';
  }
  function queueLayout(s) {
    if (current===s && !s.frame) s.frame=requestAnimationFrame(()=>layout(s));
  }
  function targetStep(s,target) {
    if (s.target) { s.target.classList.remove('gld-guide-active-target'); s.resize?.unobserve(s.target); }
    s.target=target?.isConnected && typeof target.getBoundingClientRect==='function' ? target : null;
    s.table=tableFrame(s.target);
    if (s.target) {
      let parent=s.target.parentElement;
      while (parent) {
        if (parent.tagName==='DETAILS' && !parent.open && !parent.querySelector(':scope > summary')?.contains(s.target)) parent.open=true;
        parent=parent.parentElement;
      }
      s.target.classList.add('gld-guide-active-target');s.resize?.observe(s.target);
      const screen=viewport(),raw=s.target.getBoundingClientRect(), visible=clipped(s.target,screen,s.table);
      if (!document.hidden && (!visible || area(visible)<raw.width*raw.height*.94 || intersection(visible,s.dock.getBoundingClientRect()))) {
        const block=raw.height>screen.bottom-screen.top ? 'start' : 'center';
        const smooth=!root.matchMedia('(prefers-reduced-motion: reduce)').matches;
        s.target.scrollIntoView({block,inline:'center',behavior:smooth && !s.table?'smooth':'instant'});
      }
      if (!document.hidden && s.table) fitCell(s);
    }
    queueLayout(s);
  }
  function showStep(s,index,auto) {
    if (current!==s || !s.steps[index]) return;
    const version=++s.version, step=s.steps[index];
    cancelDelivery(s); s.index=index; s.auto=auto && !document.hidden; s.paused=document.hidden; s.complete=false; s.ready=false;
    targetStep(s,null);
    s.count.textContent='Step '+(index+1)+' of '+s.steps.length;
    s.heading.textContent=step.title || 'Step '+(index+1);
    s.caption.textContent=step.text || '';
    controls(s);
    sayStatus(s,document.hidden ? 'Paused while this tab is hidden. Press Play to continue.' :
      !s.synth ? 'Browser speech is unavailable. Captions are on.' : auto ? (s.voiced ? 'Playing with voice.' : 'Playing with captions.') : 'Manual step.');
    function ready(result) {
      if (current!==s || s.version!==version) return;
      s.caption.textContent=result?.text || step.text || s.heading.textContent;
      s.words=s.heading.textContent.replace(/[.!?]+$/,'')+'. '+s.caption.textContent;
      s.ready=true;
      targetStep(s,result?.target);
      speak(s);
    }
    try {
      const result=s.resolve?.(step);
      if (result && typeof result.then==='function') result.then(ready,()=>ready(null));
      else ready(result);
    } catch { ready(null); }
  }
  function stop({restoreFocus=false}={}) {
    const s=current;
    if (!s) return;
    current=null; s.version++; cancelDelivery(s);
    s.listeners.abort();s.resize?.disconnect();s.mutations?.disconnect();
    if (s.frame) cancelAnimationFrame(s.frame);
    s.target?.classList.remove('gld-guide-active-target');
    s.pointer.remove();s.spot.remove();s.dock.remove();
    if (restoreFocus) {
      const target=s.trigger?.isConnected ? s.trigger : s.trigger?.id ? document.getElementById(s.trigger.id) : null;
      target?.focus({preventScroll:true});
    }
  }
  function start({title,steps,resolve,trigger}={}) {
    if (!Array.isArray(steps) || !steps.length) return false;
    stop();
    const synth=typeof root.SpeechSynthesisUtterance==='function' ? root.speechSynthesis : null;
    const s={steps,resolve,trigger:trigger || document.activeElement,synth,voiced:!!synth,version:0,target:null,
      delivery:null,ready:false,frame:0,listeners:new AbortController()};
    current=s;
    const dock=s.dock=element('aside','gld-guide-dock');
    dock.tabIndex=-1;dock.dataset.placement='bottom';dock.setAttribute('role','region');
    dock.setAttribute('aria-labelledby','gld-walkthrough-title');
    dock.setAttribute('aria-describedby','gld-walkthrough-step gld-walkthrough-caption');
    const header=element('div','gld-guide-header');
    const name=element('strong','gld-guide-title',title || 'GLD walkthrough');
    name.id='gld-walkthrough-title';
    s.count=element('span','gld-guide-count');
    const close=button('close','Close',()=>stop({restoreFocus:true}));close.setAttribute('aria-label','Close guide');
    header.append(name,s.count,close);
    s.heading=element('h3','gld-guide-step-title');s.caption=element('p','gld-guide-caption');
    s.heading.id='gld-walkthrough-step';s.caption.id='gld-walkthrough-caption';s.caption.setAttribute('aria-atomic','true');
    const bar=element('div','gld-guide-controls');bar.setAttribute('role','group');bar.setAttribute('aria-label','Guide playback');
    s.prev=button('prev','Previous',()=>showStep(s,s.index-1,false));
    s.play=button('play','Pause',()=>togglePlay(s));
    s.next=button('next','Next',()=>showStep(s,s.index+1,false));
    const repeat=button('repeat','Repeat',()=>showStep(s,s.index,false));repeat.setAttribute('aria-label','Repeat current step');
    s.voice=button('voice','Voice on',()=>toggleVoice(s));
    bar.append(s.prev,s.play,s.next,repeat,s.voice);
    s.status=element('p','gld-guide-status');s.status.setAttribute('role','status');s.status.setAttribute('aria-live','polite');
    dock.append(header,s.heading,s.caption,bar,s.status);
    s.spot=element('div','gld-guide-spotlight');s.pointer=element('div','gld-guide-pointer');
    for (const node of [s.spot,s.pointer]) { node.hidden=true;node.setAttribute('aria-hidden','true'); }
    document.body.append(s.spot,s.pointer,dock);
    const signal=s.listeners.signal;
    root.addEventListener('scroll',()=>queueLayout(s),{signal,capture:true,passive:true});
    root.addEventListener('resize',()=>queueLayout(s),{signal,passive:true});
    root.visualViewport?.addEventListener('resize',()=>queueLayout(s),{signal,passive:true});
    root.visualViewport?.addEventListener('scroll',()=>queueLayout(s),{signal,passive:true});
    document.addEventListener('visibilitychange',()=>{
      if(document.hidden && !s.paused && !s.complete)pause(s,true);else queueLayout(s);
    },{signal});
    document.addEventListener('keydown',event=>{
      if (event.key==='Escape' && !event.defaultPrevented) { event.preventDefault();stop({restoreFocus:true}); }
    },{signal});
    if (root.ResizeObserver) { s.resize=new ResizeObserver(()=>queueLayout(s));s.resize.observe(dock); }
    if (root.MutationObserver) {
      s.mutations=new MutationObserver(()=>queueLayout(s));s.mutations.observe(document.body,{childList:true,subtree:true});
    }
    showStep(s,0,true);
    dock.focus({preventScroll:true});
    return true;
  }
  root.GldGuidePlayer=Object.freeze({start,stop,active:()=>!!current});
})(globalThis);
