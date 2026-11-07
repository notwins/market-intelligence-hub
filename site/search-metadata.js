/* Display metadata only. Search scoring, ordering and saved source values are unchanged. */
(function(root){
'use strict';
const E=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const norm=s=>String(s||'').normalize('NFKC').toLocaleLowerCase().trim();
function dateInfo(value){
 const raw=typeof value==='string'?value.trim():'';
 if(!raw)return {text:'Date not supplied',raw:'',precision:'unknown'};
 const dayOnly=/^\d{4}-\d{2}-\d{2}$/.test(raw),timed=/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:\d{2})$/.test(raw);
 const day=raw.slice(0,10),calendar=new Date(day+'T00:00:00Z');
 if((!dayOnly&&!timed)||!Number.isFinite(calendar.getTime())||calendar.toISOString().slice(0,10)!==day)return {text:raw+' · time not supplied',raw:'',precision:'unknown'};
 const d=new Date(dayOnly?raw+'T00:00:00Z':raw);
 if(!Number.isFinite(d.getTime()))return {text:'Date not supplied',raw:'',precision:'unknown'};
 const opts={timeZone:dayOnly?'UTC':'Asia/Singapore',weekday:'short',day:'2-digit',month:'short'};
 if(timed)Object.assign(opts,{hour:'2-digit',minute:'2-digit',hour12:true});
 const parts=Object.fromEntries(new Intl.DateTimeFormat('en-GB',opts).formatToParts(d).map(p=>[p.type,p.value]));
 return {text:parts.weekday+(timed?' '+parts.hour+':'+parts.minute+parts.dayPeriod.toLowerCase():'')+', '+parts.day+'-'+parts.month+(timed?' SGT':' · time not supplied'),raw,precision:timed?'minute':'day'};
}
function dateHTML(value){const d=dateInfo(value);return d.raw?'<time datetime="'+E(d.raw)+'" title="'+E(d.raw+(d.precision==='minute'?' · displayed in Singapore time':''))+'">'+E(d.text)+'</time>':'<span>'+E(d.text)+'</span>';}
function sourceDate(entry){return dateHTML(Object.hasOwn(entry,'display_date')?entry.display_date:entry.date);}
function dateLabel(entry){return entry.date_label||({'Headline':'Published','Hourly story':'Source date','Hourly edition':'Coverage cutoff','Watchlist research':'Research cutoff','Historical series':'Observation date','Page':'Report date'}[entry.kind])||'Observation / edition date';}
function mapped(label,standard){return (standard?.version==='V1.2 Merged'?standard.tags:[])?.find(t=>[t.id,t.label,...(t.aliases||[])].some(a=>norm(a)===norm(label)))||null;}
function tagStyle(label,standard){const t=mapped(label,standard);return t&&/^#[0-9a-f]{6}$/i.test(t.text)&&/^#[0-9a-f]{6}$/i.test(t.background)?' style="--search-tag-ink:'+t.text+';--search-tag-bg:'+t.background+'"':'';}
function tagsHTML(labels,standard,{button=false,limit=6}={}){
 const tags=[...new Set((labels||[]).filter(t=>typeof t==='string'&&t.trim()))];
 return tags.slice(0,limit).map(t=>button?'<button class="tag-button search-tag" type="button" data-tag="'+E(t)+'"'+tagStyle(t,standard)+' title="Add '+E(t)+' using the selected AND / OR rule">'+E(t)+'</button>':'<span class="search-tag"'+tagStyle(t,standard)+'>'+E(t)+'</span>').join('')+(tags.length>limit?'<span class="search-tag-more">+'+(tags.length-limit)+' more tags</span>':'');
}
const api={dateInfo,dateHTML,sourceDate,dateLabel,mapped,tagStyle,tagsHTML};
if(typeof module!=='undefined'&&module.exports)module.exports=api;root.SearchMetadata=api;
})(typeof window!=='undefined'?window:globalThis);
