window.MarketLayout=(()=>{'use strict';
let frame,previousWidth=0;
function values(){const root=document.documentElement,scale=Number(root.style.getPropertyValue('--text-scale'))||1,card=Number(root.style.getPropertyValue('--card-scale'))||1;return{root,scale,card};}
function update(){const{root,scale,card}=values();const minimum=Math.max(340*card,260*scale);root.style.setProperty('--card-min',minimum+'px');root.style.setProperty('--small-card-min',Math.max(160*card,130*scale)+'px');root.style.setProperty('--chart-min',Math.max(600*card,330*scale)+'px');root.style.setProperty('--card-pad',Math.max(12,25*card)+'px');root.style.setProperty('--card-gap',Math.max(10,20*card)+'px');}
function chartWidth({fullWidth=false}={}){const{root,scale,card}=values(),content=document.querySelector('#view'),width=content?.getBoundingClientRect().width||innerWidth;
 const columns=root.dataset.displayColumns;const minimum=Math.max(600*card,330*scale);const split=!fullWidth&&columns!=='one'&&width>=minimum*2+20;
 return Math.max(280,Math.round((split?(width-20)/2:width)-Math.max(24,50*card)));}
// UST card geometry is independent of the plot height. Fit the whole card first.
function ustChartWidth({deck=true,pinned=false}={}){const{card}=values(),width=document.querySelector('#view')?.getBoundingClientRect().width||innerWidth,available=deck?Math.min(width,1740):width,columns=deck&&available>=1300?2:1,panel=Math.min(860,(available-20*(columns-1))/columns),padding=pinned?Math.min(28,Math.max(16,innerWidth*.025)):Math.max(12,25*card);return Math.max(280,Math.round(panel-2*padding-(pinned?8:2)));}
// Wide monthly-yield cards put controls/data at left and the readable plot at right.
function historyChartWidth({fullWidth=false}={}){const{root,card}=values(),width=document.querySelector('#view')?.getBoundingClientRect().width||innerWidth;if(fullWidth||innerWidth<=760||width<980||root.dataset.displayColumns==='one')return chartWidth({fullWidth});const gap=Math.max(10,20*card),padding=Math.max(12,25*card),data=Math.min(400,Math.max(320,width*.25));return Math.max(280,Math.round(width-2*padding-2-data-gap));}
function resized(){cancelAnimationFrame(frame);frame=requestAnimationFrame(()=>{const width=document.querySelector('#view')?.clientWidth||innerWidth;if(Math.abs(width-previousWidth)<2)return;previousWidth=width;update();window.dispatchEvent(new CustomEvent('market-display-change'));});}
function ready(){update();new ResizeObserver(resized).observe(document.querySelector('.content'));}
document.readyState==='loading'?document.addEventListener('DOMContentLoaded',ready,{once:true}):ready();
return{update,chartWidth,ustChartWidth,historyChartWidth};})();
