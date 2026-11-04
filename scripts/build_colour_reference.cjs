/* Build a reference from current public UI mappings; never infer tags on stories. */
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.join(__dirname,'../site'),read=p=>fs.readFileSync(path.join(root,p),'utf8');
function build(){
 const context={URL};vm.runInNewContext(read('headline-explorer.js').replace('const api={tags,','const api={rules,groups,tags,'),context);
 const H=context.HeadlineExplorer,css=read('headline-explorer.css'),out=[];
 const master=JSON.parse(read('data/keyword-colour-standard.json'));
 for(const r of master.keyword_groups)out.push({surface:'Master standard v1',group:r.category,label:r.keyword_group,description:master.rule_definitions[r.matching_rule],colour:r.text_light,background:r.chip_bg_light,dark_colour:r.text_dark,dark_background:r.chip_bg_dark,colour_name:r.colour_name,aliases:r.aliases,priority:r.priority,rule:r.matching_rule,href:'search.html?q='+encodeURIComponent(r.keyword_group)});
 function headline(group,label,description,href='v4.html#headlines'){
  const block=css.match(new RegExp('\\.hx-'+group+'\\{([^}]+)\\}'))[1];
  out.push({surface:'Headline tags',group:H.groups[group],label,description,colour:block.match(/(?:^|;)color:(#[0-9a-f]+)/i)[1],background:block.match(/background:(#[0-9a-f]+)/i)[1],href});
 }
 for(const [g,label] of H.rules)headline(g,label,'Recognized from explicit headline keywords. A label does not confirm an event or policy stance.');
 const categories=new Set();for(const p of ['data/news.json',...fs.readdirSync(path.join(root,'data/archive')).filter(p=>p.endsWith('.json')).map(p=>'data/archive/'+p)])for(const x of JSON.parse(read(p)).items||[])if(x.category)categories.add(x.category);
 for(const label of [...categories].sort())headline('category',label,'Stored coverage category. Its neutral grey is separate from topic colours.');
 const M=require('../site/morningstar-links.js');for(const r of M.rows)headline('ticker',r.ticker,r.name+' · '+r.exchange+'. Directory membership does not imply current coverage or a recommendation.','search.html?q='+encodeURIComponent(r.ticker));
 const atlas=JSON.parse(read('tag-map.html').match(/<script type="application\/json" id="taxonomy">(.*?)<\/script>/s)[1]);
 const tints=['#eef5ff','#f7f0ff','#eefaf4','#fff8e7','#fff0f3','#ebfafd','#f6f3fa','#fbf4ee'];
 function walk(nodes,group,colour,background,parents=[]){for(const n of nodes){out.push({surface:'Proposed tag atlas',group,label:n.label,description:(n.description||'Proposed navigation label; not a published event record.')+' Path: '+[...parents,n.label].join(' → '),colour,background,href:'tag-map.html?q='+encodeURIComponent(n.label)});walk(n.children||[],group,colour,background,[...parents,n.label]);}}
 atlas.forEach((n,i)=>walk([n],n.label,n.color,tints[i%tints.length]));
 return {schema_version:1,source:'User-supplied master standard v1, plus current headline rules/CSS, saved categories, company directory and proposed atlas taxonomy',rows:out};
}
if(require.main===module){const d=build();fs.writeFileSync(path.join(root,'data/colour-reference.json'),JSON.stringify(d,null,2)+'\n');console.log('Built '+d.rows.length+' colour-reference labels');}
module.exports={build};
