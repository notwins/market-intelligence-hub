"""Verify exact accepted research bytes at their intended served destinations."""
import argparse,functools,http.server,json,threading
from pathlib import Path
from urllib.parse import urlsplit
from urllib.request import urlopen
from research_feed import ROOT,collect,require,digest
from archive_navigation import restore

def verify(site,base_url,archive_navigation=False):
    u=urlsplit(base_url)
    require(u.scheme=='https' or (u.scheme=='http' and u.hostname in ('127.0.0.1','localhost')),'HTTPS or loopback required')
    require(not u.username and not u.password and not u.query and not u.fragment,'Unsafe base URL')
    rows,_=collect(site);checks=[]
    for row in rows:
        r=row['record']
        for name,expected in r['assets'].items():
            relative='research/'+r['id']+'/'+name;url=base_url.rstrip('/')+'/'+relative
            decorated=archive_navigation and name.lower().endswith('.html')
            if decorated and u.scheme=='https':url+='?archive-navigation=1'
            with urlopen(url,timeout=25) as response:
                require(response.status==200 and response.url==url,'Destination redirected or unavailable')
                body=response.read()
                require(digest(restore(body) if decorated else body)==expected,'Served report hash mismatch: '+relative)
                if name.endswith('.html'):require(response.headers.get_content_type()=='text/html','HTML destination is not HTML')
                if name.endswith('.pdf'):require(response.headers.get_content_type()=='application/pdf','PDF destination is not PDF')
            checks.append(relative)
    return {'result':'passed','base_url':base_url,'verified_files':checks}

def verify_staged(site, *, source_site=None, archive_navigation=False):
    class Handler(http.server.SimpleHTTPRequestHandler):
        def log_message(self,*args):pass
    server=http.server.ThreadingHTTPServer(('127.0.0.1',0),functools.partial(Handler,directory=str(Path(site).resolve())))
    threading.Thread(target=server.serve_forever,daemon=True).start()
    try:return verify(source_site or site,'http://127.0.0.1:'+str(server.server_port),archive_navigation)
    finally:server.shutdown();server.server_close()

if __name__=='__main__':
    p=argparse.ArgumentParser(description=__doc__);p.add_argument('--site',type=Path,default=ROOT/'site');p.add_argument('--base-url');a=p.parse_args()
    print(json.dumps(verify(a.site,a.base_url,archive_navigation=True) if a.base_url else verify_staged(a.site),indent=2))
