// Project the map's native hierarchy into a rotatable perspective view.
const TAU = Math.PI * 2;
const colours = ['#a2d2b2','#f1c08c','#89bdda','#c4ade0','#78bfae','#dd9e87','#d4bf80','#94a9ca','#85d0cf'];
const compactNames = ['FRED','Reading','Markets','News','Reports','Research','Tools','Archives','External'];
const mounted = new WeakSet();

export function mount(section) {
  if (!section || mounted.has(section)) return;
  const tree = section.closest('#site-tree')?.querySelector('.family-tree');
  const canvas = section.querySelector('canvas');
  const ctx = canvas?.getContext('2d');
  if (!tree || !ctx) return;
  const branches = [...tree.querySelectorAll(':scope > .family-branch')].map((el,index) => ({
    name:el.querySelector('.branch-title').textContent,
    short:compactNames[index] || el.querySelector('.branch-title').textContent,
    picture:el.querySelector('summary .destination-picture'),
    colour:colours[index % colours.length],
    destinations:[...el.querySelectorAll('.map-link')].map(link => ({
      name:link.querySelector('.map-title').textContent, link,
      picture:link.querySelector('.destination-picture')
    }))
  }));
  if (!branches.length) return;
  mounted.add(section);
  section.hidden = false;
  const shortcut=document.querySelector('.orbit-shortcut');
  if(shortcut)shortcut.hidden=false;
  const select = section.querySelector('select');
  const list = section.querySelector('[data-orbit-list]');
  const title = section.querySelector('[data-orbit-title]');
  const caption = section.querySelector('[data-orbit-caption]');
  const pause = section.querySelector('[data-orbit-motion]');
  const back = section.querySelector('[data-orbit-back]');
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  let active = -1, yaw = -.24, tilt = .78, zoom = 1, clock = 0, lastTime = 0, frame = 0;
  let visible = false, paused = false, gear = true, hover = null, hits = [], drag = null;
  let width = 0, height = 0;
  branches.forEach((b,i) => select.add(new Option(b.name,String(i))));
  // Repeatable stars and a belt of irregular rocks keep the sky steady during redraws.
  let seed = 19277;
  const random = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
  const stars = Array.from({length:145}, () => [random(),random(),.4+random()*.85,random()*TAU]);
  const rocks = Array.from({length:66}, () => [random()*TAU,.76+random()*.07,random()*.026, .9+random()*1.6]);
  function project(radius, angle, lift=0) {
    const x = Math.cos(angle+yaw)*radius, z = Math.sin(angle+yaw)*radius;
    const depth = z*Math.cos(tilt)+lift*Math.sin(tilt);
    const scale = 1/(1-depth*.19), unit = Math.min(width*.435,height*.49)*zoom;
    return {x:width*.5+x*unit*scale,y:height*.48+(z*Math.sin(tilt)-lift*Math.cos(tilt))*unit*scale,depth,scale};
  }
  function orbit(radius) {
    ctx.beginPath();
    for (let k=0;k<=96;k++) {
      const point = project(radius,TAU*k/96);
      if(k) ctx.lineTo(point.x,point.y); else ctx.moveTo(point.x,point.y);
    }
    ctx.strokeStyle='rgba(167,206,204,.28)';ctx.lineWidth=.8;ctx.stroke();
  }
  function circle(x,y,r,fill) {
    ctx.beginPath();ctx.arc(x,y,r,0,TAU);ctx.fillStyle=fill;ctx.fill();
  }
  // Pre-render shaded spheres once. The texture is sampled in sphere coordinates,
  // so the bands and rocky terrain curve around the illuminated limb.
  const textures = new Map();
  function surface(colour) {
    if (textures.has(colour)) return textures.get(colour);
    const tile=document.createElement('canvas'), side=96;
    tile.width=tile.height=side;
    const photo=tile.getContext('2d'), image=photo.createImageData(side,side);
    const rgb=[1,3,5].map(at=>parseInt(colour.slice(at,at+2),16));
    const kind=colours.indexOf(colour), sun=kind<0;
    for(let y=0;y<side;y++) for(let x=0;x<side;x++){
      const nx=(x+.5)/side*2-1, ny=(y+.5)/side*2-1, distance=nx*nx+ny*ny;
      if(distance>=1)continue;
      const nz=Math.sqrt(1-distance);
      const longitude=Math.atan2(nx,nz), latitude=Math.asin(ny);
      const warp=Math.sin(longitude*3+kind)*.22+Math.sin(latitude*6-longitude)*.12;
      const broad=Math.sin(latitude*16+longitude*.7+warp*2);
      const grain=Math.sin(longitude*43+latitude*35)*Math.sin(latitude*56-longitude*17);
      const stone=Math.sin(longitude*5+Math.sin(latitude*7)*2+kind)*Math.cos(latitude*6-longitude*2);
      const texture=sun ? 1+.12*stone+.08*grain : 1+(kind%3===0 ? .13*stone+.055*grain : .10*broad+.06*Math.sin(latitude*38+warp*4)+.035*grain);
      const light=Math.max(0,-nx*.48-ny*.55+nz*.66);
      const shade=sun ? .84+.23*nz : .29+.84*light;
      const rim=sun ? 0 : Math.pow(1-nz,4)*30;
      const at=(y*side+x)*4;
      rgb.forEach((v,c)=>{image.data[at+c]=Math.min(255,v*shade*texture+rim+(sun && c===1?15:0));});
      image.data[at+3]=Math.min(255,(1-Math.sqrt(distance))*side*255);
    }
    photo.putImageData(image,0,0);textures.set(colour,tile);return tile;
  }
  function globe(p,r,colour,ring) {
    const arc=(start,end)=>{
      ctx.beginPath();ctx.ellipse(p.x,p.y,r*1.65,r*.34,-.33,start,end);
      ctx.strokeStyle=colour;ctx.lineWidth=Math.max(1.3,r*.17);ctx.stroke();
      ctx.strokeStyle='rgba(245,237,203,.55)';ctx.lineWidth=.7;ctx.stroke();
    };
    if(ring)arc(Math.PI,TAU);
    ctx.drawImage(surface(colour),p.x-r,p.y-r,r*2,r*2);
    if(ring)arc(0,Math.PI);
  }
  function paint() {
    if (!width || !height) return;
    ctx.clearRect(0,0,width,height);
    for(const [x,y,r,phase] of stars) {
      const alpha=.44+.17*Math.sin(phase+clock*.56);
      circle(x*width,y*height,r,'rgba(222,238,245,'+alpha+')');
    }
    const branch=branches[active];
    const bodies=branch?branch.destinations:branches;
    const rings=branch?Math.ceil(bodies.length/8):3;
    const coordinates=bodies.map((body,i)=>{
      const band=branch?Math.floor(i/8):i%3;
      const r=branch?.destinations.length===1 ? .62 : (.36+.60*(band/Math.max(1,rings-1)));
      const count=branch?Math.min(8,bodies.length-band*8):Math.ceil((bodies.length-band)/3);
      const slot=branch?i%8:Math.floor(i/3);
      const angle=TAU*(slot+.13+band*.31)/count+clock*(.012+(.008/(band+1)));
      return {...project(r,angle),body,index:i,radius:branch?5.5+((i*3)%4):9+((i*3)%7),colour:branch?branch.colour:body.colour};
    });
    for(let band=0;band<rings;band++) orbit(branch?.destinations.length === 1 ? .62 : .36 + .60 * band / Math.max(1,rings-1));
    // Light travels along the orbital paths at different speeds.
    for(let k=0;k<rings;k++) {
      const r=branch?.destinations.length===1 ? .62 : .36+.60*k/Math.max(1,rings-1);
      for(let trail=5;trail>=0;trail--) {
        const p=project(r,clock*.20+k*2.1-trail*.022);
        circle(p.x,p.y,trail===0?1.9:1.15,'rgba(156,229,220,'+(.78-trail*.12)+')');
      }
    }
    for(const [a,r,l,size] of rocks) {
      const p=project(r,a+clock*.008,l);
      ctx.fillStyle='rgba(192,179,152,.68)';ctx.beginPath();ctx.moveTo(p.x-size,p.y);ctx.lineTo(p.x,p.y-size*.7);ctx.lineTo(p.x+size,p.y+.3);ctx.lineTo(p.x+.3,p.y+size*.55);ctx.closePath();ctx.fill();
    }
    const center=project(0,0);
    const radius=Math.min(width,height)*(branch ? .066 : .052);
    const glow=ctx.createRadialGradient(center.x,center.y,0,center.x,center.y,radius*3.3);
    glow.addColorStop(0,branch?'rgba(140,218,214,.35)':'rgba(255,201,119,.50)');
    glow.addColorStop(1,'rgba(150,153,123,0)');circle(center.x,center.y,radius*3.3,glow);
    const ordered=[...coordinates,{...center,central:true}].sort((a,b)=>a.depth-b.depth);
    hits=[];
    for(const p of ordered){
      if(p.central){globe(p,radius,branch?.colour||'#ffcc77',!!branch);continue;}
      const size=p.radius*p.scale;globe(p,size,p.colour,!branch && (p.index===2||p.index===6));
      hits.push({...p,hit:Math.max(13,size+4)});
      if(hover===p.index){
        ctx.strokeStyle='#f9efb6';ctx.lineWidth=1.4;ctx.beginPath();ctx.arc(p.x,p.y,size+4,0,TAU);ctx.stroke();
      }
    }
    ctx.textAlign='center';ctx.font='600 12px system-ui';
    for(const p of hits){
      if(branch && p.index!==hover)continue;
      const name=branch?p.body.name:p.body.short;
      const label=name.length>35?name.slice(0,32)+'…':name;
      const half=ctx.measureText(label).width/2;
      const x=Math.max(half+4,Math.min(width-half-4,p.x)), y=p.y+p.radius*p.scale+16;
      ctx.lineWidth=3;ctx.strokeStyle='#0b1a23';ctx.strokeText(label,x,y);
      ctx.fillStyle=p.index===hover?'#ffe1a9':'#deecea';ctx.fillText(label,x,y);
    }
  }
  function animate(time) {
    frame=0;
    if(!visible || document.hidden)return;
    if(lastTime)clock+=Math.min(.08,(time-lastTime)/1000);
    lastTime=time;paint();
    if(!paused && gear && !reduced.matches)frame=requestAnimationFrame(animate);
  }
  function schedule() {
    cancelAnimationFrame(frame);frame=0;lastTime=0;paint();
    const stopped=paused||!gear||reduced.matches;
    pause.textContent=stopped?'Motion paused':'Pause motion';
    if(paused && gear && !reduced.matches)pause.textContent='Resume motion';
    pause.disabled=!gear||reduced.matches;
    pause.setAttribute('aria-pressed',String(stopped));
    if(visible && !document.hidden && !stopped)frame=requestAnimationFrame(animate);
  }
  function syncPreference(){
    try {gear=localStorage.getItem('market-hub-desk-motion')!=='off';} catch {}
    schedule();
  }
  function choose(index) {
    active=index;hover=null;yaw=-.24;tilt=.78;
    const branch=branches[active];select.value=branch?String(index):'';back.hidden=!branch;
    title.textContent=branch?branch.name:'Sections';
    caption.textContent=branch?branch.destinations.length+' destinations · choose a moon or link':branches.length+' planets · choose a section';
    const rows=(branch?branch.destinations:branches).map((entry,i)=>{
      const el=branch?document.createElement('a'):document.createElement('button');
      if(branch){el.href=entry.link.href;if(entry.link.target){el.target=entry.link.target;el.rel='noopener noreferrer';}}
      else {el.type='button';el.addEventListener('click',()=>choose(i));}
      el.className='orbit-item';
      if(entry.picture)el.append(entry.picture.cloneNode(true));el.append(document.createTextNode(entry.name));
      el.addEventListener('focus',()=>{hover=i;paint();});
      el.addEventListener('blur',()=>{hover=null;paint();});
      return el;
    });
    list.replaceChildren(...rows);list.scrollTop=0;paint();
  }
  select.addEventListener('change',()=>choose(select.value===''?-1:Number(select.value)));
  back.addEventListener('click',()=>{choose(-1);select.focus();});
  pause.addEventListener('click',()=>{paused=!paused;schedule();});
  const zoomButtons=[...section.querySelectorAll('[data-orbit-zoom]')];
  function setZoom(value){
    zoom=Math.max(.72,Math.min(1.54,value));
    zoomButtons.forEach(button=>{button.disabled=Number(button.dataset.orbitZoom)>0 ? zoom>=1.54 : zoom<=.72;});
    paint();
  }
  zoomButtons.forEach(button=>button.addEventListener('click',()=>setZoom(zoom+Number(button.dataset.orbitZoom))));
  section.querySelector('[data-orbit-reset]').addEventListener('click',()=>{yaw=-.24;tilt=.78;clock=0;hover=null;setZoom(1);});
  const hitAt=(e)=>{
    const rect=canvas.getBoundingClientRect(),x=e.clientX-rect.left,y=e.clientY-rect.top;
    return [...hits].reverse().find(p=>Math.hypot(x-p.x,y-p.y)<p.hit);
  };
  canvas.addEventListener('pointerdown',e=>{
    if(!e.isPrimary||e.button!==0)return;
    drag={id:e.pointerId,x:e.clientX,y:e.clientY,yaw,tilt,moved:false};
    canvas.setPointerCapture(e.pointerId);
  });
  canvas.addEventListener('pointermove',e=>{
    if(drag?.id===e.pointerId){
      const dx=e.clientX-drag.x,dy=e.clientY-drag.y;
      if(Math.hypot(dx,dy)>5)drag.moved=true;
      if(drag.moved){yaw=drag.yaw+dx*.009;tilt=Math.min(1.23,Math.max(.21,drag.tilt+dy*.006));hover=null;}
    }else {hover=hitAt(e)?.index??null;canvas.style.cursor=hover===null?'grab':'pointer';}
    paint();
  });
  canvas.addEventListener('pointerup',e=>{
    if(drag?.id!==e.pointerId)return;
    const hit=!drag.moved && hitAt(e);drag=null;
    if(hit){if(active<0)choose(hit.index);else list.children[hit.index]?.click();}
  });
  canvas.addEventListener('lostpointercapture',()=>{drag=null;});
  canvas.addEventListener('pointerleave',()=>{if(!drag){hover=null;paint();}});
  canvas.addEventListener('keydown',e=>{
    const keys=['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'];
    if(!keys.includes(e.key))return;e.preventDefault();
    if(e.key==='ArrowLeft'||e.key==='ArrowRight')yaw+=e.key==='ArrowLeft'?-.18:.18;
    else tilt=Math.max(.21,Math.min(1.23,tilt+(e.key==='ArrowUp'?-.10:.10)));
    paint();
  });
  new ResizeObserver(()=>{
    width=canvas.clientWidth;height=canvas.clientHeight;
    const dpr=Math.min(devicePixelRatio||1,2);
    canvas.width=Math.round(width*dpr);canvas.height=Math.round(height*dpr);
    ctx.setTransform(dpr,0,0,dpr,0,0);paint();
  }).observe(canvas);
  new IntersectionObserver(entries=>{visible=entries[0].isIntersecting;schedule();}).observe(canvas);
  reduced.addEventListener('change',schedule);
  document.addEventListener('visibilitychange',schedule);
  window.addEventListener('storage',syncPreference);window.addEventListener('desk-motion-change',syncPreference);
  choose(-1);syncPreference();
}
document.querySelectorAll('.orbit-map').forEach(mount);

