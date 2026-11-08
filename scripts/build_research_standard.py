"""Compose one research-standard page from the authoritative prompt and gate docs."""
from html import escape
import json
from pathlib import Path
import re

ROOT=Path(__file__).resolve().parents[1]

def inline(text):
 text=escape(text)
 text=re.sub(r'`([^`]+)`',r'<code>\1</code>',text)
 text=re.sub(r'\*\*([^*]+)\*\*',r'<strong>\1</strong>',text)
 text=re.sub(r'\[([^\]]+)\]\((https?://[^\s)]+)\)',r'<a href="\2">\1</a>',text)
 text=re.sub(r'(?<![="\w])(https://[^\s<>]+)(?![^<]*</a>)',r'<a href="\1">\1</a>',text)
 return text

def markdown(text):
 out=[];paragraph=[];items=[];code=[];in_code=False
 def flush():
  if paragraph:out.append('<p>'+inline(' '.join(paragraph))+'</p>');paragraph.clear()
  if items:out.append('<ul>'+''.join('<li>'+inline(i)+'</li>' for i in items)+'</ul>');items.clear()
 for line in text.splitlines():
  if line.startswith('```'):
   if in_code:out.append('<pre>'+escape('\n'.join(code))+'</pre>');code=[];in_code=False
   else:flush();in_code=True
   continue
  if in_code:code.append(line);continue
  if not line.strip():flush();continue
  heading=re.match(r'^(?:#{1,4} (.+)|\*\*(.+)\*\*)$',line)
  if heading:flush();out.append('<h3>'+inline(next(x for x in heading.groups() if x))+'</h3>');continue
  if line.startswith(('- ','• ')):
   if paragraph:out.append('<p>'+inline(' '.join(paragraph))+'</p>');paragraph.clear()
   items.append(line[2:]);continue
  if items:out.append('<ul>'+''.join('<li>'+inline(i)+'</li>' for i in items)+'</ul>');items.clear()
  paragraph.append(line)
 flush();return ''.join(out)

def block(text,marker,html,insertion):
 start='<!-- '+marker+' START -->';end='<!-- '+marker+' END -->';new=start+'\n'+html+'\n'+end
 if start in text:return text[:text.index(start)]+new+text[text.index(end)+len(end):]
 return text[:insertion]+new+text[insertion:]

def build(root=ROOT):
 root=Path(root);page=root/'site/colour-templates-v3/index.html';text=page.read_text();prompt=(root/'site/legal/research-prompt.txt').read_text();gate=(root/'docs/research-colour-gatekeeper.md').read_text()
 overview='''<section id="standard-overview" class="standard-overview"><p class="kicker">One place for the complete research workflow</p><h2>Research style, colours and the publishing gate</h2><p>Start here for every new report. This page brings the writing and visual style, exact palette and tagging references, and release checks together. The underlying source files remain available.</p><div class="standard-steps"><a href="#research-style"><span>01 · Research style</span><strong>Write, explain and visualise</strong><small>Takeaways, evidence, scenarios, charts and the full reusable prompt.</small></a><a href="#subject-guide"><span>02 · Colours and identity</span><strong>Choose the theme, preserve the tags</strong><small>Ten subject themes, 150 swatches, share colours and keyword backdrops.</small></a><a href="#gatekeeper"><span>03 · Publishing gatekeeper</span><strong>Review before release</strong><small>Evidence, source dates, chart integrity, mobile layout and contract checks.</small></a></div><p class="caption"><a href="#articles">Which palette belongs to each article?</a> · <a href="../legal/editorial-policy.html">Original editorial-policy page</a>. This unified reference does not change the draft legal-policy status or recolour older reports.</p></section>'''
 style='''<section id="research-style"><div class="sectionhead"><div><p class="kicker">01 / Research style</p><h2>A clear answer. Visible evidence. Useful visuals.</h2></div><p>Use the full prompt below as the source instruction. The checklist here makes the workflow easy to scan.</p></div><div class="style-checklist"><article class="note"><h3>Lead with the answer</h3><p>Give one to five takeaways, the reporting cutoff and the main research question. Explain what happened, why it matters, the risks and what could change the conclusion.</p></article><article class="note"><h3>Keep evidence distinct</h3><p>Separate verified facts, source opinions, forecasts and your own analysis. Cite sources and distinguish observation dates from publication dates. Include the countercase.</p></article><article class="note"><h3>Make each card useful</h3><p>Pair a takeaway title with a relevant chart, table, diagram or comparison. Add a plain-English “how to read it” explanation, source, date and units. Aim for a balanced mix of meaningful visuals and concise explanation.</p></article><article class="note"><h3>Show scenarios honestly</h3><p>Label targets with their source, date, horizon, assumptions and units. Never invent a forecast path, probability, target or analyst call. Keep actual data separate from forecasts.</p></article><article class="note"><h3>Apply one coherent theme</h3><p>Choose the <a href="#subject-guide">main-subject palette</a>. Use near-white surfaces, quiet separators and readable text. Preserve the approved <a href="#companies">share</a> and <a href="#keywords">keyword</a> identities.</p></article><article class="note"><h3>Check before publishing</h3><p>Verify figures, calculations, source links, labels, desktop and mobile rendering, contrast, clipping and file size. Document gaps and complete the <a href="#gatekeeper">publication gate</a>.</p></article></div><div class="prompt-actions"><button id="copy-unified-prompt" type="button">Copy complete research prompt</button><a href="../legal/research-prompt.txt" download>Download prompt</a><span id="unified-copy-status" role="status" aria-live="polite"></span></div><details class="panel full-standard"><summary>Read the complete research-style prompt</summary><div class="standard-prose">'''+markdown(prompt)+'''</div></details><p class="caption">This section is generated from the same prompt used by the editorial page, not a separate version. The <a href="#gatekeeper-complete">full gatekeeper rules</a> below are generated from the publication-rule source.</p><script type="application/json" id="unified-prompt-source">'''+json.dumps(prompt,ensure_ascii=False).replace('<','\\u003c')+'''</script></section>'''
 text=block(text,'UNIFIED RESEARCH STYLE',overview+style,text.index('<main id="main">')+len('<main id="main">'))
 gateview='<details class="panel full-standard" id="gatekeeper-complete"><summary>Read the complete gatekeeper scope and contract</summary><div class="standard-prose">'+markdown(gate)+'</div></details><script type="application/json" id="unified-gate-source">'+json.dumps(gate,ensure_ascii=False).replace('<','\\u003c')+'</script>'
 end=text.index('<section id="downloads">');pos=text.rfind('</section>',0,end);text=block(text,'UNIFIED GATEKEEPER',gateview,pos)
 page.write_text(text)
if __name__=='__main__':build()
