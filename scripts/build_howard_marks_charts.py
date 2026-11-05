"""Small inline vector charts from the report's dated, cited numerical tables."""
from html import escape

def text(x,y,value,**attrs):
 return '<text x="%s" y="%s" %s>%s</text>'%(x,y,' '.join('%s="%s"'%(k.replace('_','-'),escape(str(v))) for k,v in attrs.items()),escape(str(value)))
def start(i,title,desc,height=350):
 return f'<div class="native-chart-scroll" tabindex="0" role="region" aria-label="{escape(title)}"><svg class="native-chart" viewBox="0 0 760 {height}" role="img" aria-labelledby="chart-{i}-title chart-{i}-desc" xmlns="http://www.w3.org/2000/svg"><title id="chart-{i}-title">{escape(title)}</title><desc id="chart-{i}-desc">{escape(desc)}</desc><rect width="760" height="{height}" fill="#fff"/><g font-family="Arial,sans-serif" font-size="18" fill="#273b46">'
def end():return '</g></svg></div>'
def line_chart(i,title,xlabels,xcoords,series,ymin,ymax,ticks,unit):
 left,right,top,bottom=78,707,90,285
 y=lambda v:bottom-(v-ymin)/(ymax-ymin)*(bottom-top)
 s=start(i,title,'; '.join(name+': '+', '.join(str(v) for v in values) for name,color,values,dashed in series)+'. '+unit+'. Exact values and qualifications follow in the report.')
 s+=text(left,70,unit,font_size=16,fill='#526772')
 for tick in ticks:
  yy=y(tick);s+=f'<path d="M {left} {yy:.2f} H {right}" stroke="#d6e0e2" stroke-width="1"/>'+text(left-12,round(yy+6,2),tick,text_anchor='end',font_size=16)
 for label,x in zip(xlabels,xcoords):s+=text(x,321,label,text_anchor='middle',font_size=17)
 for index,(name,color,values,dashed) in enumerate(series):
  lx=88+index*345
  s+=f'<path d="M {lx} 28 h 37" stroke="{color}" stroke-width="3"'+(' stroke-dasharray="7 5"' if dashed else '')+'/>'+text(lx+47,34,name,font_size=17)
  points=' '.join(f'{x},{y(v):.3f}' for x,v in zip(xcoords,values))
  s+=f'<polyline data-values="{",".join(str(v) for v in values)}" points="{points}" fill="none" stroke="{color}" stroke-width="3"'+(' stroke-dasharray="7 5"' if dashed else '')+'/>'
  for x,v in zip(xcoords,values):
   if dashed:s+=f'<rect x="{x-4}" y="{y(v)-4:.3f}" width="8" height="8" fill="white" stroke="{color}" stroke-width="2"/>'
   else:s+=f'<circle cx="{x}" cy="{y(v):.3f}" r="5" fill="{color}"/>'
 return s+end()
def charts():
 one=line_chart(1,'Two snapshots of the US Treasury par yield curve',['2 years','10 years','30 years'],[90,263,695],[('22 Sep 2026','#475569',[4.71,4.96,5.29],True),('4 Nov 2026','#2563eb',[4.58,4.90,5.28],False)],4.4,5.4,[4.4,4.6,4.8,5.0,5.2,5.4],'Par yield (%)')
 two=start(2,'Two types of semi-liquid private credit funds','Federal Reserve, May 2026. Perpetual-life BDCs: gross assets 306, net assets 161. Credit-focused interval funds: gross assets 119, net assets 80. All in US$ billions. Net assets are after liabilities, not a credit-loss measure.')
 two+=text(90,35,'Gross assets',fill='#92400e')+text(300,35,'Net assets',fill='#0369a1')+text(70,70,'US$ billion',font_size=16)
 for tick in [0,100,200,300]:
  y=285-tick/350*190;two+=f'<path d="M 75 {y:.3f} H 700" stroke="#d6e0e2"/>'+text(63,round(y+6,3),tick,text_anchor='end',font_size=16)
 for group,x,values in [('Perpetual-life BDCs',240,[306,161]),('Credit interval funds',560,[119,80])]:
  for dx,value,col in [(-66,values[0],'#92400e'),(10,values[1],'#0369a1')]:
   h=value/350*190;two+=f'<rect data-value="{value}" x="{x+dx}" y="{285-h:.3f}" width="56" height="{h:.3f}" fill="{col}"/>'+text(x+dx+28,round(274-h,3),value,text_anchor='middle',font_weight=700,font_size=18)
  two+=text(x,322,group,text_anchor='middle',font_size=17)
 two+=end()
 three=line_chart(3,'Operating cash flow and purchases of property and equipment',['Q4 2025','Q1 2026','Q2 2026','Q3 2026'],[90,291.67,493.33,695],[('Operating cash flow','#475569',[52.402,45.790,39.069,42.290],True),('PP&E cash purchases','#6d28d9',[27.851,35.674,44.924,51.355],False)],20,60,[20,30,40,50,60],'US$ billion')
 four=start(4,'The durations Meta disclosed for Hyperion','Initial committed lease: 4 years. Conditional residual-value protection: 16 years. Occupancy if all renewal options are exercised: 20 years. Durations have different starting conventions; the 20-year bar is not committed rent.',370)
 for tick in [0,4,8,12,16,20]:
  x=280+tick*21;four+=f'<path d="M {x} 65 V 305" stroke="#d6e0e2"/>'+text(x,335,tick,text_anchor='middle',font_size=16)
 for yy,val,label,qualifier,color in [(70,4,'Initial lease','Committed','#166534'),(150,16,'Residual-value protection','Conditional','#92400e'),(230,20,'Potential occupancy','Includes renewal options','#6d28d9')]:
  four+=text(20,yy+23,label,font_size=18,font_weight=700)+text(20,yy+48,qualifier,font_size=15,fill='#526772')
  four+=f'<rect data-value="{val}" x="280" y="{yy}" width="{val*21}" height="55" rx="3" fill="{color}"/>'+text(280+val*21-9,yy+35,str(val),text_anchor='end',fill='#fff',font_weight=700)
 four+=text(700,361,'Duration (years)',text_anchor='end',font_size=16)+end()
 return [one,two,three,four]
